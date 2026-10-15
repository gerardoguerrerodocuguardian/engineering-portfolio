package com.adflow.billing.service;

import com.adflow.billing.domain.CampaignReport;
import com.adflow.billing.persistence.UsageRecordEntity;
import com.adflow.billing.persistence.UsageRecordRepository;
import java.time.Clock;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

  private final UsageRecordRepository usage;
  private final Clock clock;

  public ReportService(UsageRecordRepository usage, Clock clock) {
    this.usage = usage;
    this.clock = clock;
  }

  @Transactional
  public void recordUsage(String campaignId, long impressions, long clicks, long spendCents) {
    new CampaignReport(campaignId, impressions, clicks, spendCents); // validates the figures
    usage.save(new UsageRecordEntity(campaignId, impressions, clicks, spendCents, clock.instant()));
  }

  @Transactional(readOnly = true)
  public CampaignReport report(String campaignId) {
    if (!usage.existsByCampaignId(campaignId)) {
      throw new NotFoundException("campaign usage", campaignId);
    }
    List<Object[]> rows = usage.totalsFor(campaignId);
    Object[] t = rows.get(0);
    return new CampaignReport(
        campaignId,
        ((Number) t[0]).longValue(),
        ((Number) t[1]).longValue(),
        ((Number) t[2]).longValue());
  }
}
