package io.adflow.bidding.application.port.out;

import io.adflow.bidding.domain.BudgetExhausted;
import java.util.List;

public interface OutboxRepository {

    record OutboxMessage(java.util.UUID id, String key, String payload) {
    }

    void append(BudgetExhausted event);

    /** Locks and returns unpublished messages (oldest first); other pollers skip locked rows. */
    List<OutboxMessage> lockPending(int limit);

    void markPublished(java.util.UUID id);
}
