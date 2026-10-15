package com.adflow.billing;

import static org.assertj.core.api.Assertions.assertThat;

import com.adflow.billing.client.TaxRateClient;
import com.adflow.billing.domain.Discount;
import com.adflow.billing.domain.InvoiceLine;
import com.adflow.billing.domain.Money;
import com.adflow.billing.service.CreateInvoiceCommand;
import com.adflow.billing.service.InvoiceService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Runs the Flyway migration and the JPA mappings against a real PostgreSQL. Skipped automatically
 * when Docker is not available.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@Import(TestSecurityConfig.class)
class PostgresContainerIT {

  @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", pg::getJdbcUrl);
    r.add("spring.datasource.username", pg::getUsername);
    r.add("spring.datasource.password", pg::getPassword);
    r.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
  }

  @MockBean TaxRateClient taxClient;
  @Autowired InvoiceService service;
  @Autowired JdbcTemplate jdbc;

  @Test
  void migrationsApplyAndInvoiceRoundTripsOnPostgres() {
    org.mockito.Mockito.when(taxClient.rateBasisPoints("US-CA")).thenReturn(825);

    var view =
        service.create(
            new CreateInvoiceCommand(
                "adv-pg",
                "US-CA",
                List.of(new InvoiceLine("cmp-1", "clicks", 100, Money.ofCents(100))),
                new Discount.None()));

    assertThat(service.get(view.id()).totalCents()).isEqualTo(10_825);
    assertThat(jdbc.queryForObject("select count(*) from invoice_line", Integer.class))
        .isEqualTo(1);
  }
}
