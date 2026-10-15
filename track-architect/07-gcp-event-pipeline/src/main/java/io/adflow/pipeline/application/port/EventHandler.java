package io.adflow.pipeline.application.port;

import io.adflow.pipeline.application.ProcessingResult;

@FunctionalInterface
public interface EventHandler {
    /** Throws on transient failure; the adapter must then nack so the broker redelivers. */
    ProcessingResult handle(String payload);
}
