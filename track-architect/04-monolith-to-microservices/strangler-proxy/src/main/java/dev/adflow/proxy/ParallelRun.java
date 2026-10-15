package dev.adflow.proxy;

import dev.adflow.common.Campaign;
import java.util.List;
import java.util.Optional;

/** Compares what the legacy and the new service answer for the same request and logs every difference. */
public final class ParallelRun {
    private final MismatchLog log;

    public ParallelRun(MismatchLog log) { this.log = log; }

    public int compareOne(String route, long id, Optional<Campaign> legacy, Optional<Campaign> neu) {
        log.compared();
        String ref = route + "/" + id;
        if (legacy.isPresent() && neu.isPresent()) {
            var diffs = dev.adflow.common.CampaignDiff.compare(legacy.get(), neu.get());
            if (diffs.isEmpty()) return 0;
            log.record(route, ref, diffs);
            return 1;
        }
        if (legacy.isEmpty() && neu.isEmpty()) return 0;
        log.record(route, ref, List.of(legacy.isPresent() ? "missing in new" : "missing in legacy"));
        return 1;
    }

    public int compareList(String route, List<Campaign> legacy, List<Campaign> neu) {
        log.compared();
        SetDiff d = SetDiff.compare(legacy, neu);
        d.missingInNew().forEach(id -> log.record(route, route + "/" + id, List.of("missing in new")));
        d.missingInLegacy().forEach(id -> log.record(route, route + "/" + id, List.of("missing in legacy")));
        d.mismatched().forEach((id, diffs) -> log.record(route, route + "/" + id, diffs));
        return d.missingInNew().size() + d.missingInLegacy().size() + d.mismatched().size();
    }
}
