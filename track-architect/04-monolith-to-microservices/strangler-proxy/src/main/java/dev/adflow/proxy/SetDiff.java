package dev.adflow.proxy;

import dev.adflow.common.Campaign;
import dev.adflow.common.CampaignDiff;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Result of comparing two campaign collections (legacy = a, new = b), shared by parallel run and reconciliation. */
public record SetDiff(int matched, List<Long> missingInNew, List<Long> missingInLegacy, Map<Long, List<String>> mismatched) {

    public boolean clean() { return missingInNew.isEmpty() && missingInLegacy.isEmpty() && mismatched.isEmpty(); }

    public static SetDiff compare(List<Campaign> legacy, List<Campaign> neu) {
        Map<Long, Campaign> a = new TreeMap<>(), b = new TreeMap<>();
        legacy.forEach(c -> a.put(c.id(), c));
        neu.forEach(c -> b.put(c.id(), c));
        int matched = 0;
        List<Long> missNew = new ArrayList<>(), missLegacy = new ArrayList<>();
        Map<Long, List<String>> bad = new TreeMap<>();
        for (var e : a.entrySet()) {
            Campaign other = b.get(e.getKey());
            if (other == null) { missNew.add(e.getKey()); continue; }
            List<String> d = CampaignDiff.compare(e.getValue(), other);
            if (d.isEmpty()) matched++; else bad.put(e.getKey(), d);
        }
        for (Long id : b.keySet()) if (!a.containsKey(id)) missLegacy.add(id);
        return new SetDiff(matched, missNew, missLegacy, bad);
    }
}
