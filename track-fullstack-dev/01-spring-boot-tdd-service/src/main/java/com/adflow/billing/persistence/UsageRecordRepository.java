package com.adflow.billing.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UsageRecordRepository extends JpaRepository<UsageRecordEntity, Long> {

  /** Totals for one campaign: {impressions, clicks, spendCents}; zeros when there is no usage. */
  @Query(
      "select coalesce(sum(u.impressions), 0), coalesce(sum(u.clicks), 0),"
          + " coalesce(sum(u.spendCents), 0) from UsageRecordEntity u where u.campaignId = :id")
  List<Object[]> totalsFor(String id);

  boolean existsByCampaignId(String campaignId);
}
