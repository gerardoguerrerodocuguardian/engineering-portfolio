package dev.adflow.legacy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.adflow.common.Http;
import dev.adflow.common.Json;
import dev.adflow.common.LegacyCampaign;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.InetSocketAddress;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.Executors;

/**
 * The deliberately tangled "AdFlow" legacy monolith. One class, one shared in-memory "database",
 * campaign CRUD and reporting welded together, mainframe-style field names, error codes instead of HTTP
 * semantics, and a few quirks that the strangler must survive:
 * <ul>
 *   <li>CAMP_NM is CHAR(20): silently truncated and space padded.</li>
 *   <li>Reading a report mutates state (RUN_NO audit counter).</li>
 *   <li>Lists are wrapped as {ROW_CNT, ROWS}; errors are {ERR_CD, ERR_MSG}.</li>
 * </ul>
 */
public final class LegacyMonolith {
    private final TreeMap<Long, LegacyCampaign> db = new TreeMap<>(); // shared by campaigns AND reports
    private long seq = 1001;
    private int reportRuns;

    public LegacyMonolith() {
        put(null, "Summer Sale 2024", "1250.50", "USD", "A", "20240601");
        put(null, "Back To School", "5000.00", "USD", "A", "20240801");
        put(null, "Holiday Mega Promo Extended", "12000.00", "EUR", "S", "20241101");
        put(null, "Spring Clearance", "800.00", "USD", "C", "20240301");
        put(null, "Brand Awareness Q3", "3000.75", "MXN", "A", "20240701");
    }

    private static class Bad extends RuntimeException { Bad(String m) { super(m); } }

    private synchronized LegacyCampaign put(String id, String nm, String amt, String ccy, String stat, String dt) {
        if (nm == null || nm.isBlank()) throw new Bad("CAMP_NM required");
        if (stat == null || !stat.matches("[ASC]")) throw new Bad("STAT_CD must be A, S or C");
        try {
            LocalDate.parse(dt, DateTimeFormatter.BASIC_ISO_DATE);
            amt = new BigDecimal(amt).setScale(2, RoundingMode.HALF_UP).toPlainString();
        } catch (DateTimeParseException | NumberFormatException | NullPointerException e) {
            throw new Bad("bad START_DT or BUDGET_AMT");
        }
        long key = (id == null || id.isBlank()) ? seq : Long.parseLong(id.trim());
        seq = Math.max(seq, key + 1);
        String padded = String.format("%-20.20s", nm.strip()); // the CHAR(20) quirk
        LegacyCampaign row = new LegacyCampaign(Long.toString(key), padded, amt, ccy, stat, dt);
        db.put(key, row);
        return row;
    }

    public HttpServer start(int port) throws IOException {
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        s.createContext("/", this::handle);
        s.setExecutor(Executors.newCachedThreadPool());
        s.start();
        return s;
    }

    private void handle(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        String m = ex.getRequestMethod();
        try {
            if (path.equals("/campaigns") && m.equals("GET")) {
                synchronized (this) {
                    Http.reply(ex, 200, Json.write(Map.of("ROW_CNT", db.size(), "ROWS", db.values())), "X-Served-By", "legacy");
                }
            } else if (path.equals("/campaigns") && m.equals("POST")) {
                LegacyCampaign in = Json.read(Http.body(ex), LegacyCampaign.class);
                Http.reply(ex, 201, Json.write(put(in.campId(), in.campNm(), in.budgetAmt(), in.ccyCd(), in.statCd(), in.startDt())));
            } else if (path.startsWith("/campaigns/")) {
                long id = Long.parseLong(path.substring("/campaigns/".length()));
                if (m.equals("GET")) {
                    LegacyCampaign r;
                    synchronized (this) { r = db.get(id); }
                    if (r == null) Http.reply(ex, 404, Json.write(Map.of("ERR_CD", "E404", "ERR_MSG", "CAMP_ID not found")));
                    else Http.reply(ex, 200, Json.write(r));
                } else if (m.equals("PUT")) {
                    LegacyCampaign in = Json.read(Http.body(ex), LegacyCampaign.class);
                    Http.reply(ex, 200, Json.write(put(Long.toString(id), in.campNm(), in.budgetAmt(), in.ccyCd(), in.statCd(), in.startDt())));
                } else Http.reply(ex, 405, Json.write(Map.of("ERR_CD", "E405")));
            } else if (path.equals("/reports/spend") && m.equals("GET")) {
                Http.reply(ex, 200, Json.write(spendReport()), "X-Served-By", "legacy");
            } else {
                Http.reply(ex, 404, Json.write(Map.of("ERR_CD", "E404", "ERR_MSG", "no such program")));
            }
        } catch (Bad | IllegalArgumentException e) {
            Http.reply(ex, 400, Json.write(Map.of("ERR_CD", "E102", "ERR_MSG", String.valueOf(e.getMessage()))));
        } catch (RuntimeException e) {
            Http.reply(ex, 500, Json.write(Map.of("ERR_CD", "E999", "ERR_MSG", e.toString())));
        }
    }

    /** Reporting reads the SAME map the campaign code writes: this is the coupling we cut last. */
    private synchronized Map<String, Object> spendReport() {
        Map<String, BigDecimal> byCcy = new TreeMap<>();
        Map<String, Integer> byStat = new TreeMap<>();
        for (LegacyCampaign c : db.values()) {
            byStat.merge(c.statCd(), 1, Integer::sum);
            if (!c.statCd().equals("C")) byCcy.merge(c.ccyCd(), new BigDecimal(c.budgetAmt()), BigDecimal::add);
        }
        Map<String, String> ccy = new LinkedHashMap<>();
        byCcy.forEach((k, v) -> ccy.put(k, v.toPlainString()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("REPORT", "SPEND");
        out.put("RUN_NO", ++reportRuns); // reading a report mutates state
        out.put("ROW_CNT", db.size());
        out.put("BY_STAT", byStat);
        out.put("COMMITTED_BY_CCY", ccy);
        return out;
    }

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8081;
        new LegacyMonolith().start(port);
        System.out.println("legacy-monolith listening on " + port);
    }
}
