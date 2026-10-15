package dev.adflow.proxy;

import dev.adflow.common.Campaign;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicLong;

/**
 * The strangler seam for /campaigns: route by percentage, fall back to legacy if the new service fails,
 * dual-write on create, and run the other side in shadow to detect behavioural differences.
 */
public final class CampaignFacade {
    public static final String ROUTE = "/campaigns";
    public record Served<T>(T value, String servedBy) {}

    private static final System.Logger LOG = System.getLogger("facade");
    private final Router router;
    private final RouteConfig config;
    private final CampaignBackend legacy, neu;
    private final ParallelRun parallel;
    private final Executor shadowExecutor;
    public final AtomicLong servedLegacy = new AtomicLong(), servedNew = new AtomicLong(),
            fallbacks = new AtomicLong(), dualWriteFailures = new AtomicLong();

    public CampaignFacade(Router router, RouteConfig config, CampaignBackend legacy, CampaignBackend neu,
                          ParallelRun parallel, Executor shadowExecutor) {
        this.router = router; this.config = config; this.legacy = legacy; this.neu = neu;
        this.parallel = parallel; this.shadowExecutor = shadowExecutor;
    }

    private CampaignBackend of(Target t) { return t == Target.NEW ? neu : legacy; }

    private <T> Served<T> serve(String key, java.util.function.Function<CampaignBackend, T> op) {
        Target t = router.decide(ROUTE, key);
        if (t == Target.NEW) {
            try {
                T v = op.apply(neu);
                servedNew.incrementAndGet();
                return new Served<>(v, "new");
            } catch (BackendException e) {
                fallbacks.incrementAndGet();
                LOG.log(System.Logger.Level.WARNING, "new service failed, falling back to legacy: {0}", e.getMessage());
            }
        }
        T v = op.apply(legacy);
        servedLegacy.incrementAndGet();
        return new Served<>(v, t == Target.NEW ? "legacy-fallback" : "legacy");
    }

    public Served<List<Campaign>> list(String key) {
        Served<List<Campaign>> s = serve(key, CampaignBackend::list);
        shadow(() -> parallel.compareList(ROUTE, legacy.list(), neu.list()));
        return s;
    }

    public Served<Optional<Campaign>> get(long id) {
        Served<Optional<Campaign>> s = serve(Long.toString(id), b -> b.get(id));
        shadow(() -> parallel.compareOne(ROUTE, id, legacy.get(id), neu.get(id)));
        return s;
    }

    /** Dual-write: primary per routing, then replicate exactly what the primary stored to the other side. */
    public Served<Campaign> create(Campaign c, String key) {
        Target t = router.decide(ROUTE, key == null ? UUID.randomUUID().toString() : key);
        CampaignBackend primary = of(t), secondary = of(t == Target.NEW ? Target.LEGACY : Target.NEW);
        Campaign stored = primary.create(c);
        try {
            secondary.upsert(stored);
        } catch (RuntimeException e) {
            dualWriteFailures.incrementAndGet(); // left for reconciliation to repair
            LOG.log(System.Logger.Level.ERROR, "dual-write to secondary failed for {0}: {1}", stored.id(), e.getMessage());
        }
        (t == Target.NEW ? servedNew : servedLegacy).incrementAndGet();
        return new Served<>(stored, t.label());
    }

    private void shadow(Runnable r) {
        if (!config.shadow()) return;
        shadowExecutor.execute(() -> {
            try { r.run(); }
            catch (RuntimeException e) { LOG.log(System.Logger.Level.WARNING, "shadow comparison failed: {0}", e.toString()); }
        });
    }
}
