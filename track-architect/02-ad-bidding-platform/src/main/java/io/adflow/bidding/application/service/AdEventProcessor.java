package io.adflow.bidding.application.service;

import io.adflow.bidding.application.port.in.ProcessAdEventUseCase;
import io.adflow.bidding.application.port.out.CampaignRepository;
import io.adflow.bidding.application.port.out.OutboxRepository;
import io.adflow.bidding.application.port.out.ProcessedEventRepository;
import io.adflow.bidding.domain.AdEvent;
import io.adflow.bidding.domain.BudgetExhausted;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dedupe + budget charge + outbox append happen in ONE local transaction, so a crash can never
 * leave a charged budget without its dedupe marker or a missing BudgetExhausted message.
 */
@Service
public class AdEventProcessor implements ProcessAdEventUseCase {

    private final ProcessedEventRepository processed;
    private final CampaignRepository campaigns;
    private final OutboxRepository outbox;
    private final Clock clock;

    public AdEventProcessor(ProcessedEventRepository processed, CampaignRepository campaigns,
                            OutboxRepository outbox, Clock clock) {
        this.processed = processed;
        this.campaigns = campaigns;
        this.outbox = outbox;
        this.clock = clock;
    }

    @Override
    @Transactional
    public Result process(AdEvent event) {
        if (!processed.markProcessed(event.eventId())) {
            return Result.DUPLICATE;
        }
        var campaign = campaigns.findByIdForUpdate(event.campaignId());
        if (campaign.isEmpty()) {
            return Result.UNKNOWN_CAMPAIGN;
        }
        var c = campaign.get();
        boolean exhausted = c.charge(event.costCents());
        campaigns.save(c);
        if (exhausted) {
            outbox.append(new BudgetExhausted(UUID.randomUUID(), c.id(), clock.instant()));
        }
        return Result.APPLIED;
    }
}
