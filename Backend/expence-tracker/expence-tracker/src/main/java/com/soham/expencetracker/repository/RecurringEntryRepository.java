package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.RecurringDomain;
import com.soham.expencetracker.entity.RecurringEntryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RecurringEntryRepository extends JpaRepository<RecurringEntryEntity, UUID> {

    Optional<RecurringEntryEntity> findByUserIdAndId(UUID userId, UUID id);

    List<RecurringEntryEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<RecurringEntryEntity> findByUserIdAndDomainOrderByCreatedAtDesc(UUID userId, RecurringDomain domain);

    List<RecurringEntryEntity> findByUserIdAndActiveTrueOrderByCreatedAtDesc(UUID userId);

    List<RecurringEntryEntity> findByUserIdAndDomainAndActiveTrueOrderByCreatedAtDesc(
            UUID userId, RecurringDomain domain);
}
