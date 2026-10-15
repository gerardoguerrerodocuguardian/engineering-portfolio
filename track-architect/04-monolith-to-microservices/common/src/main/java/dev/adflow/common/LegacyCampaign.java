package dev.adflow.common;

import com.fasterxml.jackson.annotation.JsonProperty;

/** The LEGACY row shape (mainframe-era naming, string money in major units, yyyyMMdd dates, one-letter status). */
public record LegacyCampaign(
        @JsonProperty("CAMP_ID") String campId,
        @JsonProperty("CAMP_NM") String campNm,
        @JsonProperty("BUDGET_AMT") String budgetAmt,
        @JsonProperty("CCY_CD") String ccyCd,
        @JsonProperty("STAT_CD") String statCd,
        @JsonProperty("START_DT") String startDt) {}
