package com.adflow.billing.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "invoice_line")
public class InvoiceLineEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "campaign_id", nullable = false)
  private String campaignId;

  @Column(nullable = false)
  private String description;

  @Column(nullable = false)
  private long quantity;

  @Column(name = "unit_price_cents", nullable = false)
  private long unitPriceCents;

  protected InvoiceLineEntity() {}

  public InvoiceLineEntity(
      String campaignId, String description, long quantity, long unitPriceCents) {
    this.campaignId = campaignId;
    this.description = description;
    this.quantity = quantity;
    this.unitPriceCents = unitPriceCents;
  }

  public String getCampaignId() {
    return campaignId;
  }

  public String getDescription() {
    return description;
  }

  public long getQuantity() {
    return quantity;
  }

  public long getUnitPriceCents() {
    return unitPriceCents;
  }
}
