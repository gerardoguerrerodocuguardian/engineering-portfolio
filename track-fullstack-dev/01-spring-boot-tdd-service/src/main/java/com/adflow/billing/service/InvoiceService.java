package com.adflow.billing.service;

import com.adflow.billing.domain.InvoiceCalculator;
import com.adflow.billing.domain.InvoiceStatus;
import com.adflow.billing.domain.InvoiceTotals;
import com.adflow.billing.persistence.InvoiceEntity;
import com.adflow.billing.persistence.InvoiceLineEntity;
import com.adflow.billing.persistence.InvoiceRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Clock;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceService {

  private static final Logger log = LoggerFactory.getLogger(InvoiceService.class);

  private final InvoiceRepository invoices;
  private final TaxRateService taxRates;
  private final Clock clock;
  private final MeterRegistry meters;

  public InvoiceService(
      InvoiceRepository invoices, TaxRateService taxRates, Clock clock, MeterRegistry meters) {
    this.invoices = invoices;
    this.taxRates = taxRates;
    this.clock = clock;
    this.meters = meters;
  }

  @Transactional
  public InvoiceView create(CreateInvoiceCommand cmd) {
    Timer.Sample sample = Timer.start(meters);
    int rate = taxRates.rateBasisPoints(cmd.region());
    InvoiceTotals t = InvoiceCalculator.calculate(cmd.lines(), cmd.discount(), rate);
    var lineEntities =
        cmd.lines().stream()
            .map(
                l ->
                    new InvoiceLineEntity(
                        l.campaignId(), l.description(), l.quantity(), l.unitPrice().cents()))
            .toList();
    var entity =
        new InvoiceEntity(
            UUID.randomUUID(),
            cmd.advertiserId(),
            cmd.region(),
            InvoiceStatus.ISSUED,
            t.subtotal().cents(),
            t.discount().cents(),
            rate,
            t.tax().cents(),
            t.total().cents(),
            clock.instant(),
            lineEntities);
    InvoiceView view = toView(invoices.save(entity));
    meters.counter("adflow.invoices.created", "region", cmd.region()).increment();
    sample.stop(meters.timer("adflow.invoices.create.time"));
    log.info(
        "invoice created id={} advertiser={} totalCents={}",
        view.id(),
        view.advertiserId(),
        view.totalCents());
    return view;
  }

  @Transactional(readOnly = true)
  public InvoiceView get(UUID id) {
    return invoices.findById(id).map(InvoiceService::toView).orElseThrow(() -> notFound(id));
  }

  @Transactional
  public InvoiceView voidInvoice(UUID id) {
    InvoiceEntity entity = invoices.findById(id).orElseThrow(() -> notFound(id));
    entity.setStatus(entity.getStatus().voided());
    log.info("invoice voided id={}", id);
    return toView(entity);
  }

  private static NotFoundException notFound(UUID id) {
    return new NotFoundException("invoice", id);
  }

  private static InvoiceView toView(InvoiceEntity e) {
    return new InvoiceView(
        e.getId(),
        e.getAdvertiserId(),
        e.getRegion(),
        e.getStatus(),
        e.getSubtotalCents(),
        e.getDiscountCents(),
        e.getTaxRateBps(),
        e.getTaxCents(),
        e.getTotalCents(),
        e.getCreatedAt(),
        e.getLines().stream()
            .map(
                l ->
                    new InvoiceView.Line(
                        l.getCampaignId(),
                        l.getDescription(),
                        l.getQuantity(),
                        l.getUnitPriceCents()))
            .toList());
  }
}
