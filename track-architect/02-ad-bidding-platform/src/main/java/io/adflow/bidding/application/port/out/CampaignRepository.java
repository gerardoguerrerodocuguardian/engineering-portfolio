package io.adflow.bidding.application.port.out;

import io.adflow.bidding.domain.Campaign;
import java.util.List;
import java.util.Optional;

public interface CampaignRepository {
    /** Loads the campaign with a write lock held until the surrounding transaction ends. */
    Optional<Campaign> findByIdForUpdate(String campaignId);

    List<Campaign> findAll();

    void save(Campaign campaign);
}
