CREATE TABLE campaign (
    id             VARCHAR(64) PRIMARY KEY,
    keywords       TEXT        NOT NULL,
    max_bid_cents  BIGINT      NOT NULL CHECK (max_bid_cents >= 0),
    budget_cents   BIGINT      NOT NULL CHECK (budget_cents >= 0),
    spent_cents    BIGINT      NOT NULL DEFAULT 0 CHECK (spent_cents >= 0)
);

-- Idempotent consumer: one row per processed eventId (PK enforces uniqueness).
CREATE TABLE processed_event (
    event_id     UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL
);

-- Transactional outbox: written in the same transaction as the budget update.
CREATE TABLE outbox (
    id           UUID PRIMARY KEY,
    aggregate_id VARCHAR(64) NOT NULL,
    payload      TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending ON outbox (created_at) WHERE published_at IS NULL;
