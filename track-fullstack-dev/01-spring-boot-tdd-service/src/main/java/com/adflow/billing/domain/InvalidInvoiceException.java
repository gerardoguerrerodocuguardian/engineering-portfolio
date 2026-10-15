package com.adflow.billing.domain;

/** A business rule on invoice input was violated (maps to HTTP 400/422). */
public class InvalidInvoiceException extends RuntimeException {
  public InvalidInvoiceException(String message) {
    super(message);
  }
}
