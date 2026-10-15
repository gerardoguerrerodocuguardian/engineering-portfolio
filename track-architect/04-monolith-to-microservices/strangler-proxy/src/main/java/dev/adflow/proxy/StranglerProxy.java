package dev.adflow.proxy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.adflow.common.AclException;
import dev.adflow.common.Campaign;
import dev.adflow.common.Http;
import dev.adflow.common.Json;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.Executors;

/**
 * The strangler facade. Clients only ever talk to this process; routing is data (RouteConfig), changeable at
 * runtime through /admin/routes, like a feature flag.
 */
public final class StranglerProxy {
    private final String legacyUrl, newUrl;
    private final RouteConfig config;
    private final Router router;
    private final MismatchLog mismatches = new MismatchLog();
    private final CampaignFacade facade;
    private final Reconciler reconciler;

    public StranglerProxy(String legacyUrl, String newUrl, RouteConfig config) {
        this.legacyUrl = legacyUrl; this.newUrl = newUrl; this.config = config;
        this.router = new Router(config);
        CampaignBackend l = new HttpBackends.Legacy(legacyUrl), n = new HttpBackends.New(newUrl);
        this.facade = new CampaignFacade(router, config, l, n, new ParallelRun(mismatches), Executors.newFixedThreadPool(2));
        this.reconciler = new Reconciler(l, n);
    }

    public HttpServer start(int port) throws IOException {
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        s.createContext("/", this::dispatch);
        s.setExecutor(Executors.newCachedThreadPool());
        s.start();
        return s;
    }

    private void dispatch(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath(), m = ex.getRequestMethod();
        try {
            if (path.startsWith("/admin/")) admin(ex, path, m);
            else if (path.equals("/campaigns") || path.startsWith("/campaigns/")) campaigns(ex, path, m);
            else passthrough(ex, path);
        } catch (BackendException e) {
            Http.reply(ex, 502, Json.write(Map.of("error", String.valueOf(e.getMessage()))));
        } catch (AclException | IllegalArgumentException e) {
            Http.reply(ex, 400, Json.write(Map.of("error", String.valueOf(e.getMessage()))));
        } catch (RuntimeException e) {
            Http.reply(ex, 500, Json.write(Map.of("error", e.toString())));
        }
    }

    private String key(HttpExchange ex) {
        String k = ex.getRequestHeaders().getFirst("X-Routing-Key");
        return k != null ? k : UUID.randomUUID().toString();
    }

    private void campaigns(HttpExchange ex, String path, String m) throws IOException {
        if (path.equals("/campaigns") && m.equals("GET")) {
            var s = facade.list(key(ex));
            Http.reply(ex, 200, Json.write(s.value()), "X-Served-By", s.servedBy());
        } else if (path.equals("/campaigns") && m.equals("POST")) {
            var s = facade.create(Json.read(Http.body(ex), Campaign.class), key(ex));
            Http.reply(ex, 201, Json.write(s.value()), "X-Served-By", s.servedBy());
        } else if (path.startsWith("/campaigns/") && m.equals("GET")) {
            var s = facade.get(Long.parseLong(path.substring("/campaigns/".length())));
            if (s.value().isEmpty()) Http.reply(ex, 404, Json.write(Map.of("error", "campaign not found")), "X-Served-By", s.servedBy());
            else Http.reply(ex, 200, Json.write(s.value().get()), "X-Served-By", s.servedBy());
        } else Http.reply(ex, 405, Json.write(Map.of("error", "method not allowed")));
    }

    /** Anything without a dedicated facade (e.g. /reports) is forwarded; the new side falls back to legacy. */
    private void passthrough(HttpExchange ex, String path) throws IOException {
        String qs = ex.getRequestURI().getRawQuery() == null ? "" : "?" + ex.getRequestURI().getRawQuery();
        Target t = router.decide(path, key(ex));
        Http.Resp r = null;
        String served = t.label();
        if (t == Target.NEW) {
            try { r = Http.call(ex.getRequestMethod(), newUrl + path + qs, null); } catch (IOException ignored) { }
            if (r == null || r.status() / 100 != 2) { r = null; served = "legacy-fallback"; }
        }
        if (r == null) {
            try { r = Http.call(ex.getRequestMethod(), legacyUrl + path + qs, null); }
            catch (IOException e) { throw new BackendException("legacy unreachable", e); }
        }
        Http.reply(ex, r.status(), r.body(), "X-Served-By", served);
    }

    private void admin(HttpExchange ex, String path, String m) throws IOException {
        Map<String, String> q = Http.query(ex.getRequestURI());
        switch (path) {
            case "/admin/routes" -> {
                if (m.equals("POST") || m.equals("PUT")) {
                    if (q.containsKey("prefix")) config.setPercent(q.get("prefix"), Integer.parseInt(q.get("percent")));
                    if (q.containsKey("shadow")) config.setShadow(Boolean.parseBoolean(q.get("shadow")));
                }
                Http.reply(ex, 200, Json.write(Map.of("routes", config.routes(), "shadow", config.shadow())));
            }
            case "/admin/mismatches" -> {
                if (m.equals("DELETE")) mismatches.clear();
                Http.reply(ex, 200, Json.write(Map.of("compared", mismatches.comparedCount(), "mismatches", mismatches.entries())));
            }
            case "/admin/migrate" -> Http.reply(ex, 200, Json.write(Map.of("backfilled", reconciler.backfill())));
            case "/admin/reconcile" -> {
                Reconciler.Report r = reconciler.reconcile(Boolean.parseBoolean(q.getOrDefault("repair", "false")));
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("clean", r.clean()); out.put("legacyCount", r.legacyCount()); out.put("newCount", r.newCount());
                out.put("matched", r.diff().matched()); out.put("missingInNew", r.diff().missingInNew());
                out.put("missingInLegacy", r.diff().missingInLegacy()); out.put("mismatched", r.diff().mismatched());
                out.put("repaired", r.repaired());
                Http.reply(ex, 200, Json.write(out));
            }
            case "/admin/status" -> Http.reply(ex, 200, Json.write(Map.of(
                    "routes", config.routes(), "shadow", config.shadow(),
                    "servedLegacy", facade.servedLegacy.get(), "servedNew", facade.servedNew.get(),
                    "fallbacks", facade.fallbacks.get(), "dualWriteFailures", facade.dualWriteFailures.get(),
                    "mismatches", mismatches.entries().size())));
            default -> Http.reply(ex, 404, Json.write(Map.of("error", "unknown admin endpoint")));
        }
    }

    /** Usage: StranglerProxy [port] [legacyUrl] [newUrl] [routing.properties] */
    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        String legacy = args.length > 1 ? args[1] : "http://127.0.0.1:8081";
        String neu = args.length > 2 ? args[2] : "http://127.0.0.1:8082";
        Properties p = new Properties();
        if (args.length > 3) try (var in = new FileInputStream(args[3])) { p.load(in); }
        new StranglerProxy(legacy, neu, RouteConfig.fromProperties(p)).start(port);
        System.out.println("strangler-proxy listening on " + port + " routes=" + RouteConfig.fromProperties(p).routes());
    }
}
