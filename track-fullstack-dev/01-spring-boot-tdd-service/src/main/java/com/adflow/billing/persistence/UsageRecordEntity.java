package com.adflow.billing.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "usage_record")
public class UsageRecordEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "campaign_id", nullable = false)
  private String campaignId;

  @Column(nullable = false)
  private long impressions;

  @Column(nullable = false)
  private long clicks;

  @Column(name = "spend_cents", nullable = false)
  private long spendCents;

  @Column(name = "recorded_at", nullable = false)
  private Instant recordedAt;

  protected UsageRecordEntity() {}

  public UsageRecordEntity(
      String campaignId, long impressions, long clicks, long spendCents, Instant recordedAt) {
    this.campaignId = campaignId;
    this.impressions = impressions;
    this.clicks = clicks;
    this.spendCents = spendCents;
    this.recordedAt = recordedAt;
  }

  public String getCampaignId() {
    return campaignId;
  }

  public long getImpressions() {
    return impressions;
  }

  public long getClicks() {
    return clicks;
  }

  public long getSpendCents() {
    return spendCents;
  }
}
