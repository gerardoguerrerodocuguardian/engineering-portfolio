package io.adflow.bidding.adapters.out.persistence;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

final class SpringDataRepositories {

    private SpringDataRepositories() {
    }

    interface CampaignJpa extends JpaRepository<CampaignEntity, String> {
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("select c from CampaignEntity c where c.id = :id")
        Optional<CampaignEntity> findForUpdate(@Param("id") String id);
    }

    interface ProcessedEventJpa extends JpaRepository<ProcessedEventEntity, UUID> {
    }

    interface OutboxJpa extends JpaRepository<OutboxEntity, UUID> {
        @Query(value = "select * from outbox where published_at is null order by created_at "
                + "limit :limit for update skip locked", nativeQuery = true)
        List<OutboxEntity> lockPending(@Param("limit") int limit);
    }
}
