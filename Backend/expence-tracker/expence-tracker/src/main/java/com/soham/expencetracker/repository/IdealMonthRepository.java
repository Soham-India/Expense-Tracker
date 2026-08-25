package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.IdealMonthEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IdealMonthRepository extends JpaRepository<IdealMonthEntity, UUID> {

    Optional<IdealMonthEntity> findByUserIdAndMonth(UUID userId, LocalDate month);

    boolean existsByUserIdAndMonth(UUID userId, LocalDate month);

    List<IdealMonthEntity> findByUserIdOrderByMonthDesc(UUID userId);

    Optional<IdealMonthEntity> findByUserIdAndId(UUID userId, UUID id);
}
