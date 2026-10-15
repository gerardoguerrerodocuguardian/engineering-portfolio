package io.adflow.bidding.application.port.out;

public interface BudgetEventPublisher {
    /** Publishes synchronously; throws on failure so the outbox row stays pending. */
    void publish(OutboxRepository.OutboxMessage message);
}
