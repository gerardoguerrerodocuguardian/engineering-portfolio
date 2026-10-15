package dev.adflow.proxy;

import dev.adflow.common.Campaign;
import java.util.List;
import java.util.Optional;

/** Both systems seen through the NEW model (the legacy one via the ACL). */
public interface CampaignBackend {
    List<Campaign> list();
    Optional<Campaign> get(long id);
    /** id == 0 lets the backend allocate one. */
    Campaign create(Campaign c);
    /** Insert-or-replace with an explicit id (dual-write, backfill, repair). */
    Campaign upsert(Campaign c);
}
