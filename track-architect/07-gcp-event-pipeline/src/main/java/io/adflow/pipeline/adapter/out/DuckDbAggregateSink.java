package io.adflow.pipeline.adapter.out;

import io.adflow.pipeline.application.port.AggregateSink;
import io.adflow.pipeline.domain.AdEvent;
import io.adflow.pipeline.domain.CampaignDayAggregate;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Local stand-in for BigQuery with the same two-step shape: insert-if-absent into the raw table, then
 * recompute (replace, never add) the affected campaign/day rows. Single connection, synchronized.
 */
public class DuckDbAggregateSink implements AggregateSink, AutoCloseable {

    private final Connection conn;

    /** @param jdbcUrl e.g. "jdbc:duckdb:" for in-memory or "jdbc:duckdb:/tmp/adflow.db" */
    public DuckDbAggregateSink(String jdbcUrl) {
        try {
            conn = DriverManager.getConnection(jdbcUrl);
            try (Statement s = conn.createStatement()) {
                s.execute("CREATE TABLE IF NOT EXISTS ad_events (event_id VARCHAR PRIMARY KEY, type VARCHAR NOT NULL,"
                        + " campaign_id VARCHAR NOT NULL, cost_cents BIGINT NOT NULL, occurred_at TIMESTAMP NOT NULL)");
                s.execute("CREATE TABLE IF NOT EXISTS campaign_daily (campaign_id VARCHAR, day DATE, impressions BIGINT,"
                        + " clicks BIGINT, cost_cents BIGINT, PRIMARY KEY (campaign_id, day))");
            }
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public synchronized void write(List<AdEvent> events) {
        try {
            conn.setAutoCommit(false);
            Set<String> touched = new HashSet<>();
            try (PreparedStatement ins = conn.prepareStatement(
                    "INSERT INTO ad_events VALUES (?, ?, ?, ?, ?) ON CONFLICT (event_id) DO NOTHING")) {
                for (AdEvent e : events) {
                    ins.setString(1, e.eventId().toString());
                    ins.setString(2, e.type().name());
                    ins.setString(3, e.campaignId());
                    ins.setLong(4, e.costCents());
                    ins.setObject(5, LocalDateTime.ofInstant(e.occurredAt(), ZoneOffset.UTC));
                    ins.executeUpdate();
                    touched.add(e.campaignId() + "|" + e.day());
                }
            }
            try (PreparedStatement up = conn.prepareStatement(
                    "INSERT OR REPLACE INTO campaign_daily SELECT campaign_id, CAST(occurred_at AS DATE),"
                            + " COUNT(*) FILTER (WHERE type = 'IMPRESSION'), COUNT(*) FILTER (WHERE type = 'CLICK'),"
                            + " SUM(cost_cents) FROM ad_events WHERE campaign_id = ? AND CAST(occurred_at AS DATE) = ?"
                            + " GROUP BY 1, 2")) {
                for (String key : touched) {
                    String[] p = key.split("\\|");
                    up.setString(1, p[0]);
                    up.setObject(2, LocalDate.parse(p[1]));
                    up.executeUpdate();
                }
            }
            conn.commit();
        } catch (SQLException ex) {
            try { conn.rollback(); } catch (SQLException ignored) { /* best effort */ }
            throw new IllegalStateException(ex);
        }
    }

    @Override
    public synchronized Optional<CampaignDayAggregate> find(String campaignId, LocalDate day) {
        try (PreparedStatement q = conn.prepareStatement(
                "SELECT impressions, clicks, cost_cents FROM campaign_daily WHERE campaign_id = ? AND day = ?")) {
            q.setString(1, campaignId);
            q.setObject(2, day);
            try (ResultSet rs = q.executeQuery()) {
                return rs.next()
                        ? Optional.of(new CampaignDayAggregate(campaignId, day, rs.getLong(1), rs.getLong(2), rs.getLong(3)))
                        : Optional.empty();
            }
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public void close() throws SQLException { conn.close(); }
}
