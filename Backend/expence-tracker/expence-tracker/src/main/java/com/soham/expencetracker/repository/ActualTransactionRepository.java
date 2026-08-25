package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.entity.ActualTransactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ActualTransactionRepository extends JpaRepository<ActualTransactionEntity, UUID> {

    Optional<ActualTransactionEntity> findByUserIdAndId(UUID userId, UUID id);

    /**
     * §13.4 recents: financial date first, then true insertion recency
     * (created_at), with id as a pure determinism tiebreaker — UUIDs do
     * not correlate with insertion order.
     */
    List<ActualTransactionEntity> findTop5ByUserIdOrderByTxnDateDescCreatedAtDescIdDesc(UUID userId);

    List<ActualTransactionEntity> findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(
            UUID userId, LocalDate startInclusive, LocalDate endInclusive);

    List<ActualTransactionEntity> findByUserIdAndTypeAndTxnDateBetweenOrderByTxnDateDescIdDesc(
            UUID userId, ActualTxnType type, LocalDate startInclusive, LocalDate endInclusive);

    List<ActualTransactionEntity> findByUserIdAndAccountIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(
            UUID userId, UUID accountId, LocalDate startInclusive, LocalDate endInclusive);

    @Query("""
            select coalesce(sum(t.amount), 0) from ActualTransactionEntity t
            where t.user.id = :userId and t.account.id = :accountId
              and t.type in :outflowTypes
            """)
    BigDecimal totalOutflowForAccount(@Param("userId") UUID userId,
                                      @Param("accountId") UUID accountId,
                                      @Param("outflowTypes") Collection<ActualTxnType> outflowTypes);

    @Query("""
            select coalesce(sum(t.amount), 0) from ActualTransactionEntity t
            where t.user.id = :userId
              and ((t.type = :incoming and t.account.id = :accountId)
                or (t.type = :transfer and t.transferToAccount.id = :accountId))
            """)
    BigDecimal totalInflowForAccount(@Param("userId") UUID userId,
                                     @Param("accountId") UUID accountId,
                                     @Param("incoming") ActualTxnType incoming,
                                     @Param("transfer") ActualTxnType transfer);
}
