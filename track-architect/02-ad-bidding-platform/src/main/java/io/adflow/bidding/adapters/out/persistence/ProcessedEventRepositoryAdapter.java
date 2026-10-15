package io.adflow.bidding.adapters.out.persistence;

import io.adflow.bidding.application.port.out.ProcessedEventRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class ProcessedEventRepositoryAdapter implements ProcessedEventRepository {

    private final SpringDataRepositories.ProcessedEventJpa jpa;
    private final Clock clock;

    ProcessedEventRepositoryAdapter(SpringDataRepositories.ProcessedEventJpa jpa, Clock clock) {
        this.jpa = jpa;
        this.clock = clock;
    }

    @Override
    public boolean markProcessed(UUID eventId) {
        if (jpa.existsById(eventId)) {
            return false;
        }
        // A concurrent insert of the same id violates the PK; the transaction rolls back and the
        // redelivered message is then detected as a duplicate.
        jpa.saveAndFlush(new ProcessedEventEntity(eventId, clock.instant()));
        return true;
    }
}
