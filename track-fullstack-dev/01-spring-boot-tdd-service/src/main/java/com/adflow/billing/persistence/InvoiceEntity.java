package com.adflow.billing.persistence;

import com.adflow.billing.domain.InvoiceStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "invoice")
public class InvoiceEntity {

  @Id private UUID id;

  @Column(name = "advertiser_id", nullable = false)
  private String advertiserId;

  @Column(nullable = false)
  private String region;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private InvoiceStatus status;

  @Column(name = "subtotal_cents", nullable = false)
  private long subtotalCents;

  @Column(name = "discount_cents", nullable = false)
  private long discountCents;

  @Column(name = "tax_rate_bps", nullable = false)
  private int taxRateBps;

  @Column(name = "tax_cents", nullable = false)
  private long taxCents;

  @Column(name = "total_cents", nullable = false)
  private long totalCents;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
  @JoinColumn(name = "invoice_id", nullable = false)
  private List<InvoiceLineEntity> lines = new ArrayList<>();

  protected InvoiceEntity() {}

  public InvoiceEntity(
      UUID id,
      String advertiserId,
      String region,
      InvoiceStatus status,
      long subtotalCents,
      long discountCents,
      int taxRateBps,
      long taxCents,
      long totalCents,
      Instant createdAt,
      List<InvoiceLineEntity> lines) {
    this.id = id;
    this.advertiserId = advertiserId;
    this.region = region;
    this.status = status;
    this.subtotalCents = subtotalCents;
    this.discountCents = discountCents;
    this.taxRateBps = taxRateBps;
    this.taxCents = taxCents;
    this.totalCents = totalCents;
    this.createdAt = createdAt;
    this.lines = new ArrayList<>(lines);
  }

  public UUID getId() {
    return id;
  }

  public String getAdvertiserId() {
    return advertiserId;
  }

  public String getRegion() {
    return region;
  }

  public InvoiceStatus getStatus() {
    return status;
  }

  public void setStatus(InvoiceStatus status) {
    this.status = status;
  }

  public long getSubtotalCents() {
    return subtotalCents;
  }

  public long getDiscountCents() {
    return discountCents;
  }

  public int getTaxRateBps() {
    return taxRateBps;
  }

  public long getTaxCents() {
    return taxCents;
  }

  public long getTotalCents() {
    return totalCents;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public List<InvoiceLineEntity> getLines() {
    return lines;
  }
}
