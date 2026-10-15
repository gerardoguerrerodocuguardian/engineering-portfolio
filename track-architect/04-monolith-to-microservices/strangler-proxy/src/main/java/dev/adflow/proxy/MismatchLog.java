package dev.adflow.proxy;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

public final class MismatchLog {
    public record Mismatch(String at, String route, String ref, List<String> diffs) {}

    private static final System.Logger LOG = System.getLogger("parallel-run");
    private final List<Mismatch> entries = new CopyOnWriteArrayList<>();
    private final AtomicLong compared = new AtomicLong();

    public void compared() { compared.incrementAndGet(); }
    public long comparedCount() { return compared.get(); }

    public void record(String route, String ref, List<String> diffs) {
        entries.add(new Mismatch(Instant.now().toString(), route, ref, diffs));
        LOG.log(System.Logger.Level.WARNING, "MISMATCH {0} {1}: {2}", route, ref, diffs);
    }

    public List<Mismatch> entries() { return List.copyOf(entries); }
    public void clear() { entries.clear(); }
}
