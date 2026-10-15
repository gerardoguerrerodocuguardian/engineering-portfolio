package io.adflow.pipeline.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.google.api.gax.core.NoCredentialsProvider;
import com.google.api.gax.grpc.GrpcTransportChannel;
import com.google.api.gax.rpc.FixedTransportChannelProvider;
import com.google.cloud.pubsub.v1.Publisher;
import com.google.cloud.pubsub.v1.SubscriptionAdminClient;
import com.google.cloud.pubsub.v1.SubscriptionAdminSettings;
import com.google.cloud.pubsub.v1.TopicAdminClient;
import com.google.cloud.pubsub.v1.TopicAdminSettings;
import com.google.protobuf.ByteString;
import com.google.pubsub.v1.PubsubMessage;
import com.google.pubsub.v1.PushConfig;
import com.google.pubsub.v1.SubscriptionName;
import com.google.pubsub.v1.TopicName;
import io.adflow.pipeline.adapter.in.PubSubEventSource;
import io.adflow.pipeline.adapter.out.InMemoryAggregateSink;
import io.adflow.pipeline.adapter.out.InMemoryDedupeStore;
import io.adflow.pipeline.application.AdEventParser;
import io.adflow.pipeline.application.EventProcessor;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PubSubEmulatorContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** Skipped automatically when Docker is not available. */
@Testcontainers(disabledWithoutDocker = true)
class PubSubEmulatorIT {

    @Container
    static final PubSubEmulatorContainer EMULATOR = new PubSubEmulatorContainer(
            DockerImageName.parse("gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators"));

    @Test
    void duplicatePublishesAreAggregatedOnce() throws Exception {
        String host = EMULATOR.getEmulatorEndpoint();
        ManagedChannel ch = ManagedChannelBuilder.forTarget(host).usePlaintext().build();
        var tcp = FixedTransportChannelProvider.create(GrpcTransportChannel.create(ch));
        var creds = NoCredentialsProvider.create();
        TopicName topic = TopicName.of("test-project", "ad-events");
        SubscriptionName sub = SubscriptionName.of("test-project", "ad-events-sub");
        try (TopicAdminClient ta = TopicAdminClient.create(
                     TopicAdminSettings.newBuilder().setTransportChannelProvider(tcp).setCredentialsProvider(creds).build());
             SubscriptionAdminClient sa = SubscriptionAdminClient.create(
                     SubscriptionAdminSettings.newBuilder().setTransportChannelProvider(tcp).setCredentialsProvider(creds).build())) {
            ta.createTopic(topic);
            sa.createSubscription(sub, topic, PushConfig.getDefaultInstance(), 10);
        }

        InMemoryAggregateSink sink = new InMemoryAggregateSink();
        EventProcessor processor = new EventProcessor(new AdEventParser(), new InMemoryDedupeStore(100), sink);
        PubSubEventSource source = new PubSubEventSource("test-project", "ad-events-sub", host);
        source.start(processor::process);

        Publisher publisher = Publisher.newBuilder(topic).setChannelProvider(tcp).setCredentialsProvider(creds).build();
        String msg = "{\"eventId\":\"" + UUID.randomUUID() + "\",\"type\":\"CLICK\",\"campaignId\":\"c1\","
                + "\"costCents\":40,\"occurredAt\":\"2026-03-01T10:00:00Z\"}";
        for (int i = 0; i < 2; i++) { // simulate a producer resend
            publisher.publish(PubsubMessage.newBuilder().setData(ByteString.copyFromUtf8(msg)).build()).get();
        }
        try {
            await().atMost(Duration.ofSeconds(30)).untilAsserted(() ->
                    assertThat(sink.find("c1", LocalDate.parse("2026-03-01"))).isPresent());
            Thread.sleep(1500);
            assertThat(sink.find("c1", LocalDate.parse("2026-03-01")).orElseThrow().costCents()).isEqualTo(40);
        } finally {
            source.stop();
            publisher.shutdown();
            ch.shutdownNow();
        }
    }
}
