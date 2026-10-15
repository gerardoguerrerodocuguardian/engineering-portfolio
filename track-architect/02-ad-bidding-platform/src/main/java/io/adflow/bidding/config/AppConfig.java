package io.adflow.bidding.config;

import java.time.Clock;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
class AppConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    NewTopic adEventsTopic(@Value("${adflow.topics.ad-events}") String name) {
        return TopicBuilder.name(name).partitions(3).replicas(1).build();
    }

    @Bean
    NewTopic budgetEventsTopic(@Value("${adflow.topics.budget-events}") String name) {
        return TopicBuilder.name(name).partitions(3).replicas(1).build();
    }
}
