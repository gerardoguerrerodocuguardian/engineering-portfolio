package io.adflow.pipeline.application.port;

/** Inbound port: any transport (Pub/Sub, Kafka, in-memory) that delivers raw payloads. */
public interface EventSource {

    void start(EventHandler handler);

    void stop();
}
