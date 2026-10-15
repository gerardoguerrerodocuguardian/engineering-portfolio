package com.adflow.billing.domain;

/** Tax service failed, timed out, or its circuit breaker is open (maps to HTTP 503). */
public class TaxServiceUnavailableException extends RuntimeException {
  public TaxServiceUnavailableException(String message, Throwable cause) {
    super(message, cause);
  }
}
