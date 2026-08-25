package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.SplitParticipantEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SplitParticipantRepository extends JpaRepository<SplitParticipantEntity, UUID> {

    List<SplitParticipantEntity> findBySplitExpenseIdOrderByCreatedAtAscIdAsc(UUID splitExpenseId);

    void deleteBySplitExpenseId(UUID splitExpenseId);

    @Query("""
            select p from SplitParticipantEntity p
            where p.splitExpense.user.id = :userId
            """)
    List<SplitParticipantEntity> findOfUserExpenses(@Param("userId") UUID userId);
}
