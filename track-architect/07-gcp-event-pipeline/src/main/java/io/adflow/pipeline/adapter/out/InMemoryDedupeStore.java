package io.adflow.pipeline.adapter.out;

import io.adflow.pipeline.application.port.DedupeStore;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Bounded LRU-style set; fine for a single instance, a shared cache would be needed otherwise. */
public class InMemoryDedupeStore implements DedupeStore {

    private final Set<UUID> seen;

    public InMemoryDedupeStore(int maxEntries) {
        this.seen = Collections.newSetFromMap(Collections.synchronizedMap(new LinkedHashMap<>() {
            @Override
            protected boolean removeEldestEntry(Map.Entry<UUID, Boolean> eldest) {
                return size() > maxEntries;
            }
        }));
    }

    @Override public boolean markIfNew(UUID eventId) { return seen.add(eventId); }

    @Override public void forget(UUID eventId) { seen.remove(eventId); }
}
