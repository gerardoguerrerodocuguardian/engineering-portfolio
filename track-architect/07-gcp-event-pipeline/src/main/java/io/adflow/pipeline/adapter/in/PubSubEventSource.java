package io.adflow.pipeline.adapter.in;

import com.google.api.gax.core.CredentialsProvider;
import com.google.api.gax.core.NoCredentialsProvider;
import com.google.api.gax.grpc.GrpcTransportChannel;
import com.google.api.gax.rpc.FixedTransportChannelProvider;
import com.google.api.gax.rpc.TransportChannelProvider;
import com.google.cloud.pubsub.v1.AckReplyConsumer;
import com.google.cloud.pubsub.v1.MessageReceiver;
import com.google.cloud.pubsub.v1.Subscriber;
import com.google.pubsub.v1.ProjectSubscriptionName;
import com.google.pubsub.v1.PubsubMessage;
import io.adflow.pipeline.application.ProcessingResult;
import io.adflow.pipeline.application.port.EventHandler;
import io.adflow.pipeline.application.port.EventSource;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Streaming-pull adapter. ack on PROCESSED/DUPLICATE; nack on exceptions and REJECTED so the
 * subscription's dead-letter policy (max delivery attempts) moves poison messages to the DLQ topic.
 * With ordering enabled on the subscription, messages sharing an ordering key (campaignId) are
 * delivered one at a time and in order; a nack therefore blocks that key until redelivery succeeds.
 */
public class PubSubEventSource implements EventSource {

    private static final Logger log = LoggerFactory.getLogger(PubSubEventSource.class);

    private final String project;
    private final String subscription;
    private final String emulatorHost; // null/blank = real Pub/Sub with ADC (Workload identity on Cloud Run)
    private Subscriber subscriber;
    private ManagedChannel channel;

    public PubSubEventSource(String project, String subscription, String emulatorHost) {
        this.project = project;
        this.subscription = subscription;
        this.emulatorHost = emulatorHost;
    }

    @Override
    public void start(EventHandler handler) {
        MessageReceiver receiver = (PubsubMessage msg, AckReplyConsumer consumer) -> {
            try {
                ProcessingResult r = handler.handle(msg.getData().toStringUtf8());
                if (r == ProcessingResult.REJECTED) consumer.nack(); else consumer.ack();
            } catch (RuntimeException e) {
                log.error("processing failed, nacking (ordering key={})", msg.getOrderingKey(), e);
                consumer.nack();
            }
        };
        Subscriber.Builder b = Subscriber.newBuilder(ProjectSubscriptionName.of(project, subscription), receiver);
        if (emulatorHost != null && !emulatorHost.isBlank()) {
            channel = ManagedChannelBuilder.forTarget(emulatorHost).usePlaintext().build();
            TransportChannelProvider tcp = FixedTransportChannelProvider.create(GrpcTransportChannel.create(channel));
            CredentialsProvider none = NoCredentialsProvider.create();
            b.setChannelProvider(tcp).setCredentialsProvider(none);
        }
        subscriber = b.build();
        subscriber.startAsync().awaitRunning();
    }

    @Override
    public void stop() {
        if (subscriber != null) subscriber.stopAsync().awaitTerminated();
        if (channel != null) channel.shutdownNow();
    }
}
