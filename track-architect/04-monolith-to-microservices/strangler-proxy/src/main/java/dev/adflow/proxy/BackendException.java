package dev.adflow.proxy;

public class BackendException extends RuntimeException {
    public BackendException(String m, Throwable cause) { super(m, cause); }
    public BackendException(String m) { super(m); }
}
