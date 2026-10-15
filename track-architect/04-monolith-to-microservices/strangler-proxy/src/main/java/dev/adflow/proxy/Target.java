package dev.adflow.proxy;

public enum Target { LEGACY, NEW;
    public String label() { return name().toLowerCase(); }
}
