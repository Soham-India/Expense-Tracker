package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.SplitExpenseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SplitExpenseRepository extends JpaRepository<SplitExpenseEntity, UUID> {

    Optional<SplitExpenseEntity> findByUserIdAndId(UUID userId, UUID id);

    List<SplitExpenseEntity> findByUserIdAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
            UUID userId, LocalDate startInclusive, LocalDate endInclusive);

    boolean existsByGroupId(UUID groupId);
}
