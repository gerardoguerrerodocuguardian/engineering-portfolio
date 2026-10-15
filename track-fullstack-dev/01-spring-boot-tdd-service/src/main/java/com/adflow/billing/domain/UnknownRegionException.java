package com.adflow.billing.domain;

/** The tax service does not know the region (maps to HTTP 422). Never retried. */
public class UnknownRegionException extends RuntimeException {
  public UnknownRegionException(String region) {
    super("unknown tax region: " + region);
  }
}
