package dev.adflow.common;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Field-level comparison of two campaigns in the NEW model. */
public final class CampaignDiff {
    private CampaignDiff() {}

    /**
     * Names are compared after applying the legacy CHAR(20) truncation to both sides: that limitation is a
     * known, documented difference, not a regression to alert on.
     */
    public static List<String> compare(Campaign a, Campaign b) {
        List<String> d = new ArrayList<>();
        if (!Objects.equals(CampaignAcl.legacyName(a.name()), CampaignAcl.legacyName(b.name())))
            d.add("name: '" + a.name() + "' vs '" + b.name() + "'");
        if (!Objects.equals(a.budget(), b.budget())) d.add("budget: " + a.budget() + " vs " + b.budget());
        if (!Objects.equals(a.status(), b.status())) d.add("status: " + a.status() + " vs " + b.status());
        if (!Objects.equals(a.startDate(), b.startDate())) d.add("startDate: " + a.startDate() + " vs " + b.startDate());
        return d;
    }
}
