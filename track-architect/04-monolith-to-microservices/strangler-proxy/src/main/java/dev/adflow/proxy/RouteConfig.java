package dev.adflow.proxy;

import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

/** Feature-flag style routing table: path prefix -> percentage of traffic sent to the NEW service. */
public final class RouteConfig {
    private final Map<String, Integer> percentByPrefix = new ConcurrentHashMap<>();
    private volatile boolean shadow;

    public RouteConfig(boolean shadow) { this.shadow = shadow; }

    /** Properties format: {@code route./campaigns=50}, {@code shadow=true}. */
    public static RouteConfig fromProperties(Properties p) {
        RouteConfig c = new RouteConfig(Boolean.parseBoolean(p.getProperty("shadow", "false")));
        for (String k : p.stringPropertyNames())
            if (k.startsWith("route.")) c.setPercent(k.substring("route.".length()), Integer.parseInt(p.getProperty(k).trim()));
        return c;
    }

    public void setPercent(String prefix, int percent) {
        if (percent < 0 || percent > 100) throw new IllegalArgumentException("percent must be 0..100");
        percentByPrefix.put(prefix, percent);
    }

    /** Longest matching prefix wins; unmatched paths stay on the legacy (the strangler default). */
    public int percentFor(String path) {
        String best = null;
        for (String p : percentByPrefix.keySet())
            if (path.startsWith(p) && (best == null || p.length() > best.length())) best = p;
        return best == null ? 0 : percentByPrefix.get(best);
    }

    public boolean shadow() { return shadow; }
    public void setShadow(boolean s) { this.shadow = s; }
    public Map<String, Integer> routes() { return new TreeMap<>(percentByPrefix); }
}
