package dev.adflow.proxy;

import dev.adflow.common.Campaign;
import java.util.ArrayList;
import java.util.List;

/** Data-migration helpers: idempotent backfill, and a reconciliation check with optional repair. */
public final class Reconciler {
    public record Report(int legacyCount, int newCount, SetDiff diff, int repaired) {
        public boolean clean() { return diff.clean(); }
    }

    private final CampaignBackend legacy;
    private final CampaignBackend neu;

    public Reconciler(CampaignBackend legacy, CampaignBackend neu) { this.legacy = legacy; this.neu = neu; }

    /** Copies every legacy campaign to the new service via the ACL. Safe to re-run. */
    public int backfill() {
        int n = 0;
        for (Campaign c : legacy.list()) { neu.upsert(c); n++; }
        return n;
    }

    /**
     * Compares both stores. With {@code repair}, the legacy copy wins (it is the system of record until the
     * cutover) for rows missing or different in the new store. Rows that exist only in the new store are
     * reported, never deleted automatically.
     */
    public Report reconcile(boolean repair) {
        List<Campaign> l = legacy.list(), n = neu.list();
        SetDiff diff = SetDiff.compare(l, n);
        int repaired = 0;
        if (repair && !diff.clean()) {
            List<Long> ids = new ArrayList<>(diff.missingInNew());
            ids.addAll(diff.mismatched().keySet());
            for (Campaign c : l) if (ids.contains(c.id())) { neu.upsert(c); repaired++; }
            diff = SetDiff.compare(legacy.list(), neu.list());
        }
        return new Report(l.size(), n.size(), diff, repaired);
    }
}
