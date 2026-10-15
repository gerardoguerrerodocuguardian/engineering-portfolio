package com.adflow.billing.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.adflow.billing.client.TaxRateClient;
import com.adflow.billing.domain.Discount;
import com.adflow.billing.domain.InvalidInvoiceException;
import com.adflow.billing.domain.InvalidStateTransitionException;
import com.adflow.billing.domain.InvoiceLine;
import com.adflow.billing.domain.InvoiceStatus;
import com.adflow.billing.domain.Money;
import com.adflow.billing.persistence.InvoiceEntity;
import com.adflow.billing.persistence.InvoiceRepository;
import com.adflow.billing.persistence.UsageRecordEntity;
import com.adflow.billing.persistence.UsageRecordRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;

@ExtendWith(MockitoExtension.class)
class ServicesTest {

  private final Clock clock = Clock.fixed(Instant.parse("2026-05-01T10:00:00Z"), ZoneOffset.UTC);

  @Mock InvoiceRepository invoices;
  @Mock UsageRecordRepository usage;
  @Mock TaxRateClient taxClient;

  @Test
  void createCalculatesPersistsAndCountsMetric() {
    when(taxClient.rateBasisPoints("US-CA")).thenReturn(1_000);
    when(invoices.save(any(InvoiceEntity.class))).thenAnswer(i -> i.getArgument(0));
    var meters = new SimpleMeterRegistry();
    var service = new InvoiceService(invoices, new TaxRateService(taxClient), clock, meters);

    var view =
        service.create(
            new CreateInvoiceCommand(
                "adv-1",
                "US-CA",
                List.of(new InvoiceLine("cmp-1", "clicks", 10, Money.ofCents(100))),
                new Discount.FixedOff(Money.ofCents(200))));

    assertThat(view.subtotalCents()).isEqualTo(1_000);
    assertThat(view.discountCents()).isEqualTo(200);
    assertThat(view.taxCents()).isEqualTo(80);
    assertThat(view.totalCents()).isEqualTo(880);
    assertThat(view.status()).isEqualTo(InvoiceStatus.ISSUED);
    assertThat(view.createdAt()).isEqualTo(clock.instant());
    assertThat(meters.get("adflow.invoices.created").counter().count()).isEqualTo(1.0);
    assertThat(meters.get("adflow.invoices.create.time").timer().count()).isEqualTo(1);
    var captor = ArgumentCaptor.forClass(InvoiceEntity.class);
    verify(invoices).save(captor.capture());
    assertThat(captor.getValue().getAdvertiserId()).isEqualTo("adv-1");
  }

  @Test
  void invalidInvoiceIsNeverPersisted() {
    when(taxClient.rateBasisPoints("US")).thenReturn(500);
    var service =
        new InvoiceService(
            invoices, new TaxRateService(taxClient), clock, new SimpleMeterRegistry());

    assertThatThrownBy(
            () ->
                service.create(new CreateInvoiceCommand("a", "US", List.of(), new Discount.None())))
        .isInstanceOf(InvalidInvoiceException.class);
    verify(invoices, never()).save(any());
  }

  @Test
  void getAndVoidReportMissingInvoicesAsNotFound() {
    UUID id = UUID.randomUUID();
    when(invoices.findById(id)).thenReturn(Optional.empty());
    var service =
        new InvoiceService(
            invoices, new TaxRateService(taxClient), clock, new SimpleMeterRegistry());

    assertThatThrownBy(() -> service.get(id)).isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.voidInvoice(id)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void voidTransitionsStatusAndSecondVoidConflicts() {
    UUID id = UUID.randomUUID();
    var entity =
        new InvoiceEntity(
            id, "a", "US", InvoiceStatus.ISSUED, 1, 0, 0, 0, 1, clock.instant(), List.of());
    when(invoices.findById(id)).thenReturn(Optional.of(entity));
    var service =
        new InvoiceService(
            invoices, new TaxRateService(taxClient), clock, new SimpleMeterRegistry());

    assertThat(service.voidInvoice(id).status()).isEqualTo(InvoiceStatus.VOID);
    assertThatThrownBy(() -> service.voidInvoice(id))
        .isInstanceOf(InvalidStateTransitionException.class);
  }

  @Test
  void reportAggregatesAndZeroUsageCampaignIsNotFound() {
    when(usage.existsByCampaignId("c1")).thenReturn(true);
    when(usage.totalsFor("c1")).thenReturn(List.<Object[]>of(new Object[] {2000L, 50L, 1000L}));
    when(usage.existsByCampaignId("c2")).thenReturn(false);
    var service = new ReportService(usage, clock);

    var report = service.report("c1");

    assertThat(report.impressions()).isEqualTo(2000);
    assertThat(report.ctr()).isEqualTo(0.025);
    assertThatThrownBy(() -> service.report("c2")).isInstanceOf(NotFoundException.class);
  }

  @Test
  void recordUsageValidatesBeforeSaving() {
    var service = new ReportService(usage, clock);

    service.recordUsage("c1", 10, 2, 5);
    verify(usage).save(any(UsageRecordEntity.class));
    assertThatThrownBy(() -> service.recordUsage("c1", 1, 2, 5))
        .isInstanceOf(InvalidInvoiceException.class);
    verify(usage, org.mockito.Mockito.times(1)).save(any());
  }

  @Test
  void taxRateCacheAvoidsRepeatedRemoteCalls() {
    when(taxClient.rateBasisPoints("US-CA")).thenReturn(725);
    var cached = cachedProxy(new TaxRateService(taxClient));

    assertThat(cached.rateBasisPoints("US-CA")).isEqualTo(725);
    assertThat(cached.rateBasisPoints("US-CA")).isEqualTo(725);
    verify(taxClient, org.mockito.Mockito.times(1)).rateBasisPoints("US-CA");
  }

  private static TaxRateService cachedProxy(TaxRateService target) {
    var ctx = new org.springframework.context.annotation.AnnotationConfigApplicationContext();
    ctx.registerBean(TaxRateService.class, () -> target);
    ctx.register(CacheTestConfig.class);
    ctx.refresh();
    return ctx.getBean(TaxRateService.class);
  }

  @org.springframework.context.annotation.Configuration
  @org.springframework.cache.annotation.EnableCaching
  static class CacheTestConfig {
    @org.springframework.context.annotation.Bean
    org.springframework.cache.CacheManager cacheManager() {
      return new ConcurrentMapCacheManager(TaxRateService.CACHE);
    }
  }
}
