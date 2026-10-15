package dev.adflow.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Anti-corruption layer: the ONLY place that knows both models. The new service never sees
 * CAMP_NM padding, "A/S/C" codes or yyyyMMdd dates.
 */
public final class CampaignAcl {
    /** Legacy column is CHAR(20): longer names are silently truncated, shorter ones space-padded. */
    public static final int LEGACY_NAME_LEN = 20;

    private CampaignAcl() {}

    public static Campaign toNew(LegacyCampaign l) {
        if (l == null) throw new AclException("legacy row is null");
        try {
            long id = Long.parseLong(l.campId().trim());
            String name = l.campNm() == null ? "" : l.campNm().strip();
            long minor = new BigDecimal(l.budgetAmt().trim()).movePointRight(2)
                    .setScale(0, RoundingMode.HALF_UP).longValueExact();
            String ccy = l.ccyCd().trim().toUpperCase();
            String date = LocalDate.parse(l.startDt().trim(), DateTimeFormatter.BASIC_ISO_DATE).toString();
            return new Campaign(id, name, new Money(minor, ccy), statusToNew(l.statCd()), date);
        } catch (NumberFormatException | ArithmeticException | DateTimeParseException | NullPointerException e) {
            throw new AclException("cannot translate legacy row " + (l.campId()) + ": " + e, e);
        }
    }

    /** id 0 means "not assigned yet": the legacy side allocates it. */
    public static LegacyCampaign toLegacy(Campaign c) {
        if (c == null) throw new AclException("campaign is null");
        try {
            return new LegacyCampaign(
                    c.id() == 0 ? "" : Long.toString(c.id()),
                    legacyName(c.name()),
                    BigDecimal.valueOf(c.budget().amountMinor(), 2).toPlainString(),
                    c.budget().currency(),
                    statusToLegacy(c.status()),
                    LocalDate.parse(c.startDate()).format(DateTimeFormatter.BASIC_ISO_DATE));
        } catch (DateTimeParseException | NullPointerException e) {
            throw new AclException("cannot translate campaign " + c.id() + ": " + e, e);
        }
    }

    /** Name as the legacy system would store it (truncated, trimmed). Used for tolerant comparison. */
    public static String legacyName(String name) {
        String n = name == null ? "" : name.strip();
        return (n.length() > LEGACY_NAME_LEN ? n.substring(0, LEGACY_NAME_LEN) : n).stripTrailing();
    }

    static String statusToNew(String code) {
        return switch (code == null ? "" : code.trim()) {
            case "A" -> "ACTIVE";
            case "S" -> "PAUSED";
            case "C" -> "ARCHIVED";
            default -> throw new AclException("unknown legacy STAT_CD '" + code + "'");
        };
    }

    static String statusToLegacy(String status) {
        return switch (status == null ? "" : status) {
            case "ACTIVE" -> "A";
            case "PAUSED" -> "S";
            case "ARCHIVED" -> "C";
            default -> throw new AclException("unknown status '" + status + "'");
        };
    }
}
