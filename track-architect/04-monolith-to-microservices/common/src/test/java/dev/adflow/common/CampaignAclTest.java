package dev.adflow.common;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class CampaignAclTest {
    private static LegacyCampaign row(String id, String nm, String amt, String stat, String dt) {
        return new LegacyCampaign(id, nm, amt, "usd", stat, dt);
    }

    @Test
    void mapsLegacyToNewModel() {
        Campaign c = CampaignAcl.toNew(row("1001", "Summer Sale 2024    ", "1250.50", "A", "20240601"));
        assertEquals(1001, c.id());
        assertEquals("Summer Sale 2024", c.name());          // padding removed
        assertEquals(new Money(125050, "USD"), c.budget());  // major string -> minor long, ccy normalised
        assertEquals("ACTIVE", c.status());
        assertEquals("2024-06-01", c.startDate());
    }

    @Test
    void mapsEveryStatusCodeBothWays() {
        for (String[] p : new String[][] {{"A", "ACTIVE"}, {"S", "PAUSED"}, {"C", "ARCHIVED"}}) {
            assertEquals(p[1], CampaignAcl.toNew(row("1", "x", "1", p[0], "20240101")).status());
            assertEquals(p[0], CampaignAcl.toLegacy(new Campaign(1, "x", new Money(100, "USD"), p[1], "2024-01-01")).statCd());
        }
    }

    @Test
    void roundTripPreservesData() {
        Campaign c = new Campaign(42, "Round Trip", new Money(999, "EUR"), "PAUSED", "2025-02-28");
        assertEquals(c, CampaignAcl.toNew(CampaignAcl.toLegacy(c)));
    }

    @Test
    void toLegacyPadsTruncatesAndFormats() {
        LegacyCampaign l = CampaignAcl.toLegacy(new Campaign(7, "Holiday Mega Promo Extended", new Money(5, "USD"), "ACTIVE", "2024-11-01"));
        assertEquals("Holiday Mega Promo E", l.campNm());
        assertEquals("0.05", l.budgetAmt());
        assertEquals("20241101", l.startDt());
        assertEquals("", CampaignAcl.toLegacy(new Campaign(0, "n", new Money(1, "USD"), "ACTIVE", "2024-01-01")).campId());
    }

    @Test
    void rejectsCorruptLegacyData() {
        assertThrows(AclException.class, () -> CampaignAcl.toNew(row("1", "x", "1", "Z", "20240101")));
        assertThrows(AclException.class, () -> CampaignAcl.toNew(row("1", "x", "abc", "A", "20240101")));
        assertThrows(AclException.class, () -> CampaignAcl.toNew(row("1", "x", "1", "A", "2024-01-01")));
        assertThrows(AclException.class, () -> CampaignAcl.toNew(row("x", "x", "1", "A", "20240101")));
        assertThrows(AclException.class, () -> CampaignAcl.toNew(null));
    }

    @Test
    void diffToleratesKnownLegacyTruncationButCatchesRealDrift() {
        Campaign full = new Campaign(1, "Holiday Mega Promo Extended", new Money(100, "USD"), "ACTIVE", "2024-01-01");
        Campaign trunc = new Campaign(1, "Holiday Mega Promo E", new Money(100, "USD"), "ACTIVE", "2024-01-01");
        assertTrue(CampaignDiff.compare(full, trunc).isEmpty());
        List<String> d = CampaignDiff.compare(full, new Campaign(1, "Other", new Money(100, "USD"), "PAUSED", "2024-01-01"));
        assertEquals(2, d.size());
    }
}
