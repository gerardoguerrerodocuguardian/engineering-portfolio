package io.adflow.bidding.application.service;

import io.adflow.bidding.application.port.in.DecideBidUseCase;
import io.adflow.bidding.application.port.out.CampaignRepository;
import io.adflow.bidding.domain.BidDecision;
import io.adflow.bidding.domain.BidEngine;
import java.util.Collection;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BidService implements DecideBidUseCase {

    private final CampaignRepository campaigns;

    public BidService(CampaignRepository campaigns) {
        this.campaigns = campaigns;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BidDecision> decide(Collection<String> keywords) {
        return BidEngine.decide(campaigns.findAll(), keywords);
    }
}
