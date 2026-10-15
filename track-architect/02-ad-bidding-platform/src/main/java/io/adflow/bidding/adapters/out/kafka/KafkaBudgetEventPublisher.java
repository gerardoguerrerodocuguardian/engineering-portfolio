package io.adflow.bidding.adapters.out.kafka;

import io.adflow.bidding.application.port.out.BudgetEventPublisher;
import io.adflow.bidding.application.port.out.OutboxRepository.OutboxMessage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
class KafkaBudgetEventPublisher implements BudgetEventPublisher {

    private final KafkaTemplate<String, String> template;
    private final String topic;

    KafkaBudgetEventPublisher(KafkaTemplate<String, String> template,
                              @Value("${adflow.topics.budget-events}") String topic) {
        this.template = template;
        this.topic = topic;
    }

    @Override
    public void publish(OutboxMessage message) {
        try {
            template.send(topic, message.key(), message.payload()).get(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while publishing", e);
        } catch (ExecutionException | TimeoutException e) {
            throw new IllegalStateException("publish failed for outbox " + message.id(), e);
        }
    }
}
