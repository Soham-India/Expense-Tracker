package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.SplitGroupEntity;
import com.soham.expencetracker.entity.SplitGroupStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SplitGroupRepository extends JpaRepository<SplitGroupEntity, UUID> {

    List<SplitGroupEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<SplitGroupEntity> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, SplitGroupStatus status);

    Optional<SplitGroupEntity> findByUserIdAndId(UUID userId, UUID id);
}
