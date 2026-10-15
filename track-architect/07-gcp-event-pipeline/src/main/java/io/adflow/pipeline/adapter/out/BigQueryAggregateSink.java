package io.adflow.pipeline.adapter.out;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.QueryParameterValue;
import com.google.cloud.bigquery.TableResult;
import io.adflow.pipeline.application.port.AggregateSink;
import io.adflow.pipeline.domain.AdEvent;
import io.adflow.pipeline.domain.CampaignDayAggregate;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.TreeSet;
import org.springframework.core.io.ClassPathResource;

/**
 * BigQuery adapter using the official client. Runs the two idempotent MERGE statements from /sql
 * (insert-if-absent into ad_events, then replace campaign_daily rows for the touched campaigns/days).
 * Both statements prune partitions via @min_day/@max_day. Not exercised in CI: needs a real project.
 */
public class BigQueryAggregateSink implements AggregateSink {

    private final BigQuery bigQuery;
    private final String mergeEvents;
    private final String mergeDaily;
    private final String selectDaily;
    private final ObjectMapper mapper = new ObjectMapper();

    public BigQueryAggregateSink(BigQuery bigQuery, String project, String dataset) {
        this.bigQuery = bigQuery;
        this.mergeEvents = load("sql/01_merge_ad_events.sql", project, dataset);
        this.mergeDaily = load("sql/02_merge_campaign_daily.sql", project, dataset);
        this.selectDaily = "SELECT impressions, clicks, cost_cents FROM `" + project + "." + dataset
                + ".campaign_daily` WHERE day = @day AND campaign_id = @campaign_id";
    }

    @Override
    public void write(List<AdEvent> events) {
        if (events.isEmpty()) return;
        ArrayNode arr = mapper.createArrayNode();
        for (AdEvent e : events) {
            arr.addObject().put("event_id", e.eventId().toString()).put("type", e.type().name())
                    .put("campaign_id", e.campaignId()).put("cost_cents", e.costCents())
                    .put("occurred_at", e.occurredAt().toString());
        }
        TreeSet<LocalDate> days = new TreeSet<>(events.stream().map(AdEvent::day).toList());
        List<String> campaigns = events.stream().map(AdEvent::campaignId).distinct().sorted(Comparator.naturalOrder()).toList();
        try {
            String json = mapper.writeValueAsString(arr);
            run(QueryJobConfiguration.newBuilder(mergeEvents)
                    .addNamedParameter("events", QueryParameterValue.string(json))
                    .addNamedParameter("min_day", QueryParameterValue.date(days.first().toString()))
                    .addNamedParameter("max_day", QueryParameterValue.date(days.last().toString()))
                    .build());
            run(QueryJobConfiguration.newBuilder(mergeDaily)
                    .addNamedParameter("campaigns", QueryParameterValue.array(campaigns.toArray(String[]::new), String.class))
                    .addNamedParameter("min_day", QueryParameterValue.date(days.first().toString()))
                    .addNamedParameter("max_day", QueryParameterValue.date(days.last().toString()))
                    .build());
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public Optional<CampaignDayAggregate> find(String campaignId, LocalDate day) {
        TableResult r = run(QueryJobConfiguration.newBuilder(selectDaily)
                .addNamedParameter("day", QueryParameterValue.date(day.toString()))
                .addNamedParameter("campaign_id", QueryParameterValue.string(campaignId))
                .build());
        for (FieldValueList row : r.iterateAll()) {
            return Optional.of(new CampaignDayAggregate(campaignId, day, row.get(0).getLongValue(),
                    row.get(1).getLongValue(), row.get(2).getLongValue()));
        }
        return Optional.empty();
    }

    private TableResult run(QueryJobConfiguration cfg) {
        try {
            return bigQuery.query(cfg);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while waiting for BigQuery", e);
        }
    }

    private static String load(String path, String project, String dataset) {
        try (var in = new ClassPathResource(path).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8)
                    .replace("${project}", project).replace("${dataset}", dataset);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
