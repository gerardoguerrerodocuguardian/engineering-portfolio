package dev.adflow.proxy;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import dev.adflow.campaigns.NewCampaignService;
import dev.adflow.common.Http;
import dev.adflow.common.Json;
import dev.adflow.legacy.LegacyMonolith;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Real servers on ephemeral ports: legacy + new + proxy. */
class EndToEndTest {
    private HttpServer legacySrv, newSrv, proxySrv;
    private String legacy, neu, proxy;

    @BeforeEach
    void up() throws Exception {
        legacySrv = new LegacyMonolith().start(0);
        newSrv = new NewCampaignService().start(0);
        legacy = "http://127.0.0.1:" + legacySrv.getAddress().getPort();
        neu = "http://127.0.0.1:" + newSrv.getAddress().getPort();
        RouteConfig cfg = new RouteConfig(true);
        cfg.setPercent("/campaigns", 0);
        cfg.setPercent("/reports", 0);
        proxySrv = new StranglerProxy(legacy, neu, cfg).start(0);
        proxy = "http://127.0.0.1:" + proxySrv.getAddress().getPort();
    }

    @AfterEach
    void down() {
        legacySrv.stop(0); newSrv.stop(0); proxySrv.stop(0);
    }

    private Http.Resp get(String path) throws Exception { return Http.call("GET", proxy + path, null); }

    @Test
    void shiftTrafficFromLegacyToNewWithMigrationAndRollback() throws Exception {
        // 0%: legacy serves, answer is already in the NEW model thanks to the ACL
        var r = get("/campaigns/1001");
        assertEquals("legacy", r.headers().firstValue("X-Served-By").orElseThrow());
        assertEquals("Summer Sale 2024", Json.tree(r.body()).get("name").asText());
        assertEquals(125050, Json.tree(r.body()).get("budget").get("amountMinor").asLong());

        // migrate + reconcile
        assertEquals(5, Json.tree(Http.call("POST", proxy + "/admin/migrate", null).body()).get("backfilled").asInt());
        assertTrue(Json.tree(get("/admin/reconcile").body()).get("clean").asBoolean());

        // dual-write create through the proxy lands in both stores
        String body = "{\"id\":0,\"name\":\"Launch Q4\",\"budget\":{\"amountMinor\":2500,\"currency\":\"USD\"},\"status\":\"ACTIVE\",\"startDate\":\"2025-01-15\"}";
        var created = Http.call("POST", proxy + "/campaigns", body);
        assertEquals(201, created.status());
        long id = Json.tree(created.body()).get("id").asLong();
        assertEquals(200, Http.call("GET", legacy + "/campaigns/" + id, null).status());
        assertEquals(200, Http.call("GET", neu + "/campaigns/" + id, null).status());

        // drift introduced behind the proxy's back is found, then repaired
        Http.call("PUT", legacy + "/campaigns/1002", "{\"CAMP_NM\":\"Back To School\",\"BUDGET_AMT\":\"5000.00\",\"CCY_CD\":\"USD\",\"STAT_CD\":\"S\",\"START_DT\":\"20240801\"}");
        var rec = Json.tree(get("/admin/reconcile").body());
        assertFalse(rec.get("clean").asBoolean());
        assertTrue(rec.get("mismatched").has("1002"));
        assertTrue(Json.tree(get("/admin/reconcile?repair=true").body()).get("clean").asBoolean());

        // 100%: new serves; reports remain legacy
        Http.call("POST", proxy + "/admin/routes?prefix=/campaigns&percent=100", null);
        assertEquals("new", get("/campaigns/1001").headers().firstValue("X-Served-By").orElseThrow());
        assertEquals("legacy", get("/reports/spend").headers().firstValue("X-Served-By").orElseThrow());

        // new service dies -> automatic fallback, then explicit rollback
        newSrv.stop(0);
        assertEquals("legacy-fallback", get("/campaigns/1001").headers().firstValue("X-Served-By").orElseThrow());
        Http.call("POST", proxy + "/admin/routes?prefix=/campaigns&percent=0", null);
        assertEquals("legacy", get("/campaigns/1001").headers().firstValue("X-Served-By").orElseThrow());
    }
}
