package io.adflow.pipeline.application.port;

import java.util.UUID;

/** Outbound port: fast-path duplicate filter. The sink stays the authoritative guard. */
public interface DedupeStore {

    /** @return true if the id was not seen before (and is now remembered). */
    boolean markIfNew(UUID eventId);

    /** Forget an id so a failed write can be retried after redelivery. */
    void forget(UUID eventId);
}
