package io.adflow.pipeline.adapter.in;

import io.adflow.pipeline.application.ProcessingResult;
import io.adflow.pipeline.application.port.EventHandler;
import io.adflow.pipeline.application.port.EventSource;

/** Test/local transport: push payloads by hand, with at-least-once style redelivery on failure. */
public class InMemoryEventSource implements EventSource {

    private EventHandler handler;

    @Override public void start(EventHandler handler) { this.handler = handler; }

    @Override public void stop() { this.handler = null; }

    /** @return true when the message would be acked, false when it would be nacked. */
    public boolean deliver(String payload) {
        if (handler == null) throw new IllegalStateException("not started");
        try {
            return handler.handle(payload) != ProcessingResult.REJECTED;
        } catch (RuntimeException e) {
            return false;
        }
    }
}
