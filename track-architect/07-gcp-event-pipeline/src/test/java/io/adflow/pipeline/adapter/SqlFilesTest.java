package io.adflow.pipeline.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** Cheap guard on the BigQuery SQL we cannot execute locally: MERGE shape and partition pruning. */
class SqlFilesTest {

    @Test
    void mergesPruneAndAreIdempotent() throws Exception {
        String ev = Files.readString(Path.of("sql/01_merge_ad_events.sql"));
        String daily = Files.readString(Path.of("sql/02_merge_campaign_daily.sql"));
        assertThat(ev).contains("MERGE").contains("WHEN NOT MATCHED").doesNotContain("WHEN MATCHED");
        assertThat(ev).contains("@min_day").contains("@max_day");
        assertThat(daily).contains("WHEN MATCHED").contains("SET impressions = s.impressions")
                .doesNotContainPattern("impressions\\s*=\\s*t\\.impressions\\s*\\+");
        assertThat(daily).contains("DATE(occurred_at) BETWEEN @min_day AND @max_day");
    }
}
