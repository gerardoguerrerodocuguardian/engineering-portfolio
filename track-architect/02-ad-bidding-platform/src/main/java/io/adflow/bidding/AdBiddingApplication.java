package io.adflow.bidding;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
// The Spring Data interfaces are package-private nested types of SpringDataRepositories on purpose
// (they are an implementation detail of the persistence adapters), so nested scanning must be enabled.
@EnableJpaRepositories(considerNestedRepositories = true)
public class AdBiddingApplication {
    public static void main(String[] args) {
        SpringApplication.run(AdBiddingApplication.class, args);
    }
}
