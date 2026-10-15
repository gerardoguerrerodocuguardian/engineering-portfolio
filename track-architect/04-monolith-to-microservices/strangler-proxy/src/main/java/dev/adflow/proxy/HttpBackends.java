package dev.adflow.proxy;

import com.fasterxml.jackson.databind.JsonNode;
import dev.adflow.common.Campaign;
import dev.adflow.common.CampaignAcl;
import dev.adflow.common.Http;
import dev.adflow.common.Json;
import dev.adflow.common.LegacyCampaign;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** HTTP implementations of {@link CampaignBackend}. */
public final class HttpBackends {
    private HttpBackends() {}

    private static Http.Resp call(String method, String url, String body) {
        try { return Http.call(method, url, body); }
        catch (IOException e) { throw new BackendException(method + " " + url + " failed: " + e, e); }
    }

    private static void ok(Http.Resp r, String what) {
        if (r.status() / 100 != 2) throw new BackendException(what + " -> HTTP " + r.status() + " " + r.body());
    }

    public static final class Legacy implements CampaignBackend {
        private final String base;
        public Legacy(String base) { this.base = base; }

        @Override public List<Campaign> list() {
            Http.Resp r = call("GET", base + "/campaigns", null);
            ok(r, "legacy list");
            List<Campaign> out = new ArrayList<>();
            for (JsonNode n : Json.tree(r.body()).get("ROWS"))
                out.add(CampaignAcl.toNew(Json.MAPPER.convertValue(n, LegacyCampaign.class)));
            return out;
        }
        @Override public Optional<Campaign> get(long id) {
            Http.Resp r = call("GET", base + "/campaigns/" + id, null);
            if (r.status() == 404) return Optional.empty();
            ok(r, "legacy get");
            return Optional.of(CampaignAcl.toNew(Json.read(r.body(), LegacyCampaign.class)));
        }
        @Override public Campaign create(Campaign c) {
            Http.Resp r = call("POST", base + "/campaigns", Json.write(CampaignAcl.toLegacy(c)));
            ok(r, "legacy create");
            return CampaignAcl.toNew(Json.read(r.body(), LegacyCampaign.class));
        }
        @Override public Campaign upsert(Campaign c) {
            Http.Resp r = call("PUT", base + "/campaigns/" + c.id(), Json.write(CampaignAcl.toLegacy(c)));
            ok(r, "legacy upsert");
            return CampaignAcl.toNew(Json.read(r.body(), LegacyCampaign.class));
        }
    }

    public static final class New implements CampaignBackend {
        private final String base;
        public New(String base) { this.base = base; }

        @Override public List<Campaign> list() {
            Http.Resp r = call("GET", base + "/campaigns", null);
            ok(r, "new list");
            return List.of(Json.read(r.body(), Campaign[].class));
        }
        @Override public Optional<Campaign> get(long id) {
            Http.Resp r = call("GET", base + "/campaigns/" + id, null);
            if (r.status() == 404) return Optional.empty();
            ok(r, "new get");
            return Optional.of(Json.read(r.body(), Campaign.class));
        }
        @Override public Campaign create(Campaign c) {
            Http.Resp r = call("POST", base + "/campaigns", Json.write(c));
            ok(r, "new create");
            return Json.read(r.body(), Campaign.class);
        }
        @Override public Campaign upsert(Campaign c) {
            Http.Resp r = call("PUT", base + "/campaigns/" + c.id(), Json.write(c));
            ok(r, "new upsert");
            return Json.read(r.body(), Campaign.class);
        }
    }
}
