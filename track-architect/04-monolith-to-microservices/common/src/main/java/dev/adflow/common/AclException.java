package dev.adflow.common;

/** Thrown when a legacy (or new) payload cannot be translated; the ACL never lets bad data leak through. */
public class AclException extends RuntimeException {
    public AclException(String message, Throwable cause) { super(message, cause); }
    public AclException(String message) { super(message); }
}
