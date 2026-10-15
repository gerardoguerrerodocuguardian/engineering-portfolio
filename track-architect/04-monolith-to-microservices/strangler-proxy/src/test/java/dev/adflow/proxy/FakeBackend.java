package dev.adflow.proxy;

import dev.adflow.common.Campaign;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicInteger;

class FakeBackend implements CampaignBackend {
    final TreeMap<Long, Campaign> data = new TreeMap<>();
    boolean failing;
    final AtomicInteger calls = new AtomicInteger();
    long nextId;

    FakeBackend(long firstId) { nextId = firstId; }

    private void check() { calls.incrementAndGet(); if (failing) throw new BackendException("boom"); }

    @Override public List<Campaign> list() { check(); return new ArrayList<>(data.values()); }
    @Override public Optional<Campaign> get(long id) { check(); return Optional.ofNullable(data.get(id)); }
    @Override public Campaign create(Campaign c) {
        check();
        Campaign s = new Campaign(nextId++, c.name(), c.budget(), c.status(), c.startDate());
        data.put(s.id(), s);
        return s;
    }
    @Override public Campaign upsert(Campaign c) { check(); data.put(c.id(), c); return c; }

    static Campaign c(long id, String name, String status) {
        return new Campaign(id, name, new dev.adflow.common.Money(1000, "USD"), status, "2024-01-01");
    }
}
