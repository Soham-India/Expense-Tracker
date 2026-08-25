package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.SubcategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubcategoryRepository extends JpaRepository<SubcategoryEntity, UUID> {

    List<SubcategoryEntity> findByCategoryUserIdOrderBySortOrderAscNameAsc(UUID userId);

    List<SubcategoryEntity> findByCategoryIdOrderBySortOrderAscNameAsc(UUID categoryId);

    Optional<SubcategoryEntity> findByIdAndCategoryUserId(UUID id, UUID userId);

    boolean existsByCategoryIdAndNameIgnoreCase(UUID categoryId, String name);

    boolean existsByCategoryIdAndNameIgnoreCaseAndIdNot(UUID categoryId, String name, UUID id);

    long countByCategoryId(UUID categoryId);
}
