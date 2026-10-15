package io.adflow.pipeline.config;

import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.BigQueryOptions;
import io.adflow.pipeline.adapter.in.InMemoryEventSource;
import io.adflow.pipeline.adapter.in.KafkaEventSourceStub;
import io.adflow.pipeline.adapter.in.PubSubEventSource;
import io.adflow.pipeline.adapter.out.BigQueryAggregateSink;
import io.adflow.pipeline.adapter.out.DuckDbAggregateSink;
import io.adflow.pipeline.adapter.out.InMemoryAggregateSink;
import io.adflow.pipeline.adapter.out.InMemoryDedupeStore;
import io.adflow.pipeline.application.AdEventParser;
import io.adflow.pipeline.application.EventProcessor;
import io.adflow.pipeline.application.port.AggregateSink;
import io.adflow.pipeline.application.port.DedupeStore;
import io.adflow.pipeline.application.port.EventSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Adapter selection by property: adflow.source = memory (default) | pubsub | kafka,
 * adflow.sink = memory (default) | duckdb | bigquery.
 */
@Configuration
public class PipelineConfig {

    @Bean
    @ConditionalOnProperty(name = "adflow.sink", havingValue = "memory", matchIfMissing = true)
    AggregateSink inMemorySink() { return new InMemoryAggregateSink(); }

    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(name = "adflow.sink", havingValue = "duckdb")
    DuckDbAggregateSink duckDbSink(@Value("${adflow.duckdb.url:jdbc:duckdb:}") String url) {
        return new DuckDbAggregateSink(url);
    }

    @Bean
    @ConditionalOnProperty(name = "adflow.sink", havingValue = "bigquery")
    AggregateSink bigQuerySink(@Value("${adflow.gcp.project}") String project,
                               @Value("${adflow.bigquery.dataset}") String dataset) {
        BigQuery bq = BigQueryOptions.newBuilder().setProjectId(project).build().getService(); // ADC
        return new BigQueryAggregateSink(bq, project, dataset);
    }

    @Bean
    DedupeStore dedupeStore(@Value("${adflow.dedupe.max-entries:100000}") int max) {
        return new InMemoryDedupeStore(max);
    }

    @Bean
    EventProcessor eventProcessor(DedupeStore dedupe, AggregateSink sink) {
        return new EventProcessor(new AdEventParser(), dedupe, sink);
    }

    @Bean
    @ConditionalOnProperty(name = "adflow.source", havingValue = "memory", matchIfMissing = true)
    EventSource inMemorySource() { return new InMemoryEventSource(); }

    @Bean
    @ConditionalOnProperty(name = "adflow.source", havingValue = "pubsub")
    EventSource pubSubSource(@Value("${adflow.gcp.project}") String project,
                             @Value("${adflow.pubsub.subscription}") String subscription,
                             @Value("${adflow.pubsub.emulator-host:}") String emulator) {
        return new PubSubEventSource(project, subscription, emulator);
    }

    @Bean
    @ConditionalOnProperty(name = "adflow.source", havingValue = "kafka")
    EventSource kafkaSource() { return new KafkaEventSourceStub(); }

    @Bean
    SmartLifecycle sourceLifecycle(EventSource source, EventProcessor processor) {
        return new SmartLifecycle() {
            private volatile boolean running;
            @Override public void start() { source.start(processor::process); running = true; }
            @Override public void stop() { source.stop(); running = false; }
            @Override public boolean isRunning() { return running; }
        };
    }
}
