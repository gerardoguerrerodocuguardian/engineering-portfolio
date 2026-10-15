package com.adflow.billing.domain;

/** An illegal lifecycle transition was attempted (maps to HTTP 409). */
public class InvalidStateTransitionException extends RuntimeException {
  public InvalidStateTransitionException(String message) {
    super(message);
  }
}
