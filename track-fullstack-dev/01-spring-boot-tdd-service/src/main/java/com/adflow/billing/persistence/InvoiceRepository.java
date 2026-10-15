package com.adflow.billing.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID> {
  List<InvoiceEntity> findByAdvertiserIdOrderByCreatedAtDesc(String advertiserId);
}
