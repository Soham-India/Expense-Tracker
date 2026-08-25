package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.PersonEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PersonRepository extends JpaRepository<PersonEntity, UUID> {

    Optional<PersonEntity> findByUserIdAndSelfTrue(UUID userId);

    Optional<PersonEntity> findByUserIdAndId(UUID userId, UUID id);

    List<PersonEntity> findByUserIdAndArchivedFalseOrderByNameAsc(UUID userId);

    List<PersonEntity> findByUserIdOrderByNameAsc(UUID userId);
}
