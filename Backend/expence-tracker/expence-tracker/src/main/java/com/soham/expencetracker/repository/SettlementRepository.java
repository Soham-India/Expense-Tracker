package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.SettlementEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<SettlementEntity, UUID> {

    Optional<SettlementEntity> findByUserIdAndId(UUID userId, UUID id);

    List<SettlementEntity> findByUserIdAndSettlementDateBetweenOrderBySettlementDateDescIdDesc(
            UUID userId, LocalDate startInclusive, LocalDate endInclusive);

    List<SettlementEntity> findByUserIdOrderBySettlementDateAsc(UUID userId);
}
