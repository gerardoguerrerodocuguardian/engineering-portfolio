package dev.adflow.proxy;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Properties;
import org.junit.jupiter.api.Test;

class RouterTest {
    private static long newShare(Router r, String path, int n) {
        long c = 0;
        for (int i = 0; i < n; i++) if (r.decide(path, "user-" + i) == Target.NEW) c++;
        return c;
    }

    @Test
    void zeroPercentSendsEverythingToLegacyAndHundredToNew() {
        RouteConfig cfg = new RouteConfig(false);
        Router r = new Router(cfg);
        assertEquals(0, newShare(r, "/campaigns", 1000));   // unconfigured -> legacy
        cfg.setPercent("/campaigns", 100);
        assertEquals(1000, newShare(r, "/campaigns", 1000));
    }

    @Test
    void percentageIsHonouredWithinTolerance() {
        RouteConfig cfg = new RouteConfig(false);
        Router r = new Router(cfg);
        for (int pct : new int[] {10, 50, 90}) {
            cfg.setPercent("/campaigns", pct);
            double share = newShare(r, "/campaigns", 20000) / 20000.0 * 100;
            assertEquals(pct, share, 2.0, "target " + pct + "%");
        }
    }

    @Test
    void routingIsStickyPerKeyAndMonotonic() {
        RouteConfig cfg = new RouteConfig(false);
        Router r = new Router(cfg);
        cfg.setPercent("/campaigns", 30);
        Target first = r.decide("/campaigns", "user-7");
        for (int i = 0; i < 20; i++) assertEquals(first, r.decide("/campaigns", "user-7"));
        // raising the percentage never moves a key from NEW back to LEGACY
        for (int i = 0; i < 2000; i++) {
            cfg.setPercent("/campaigns", 30);
            Target at30 = r.decide("/campaigns", "k" + i);
            cfg.setPercent("/campaigns", 60);
            if (at30 == Target.NEW) assertEquals(Target.NEW, r.decide("/campaigns", "k" + i));
        }
    }

    @Test
    void routesAreIndependentAndLongestPrefixWins() {
        RouteConfig cfg = new RouteConfig(false);
        cfg.setPercent("/campaigns", 100);
        cfg.setPercent("/reports", 0);
        cfg.setPercent("/campaigns/archived", 0);
        Router r = new Router(cfg);
        assertEquals(Target.NEW, r.decide("/campaigns/5", "k"));
        assertEquals(Target.LEGACY, r.decide("/reports/spend", "k"));
        assertEquals(Target.LEGACY, r.decide("/campaigns/archived/1", "k"));
    }

    @Test
    void loadsFromPropertiesAndRejectsInvalidPercent() {
        Properties p = new Properties();
        p.setProperty("route./campaigns", "25");
        p.setProperty("shadow", "true");
        RouteConfig cfg = RouteConfig.fromProperties(p);
        assertEquals(25, cfg.percentFor("/campaigns/1"));
        assertTrue(cfg.shadow());
        assertThrows(IllegalArgumentException.class, () -> cfg.setPercent("/x", 101));
    }
}
