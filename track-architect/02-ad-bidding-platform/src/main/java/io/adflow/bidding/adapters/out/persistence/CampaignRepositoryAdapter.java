package io.adflow.bidding.adapters.out.persistence;

import io.adflow.bidding.application.port.out.CampaignRepository;
import io.adflow.bidding.domain.Campaign;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class CampaignRepositoryAdapter implements CampaignRepository {

    private final SpringDataRepositories.CampaignJpa jpa;

    CampaignRepositoryAdapter(SpringDataRepositories.CampaignJpa jpa) {
        this.jpa = jpa;
    }

    @Override
    public Optional<Campaign> findByIdForUpdate(String campaignId) {
        return jpa.findForUpdate(campaignId).map(CampaignRepositoryAdapter::toDomain);
    }

    @Override
    public List<Campaign> findAll() {
        return jpa.findAll().stream().map(CampaignRepositoryAdapter::toDomain).toList();
    }

    @Override
    public void save(Campaign campaign) {
        var entity = jpa.findById(campaign.id()).orElseThrow();
        entity.spentCents = campaign.spentCents();
        jpa.save(entity);
    }

    private static Campaign toDomain(CampaignEntity e) {
        return new Campaign(e.id, Arrays.asList(e.keywords.split(",")), e.maxBidCents, e.budgetCents, e.spentCents);
    }
}
