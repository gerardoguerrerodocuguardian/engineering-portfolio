package io.adflow.pipeline.adapter.out;

import io.adflow.pipeline.application.port.AggregateSink;
import io.adflow.pipeline.domain.AdEvent;
import io.adflow.pipeline.domain.CampaignDayAggregate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryAggregateSink implements AggregateSink {

    private final Map<UUID, AdEvent> events = new ConcurrentHashMap<>();

    @Override
    public void write(List<AdEvent> batch) {
        batch.forEach(e -> events.putIfAbsent(e.eventId(), e));
    }

    @Override
    public Optional<CampaignDayAggregate> find(String campaignId, LocalDate day) {
        List<AdEvent> match = new ArrayList<>();
        for (AdEvent e : events.values()) {
            if (e.campaignId().equals(campaignId) && e.day().equals(day)) match.add(e);
        }
        return match.isEmpty() ? Optional.empty() : Optional.of(CampaignDayAggregate.of(campaignId, day, match));
    }
}
