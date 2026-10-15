package io.adflow.pipeline.application.port;

import io.adflow.pipeline.domain.AdEvent;
import io.adflow.pipeline.domain.CampaignDayAggregate;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Outbound port: analytical store. {@link #write} MUST be idempotent on eventId: writing the same
 * event any number of times yields the same aggregates (replace semantics, never "add").
 */
public interface AggregateSink {

    void write(List<AdEvent> events);

    Optional<CampaignDayAggregate> find(String campaignId, LocalDate day);
}
