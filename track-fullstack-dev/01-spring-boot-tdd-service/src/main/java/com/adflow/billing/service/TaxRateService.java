package com.adflow.billing.service;

import com.adflow.billing.client.TaxRateClient;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/** Caches tax rates per region (Caffeine): rates change rarely and the remote call is costly. */
@Service
public class TaxRateService {

  public static final String CACHE = "taxRates";

  private final TaxRateClient client;

  public TaxRateService(TaxRateClient client) {
    this.client = client;
  }

  @Cacheable(cacheNames = CACHE, key = "#region")
  public int rateBasisPoints(String region) {
    return client.rateBasisPoints(region);
  }
}
