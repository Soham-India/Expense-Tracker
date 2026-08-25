package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.AccountEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<AccountEntity, UUID> {

    List<AccountEntity> findByUserIdAndArchivedFalseOrderByNameAsc(UUID userId);

    List<AccountEntity> findByUserIdOrderByNameAsc(UUID userId);

    Optional<AccountEntity> findByUserIdAndId(UUID userId, UUID id);

    boolean existsByUserIdAndNameIgnoreCase(UUID userId, String name);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(UUID userId, String name, UUID id);
}
