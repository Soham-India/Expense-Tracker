package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.CategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<CategoryEntity, UUID> {

    List<CategoryEntity> findByUserIdOrderBySortOrderAscNameAsc(UUID userId);

    Optional<CategoryEntity> findByUserIdAndId(UUID userId, UUID id);

    boolean existsByUserIdAndNameIgnoreCase(UUID userId, String name);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(UUID userId, String name, UUID id);

    long countByUserId(UUID userId);
}
