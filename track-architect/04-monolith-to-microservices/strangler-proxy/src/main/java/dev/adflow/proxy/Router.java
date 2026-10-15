package dev.adflow.proxy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Percentage router. The bucket is derived from a stable key (user / campaign id), so a given key always
 * lands on the same side for a given percentage, and raising the percentage only moves keys legacy -> new.
 */
public final class Router {
    private final RouteConfig config;

    public Router(RouteConfig config) { this.config = config; }

    public Target decide(String path, String key) {
        int p = config.percentFor(path);
        if (p <= 0) return Target.LEGACY;
        if (p >= 100) return Target.NEW;
        return bucket(key) < p ? Target.NEW : Target.LEGACY;
    }

    public static int bucket(String key) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
            return (((h[0] & 0xff) << 8) | (h[1] & 0xff)) % 100;
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
