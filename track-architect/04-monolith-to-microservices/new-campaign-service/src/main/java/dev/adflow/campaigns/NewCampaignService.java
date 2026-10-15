package dev.adflow.campaigns;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.adflow.common.Campaign;
import dev.adflow.common.Http;
import dev.adflow.common.Json;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/** The extracted service. It owns campaigns, speaks only the NEW model, and has no idea the legacy exists. */
public final class NewCampaignService {
    private static final Set<String> STATUSES = Set.of("ACTIVE", "PAUSED", "ARCHIVED");
    private final ConcurrentSkipListMap<Long, Campaign> store = new ConcurrentSkipListMap<>();
    // Disjoint from the legacy id range (1001..) so both systems can allocate ids during coexistence.
    private final AtomicLong seq = new AtomicLong(5000);

    public HttpServer start(int port) throws IOException {
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        s.createContext("/", this::handle);
        s.setExecutor(Executors.newCachedThreadPool());
        s.start();
        return s;
    }

    private Campaign validate(Campaign c, long id) {
        if (c.name() == null || c.name().isBlank()) throw new IllegalArgumentException("name required");
        if (c.budget() == null || c.budget().amountMinor() < 0 || c.budget().currency() == null)
            throw new IllegalArgumentException("budget invalid");
        if (!STATUSES.contains(c.status())) throw new IllegalArgumentException("status invalid");
        try { LocalDate.parse(c.startDate()); }
        catch (DateTimeParseException | NullPointerException e) { throw new IllegalArgumentException("startDate must be ISO"); }
        return new Campaign(id, c.name().strip(), c.budget(), c.status(), c.startDate());
    }

    private void handle(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        String m = ex.getRequestMethod();
        try {
            if (path.equals("/campaigns") && m.equals("GET")) {
                Http.reply(ex, 200, Json.write(store.values()), "X-Served-By", "new");
            } else if (path.equals("/campaigns") && m.equals("POST")) {
                Campaign in = Json.read(Http.body(ex), Campaign.class);
                long id = in.id() > 0 ? in.id() : seq.incrementAndGet();
                if (in.id() > 0) seq.accumulateAndGet(in.id(), Math::max);
                Http.reply(ex, 201, Json.write(save(validate(in, id))));
            } else if (path.startsWith("/campaigns/")) {
                long id = Long.parseLong(path.substring("/campaigns/".length()));
                if (m.equals("GET")) {
                    Campaign c = store.get(id);
                    if (c == null) Http.reply(ex, 404, Json.write(Map.of("error", "campaign not found")));
                    else Http.reply(ex, 200, Json.write(c), "X-Served-By", "new");
                } else if (m.equals("PUT")) {
                    Http.reply(ex, 200, Json.write(save(validate(Json.read(Http.body(ex), Campaign.class), id))));
                } else Http.reply(ex, 405, Json.write(Map.of("error", "method not allowed")));
            } else {
                Http.reply(ex, 404, Json.write(Map.of("error", "not found")));
            }
        } catch (IllegalArgumentException e) {
            Http.reply(ex, 400, Json.write(Map.of("error", String.valueOf(e.getMessage()))));
        }
    }

    private Campaign save(Campaign c) {
        store.put(c.id(), c);
        return c;
    }

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8082;
        new NewCampaignService().start(port);
        System.out.println("new-campaign-service listening on " + port);
    }
}
