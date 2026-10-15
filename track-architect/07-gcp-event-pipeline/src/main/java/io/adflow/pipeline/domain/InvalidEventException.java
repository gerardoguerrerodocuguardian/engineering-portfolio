package io.adflow.pipeline.domain;

/** Raised for payloads that violate the ad-events contract (poison messages). */
public class InvalidEventException extends RuntimeException {
    public InvalidEventException(String message) { super(message); }
    public InvalidEventException(String message, Throwable cause) { super(message, cause); }
}
