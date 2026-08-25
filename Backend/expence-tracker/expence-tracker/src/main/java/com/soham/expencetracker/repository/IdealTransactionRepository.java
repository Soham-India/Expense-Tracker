package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.IdealTxnType;
import com.soham.expencetracker.entity.IdealTransactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IdealTransactionRepository extends JpaRepository<IdealTransactionEntity, UUID> {

    Optional<IdealTransactionEntity> findByUserIdAndId(UUID userId, UUID id);

    /**
     * §13.4 recents: financial date first, then true insertion recency
     * (created_at), with id as a pure determinism tiebreaker — UUIDs do
     * not correlate with insertion order.
     */
    List<IdealTransactionEntity> findTop5ByUserIdOrderByTxnDateDescCreatedAtDescIdDesc(UUID userId);

    List<IdealTransactionEntity> findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(
            UUID userId, LocalDate startInclusive, LocalDate endInclusive);

    List<IdealTransactionEntity> findByUserIdAndTypeAndTxnDateBetweenOrderByTxnDateDescIdDesc(
            UUID userId, IdealTxnType type, LocalDate startInclusive, LocalDate endInclusive);

    @Query("""
            select t.type as type, coalesce(sum(t.amount), 0) as total
            from IdealTransactionEntity t
            where t.user.id = :userId and t.txnDate between :start and :end
            group by t.type
            """)
    List<TypeTotal> sumTotalsByTypeBetween(@Param("userId") UUID userId,
                                           @Param("start") LocalDate start,
                                           @Param("end") LocalDate end);

    interface TypeTotal {
        IdealTxnType getType();

        BigDecimal getTotal();
    }
}
