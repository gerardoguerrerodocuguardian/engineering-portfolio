package io.adflow.bidding.application.port.out;

import java.util.UUID;

public interface ProcessedEventRepository {
    /** Records the eventId; returns false if it was already recorded (duplicate delivery). */
    boolean markProcessed(UUID eventId);
}
