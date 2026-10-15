package com.adflow.billing.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.adflow.billing.domain.InvoiceStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

/** Slice test: JPA mappings validated against the real Flyway schema (H2 in PostgreSQL mode). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class InvoiceRepositoryTest {

  @Autowired InvoiceRepository invoices;
  @Autowired UsageRecordRepository usage;
  @Autowired TestEntityManager em;

  private InvoiceEntity invoice(String advertiser, Instant createdAt) {
    return new InvoiceEntity(
        UUID.randomUUID(),
        advertiser,
        "US-CA",
        InvoiceStatus.ISSUED,
        100,
        0,
        825,
        8,
        108,
        createdAt,
        List.of(new InvoiceLineEntity("cmp-1", "clicks", 1, 100)));
  }

  @Test
  void persistsInvoiceWithLinesAndReadsThemBack() {
    var saved = invoices.saveAndFlush(invoice("adv-repo-1", Instant.parse("2026-01-01T00:00:00Z")));
    em.clear();

    var loaded = invoices.findById(saved.getId()).orElseThrow();

    assertThat(loaded.getTotalCents()).isEqualTo(108);
    assertThat(loaded.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
    assertThat(loaded.getLines())
        .singleElement()
        .satisfies(
            l -> {
              assertThat(l.getCampaignId()).isEqualTo("cmp-1");
              assertThat(l.getDescription()).isEqualTo("clicks");
              assertThat(l.getQuantity()).isEqualTo(1);
              assertThat(l.getUnitPriceCents()).isEqualTo(100);
            });
    assertThat(loaded.getRegion()).isEqualTo("US-CA");
    assertThat(loaded.getSubtotalCents()).isEqualTo(100);
    assertThat(loaded.getDiscountCents()).isZero();
    assertThat(loaded.getTaxRateBps()).isEqualTo(825);
    assertThat(loaded.getTaxCents()).isEqualTo(8);
  }

  @Test
  void findsByAdvertiserNewestFirst() {
    invoices.save(invoice("adv-repo-1", Instant.parse("2026-01-01T00:00:00Z")));
    invoices.save(invoice("adv-repo-1", Instant.parse("2026-02-01T00:00:00Z")));
    invoices.save(invoice("adv-repo-2", Instant.parse("2026-03-01T00:00:00Z")));

    var result = invoices.findByAdvertiserIdOrderByCreatedAtDesc("adv-repo-1");

    assertThat(result)
        .extracting(InvoiceEntity::getCreatedAt)
        .containsExactly(
            Instant.parse("2026-02-01T00:00:00Z"), Instant.parse("2026-01-01T00:00:00Z"));
  }

  @Test
  void aggregatesUsagePerCampaign() {
    var now = Instant.now();
    usage.save(new UsageRecordEntity("c1", 100, 5, 50, now));
    usage.save(new UsageRecordEntity("c1", 200, 15, 150, now));
    usage.save(new UsageRecordEntity("c2", 999, 9, 999, now));

    Object[] totals = usage.totalsFor("c1").get(0);

    assertThat(((Number) totals[0]).longValue()).isEqualTo(300);
    assertThat(((Number) totals[1]).longValue()).isEqualTo(20);
    assertThat(((Number) totals[2]).longValue()).isEqualTo(200);
    assertThat(usage.existsByCampaignId("c1")).isTrue();
    assertThat(usage.existsByCampaignId("nope")).isFalse();
    var one = usage.findAll().get(0);
    assertThat(one.getImpressions()).isPositive();
    assertThat(one.getClicks()).isPositive();
    assertThat(one.getSpendCents()).isPositive();
  }

  @Test
  void databaseRejectsNegativeMoneyEvenIfTheDomainWereBypassed() {
    var bad =
        new InvoiceEntity(
            UUID.randomUUID(),
            "a",
            "US",
            InvoiceStatus.ISSUED,
            -1,
            0,
            0,
            0,
            0,
            Instant.now(),
            List.of());
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> invoices.saveAndFlush(bad))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
  }
}
