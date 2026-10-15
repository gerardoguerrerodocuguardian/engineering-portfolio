package io.adflow.bidding.adapters.in.scheduler;

import io.adflow.bidding.application.port.in.PublishOutboxUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class OutboxPoller {

    private static final Logger log = LoggerFactory.getLogger(OutboxPoller.class);

    private final PublishOutboxUseCase relay;
    private final int batchSize;

    OutboxPoller(PublishOutboxUseCase relay, @Value("${adflow.outbox.batch-size:50}") int batchSize) {
        this.relay = relay;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${adflow.outbox.poll-interval-ms:500}")
    void poll() {
        try {
            int published = relay.publishPending(batchSize);
            if (published > 0) {
                log.info("Published {} outbox message(s)", published);
            }
        } catch (RuntimeException e) {
            log.warn("Outbox publish failed, will retry: {}", e.getMessage());
        }
    }
}
