package com.adflow.billing.client;

/** Port to the (fictional) external AdFlow tax service. */
public interface TaxRateClient {

  /** Returns the sales-tax rate for a region in basis points (825 = 8.25%). */
  int rateBasisPoints(String region);
}
