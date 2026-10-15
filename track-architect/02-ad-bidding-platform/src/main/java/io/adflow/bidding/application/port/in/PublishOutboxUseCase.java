package io.adflow.bidding.application.port.in;

public interface PublishOutboxUseCase {
    /** Publishes up to batchSize pending outbox messages; returns how many were published. */
    int publishPending(int batchSize);
}
