package io.adflow.bidding.application.service;

import io.adflow.bidding.application.port.in.PublishOutboxUseCase;
import io.adflow.bidding.application.port.out.BudgetEventPublisher;
import io.adflow.bidding.application.port.out.OutboxRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Relays pending outbox rows to the broker. Delivery is at-least-once: if the process dies after
 * publish but before commit, the row is re-published (consumers dedupe on eventId).
 */
@Service
public class OutboxRelay implements PublishOutboxUseCase {

    private final OutboxRepository outbox;
    private final BudgetEventPublisher publisher;

    public OutboxRelay(OutboxRepository outbox, BudgetEventPublisher publisher) {
        this.outbox = outbox;
        this.publisher = publisher;
    }

    @Override
    @Transactional
    public int publishPending(int batchSize) {
        int count = 0;
        for (var message : outbox.lockPending(batchSize)) {
            publisher.publish(message);
            outbox.markPublished(message.id());
            count++;
        }
        return count;
    }
}
