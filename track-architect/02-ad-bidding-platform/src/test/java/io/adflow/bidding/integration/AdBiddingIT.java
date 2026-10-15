package io.adflow.bidding.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** End-to-end: Kafka in, Postgres, outbox out. Skipped automatically when Docker is unavailable. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AdBiddingIT {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static final KafkaContainer KAFKA = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.1"));

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
    }

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TestRestTemplate rest;

    private static String event(UUID id, String type, String campaign, long cost) {
        return """
                {"eventId":"%s","type":"%s","campaignId":"%s","costCents":%d,"occurredAt":"2026-01-01T00:00:00Z"}
                """.formatted(id, type, campaign, cost);
    }

    @Test
    void duplicatesAreIgnoredAndExhaustionIsPublishedOnceViaOutbox() {
        jdbc.update("insert into campaign (id, keywords, max_bid_cents, budget_cents, spent_cents) "
                + "values ('it-cmp', 'it-keyword', 50, 100, 0)");
        var dup = UUID.randomUUID();

        try (var producer = new KafkaProducer<String, String>(Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class,
                ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class))) {
            for (String payload : List.of(
                    event(dup, "IMPRESSION", "it-cmp", 40),
                    event(dup, "IMPRESSION", "it-cmp", 40),
                    event(UUID.randomUUID(), "CLICK", "it-cmp", 40))) {
                producer.send(new ProducerRecord<>("adflow.ad-events", "it-cmp", payload));
            }
            producer.flush();
        }

        await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> assertThat(
                jdbc.queryForObject("select spent_cents from campaign where id='it-cmp'", Long.class))
                .isEqualTo(80L));

        // bid still available with remaining budget 20
        var bid = rest.postForObject("/v1/bids", Map.of("keywords", List.of("IT-Keyword")), Map.class);
        assertThat(bid).containsEntry("won", true).containsEntry("campaignId", "it-cmp")
                .containsEntry("remainingBudgetCents", 20).containsEntry("bidCents", 20);

        try (var producer = new KafkaProducer<String, String>(Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class,
                ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class))) {
            producer.send(new ProducerRecord<>("adflow.ad-events", "it-cmp",
                    event(UUID.randomUUID(), "IMPRESSION", "it-cmp", 30)));
            producer.flush();
        }

        try (var consumer = new KafkaConsumer<String, String>(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA.getBootstrapServers(),
                ConsumerConfig.GROUP_ID_CONFIG, "it-verifier",
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class))) {
            consumer.subscribe(List.of("adflow.budget-events"));
            var received = new java.util.ArrayList<String>();
            await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> {
                consumer.poll(Duration.ofMillis(500)).forEach(rec -> received.add(rec.value()));
                assertThat(received).hasSize(1);
            });
            assertThat(received.get(0)).contains("\"campaignId\":\"it-cmp\"");
        }

        assertThat(jdbc.queryForObject("select count(*) from outbox where aggregate_id='it-cmp'", Long.class))
                .isEqualTo(1L);
    }
}
