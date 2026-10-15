package io.adflow.pipeline.domain;

import java.time.LocalDate;
import java.util.Collection;

/** Per-campaign, per-UTC-day totals. Always derived from the full set of distinct events. */
public record CampaignDayAggregate(String campaignId, LocalDate day, long impressions, long clicks, long costCents) {

    public static CampaignDayAggregate of(String campaignId, LocalDate day, Collection<AdEvent> events) {
        long imp = 0, clk = 0, cost = 0;
        for (AdEvent e : events) {
            if (e.type() == EventType.IMPRESSION) imp++; else clk++;
            cost += e.costCents();
        }
        return new CampaignDayAggregate(campaignId, day, imp, clk, cost);
    }
}
