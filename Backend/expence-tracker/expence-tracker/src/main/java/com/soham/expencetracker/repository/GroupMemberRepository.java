package com.soham.expencetracker.repository;

import com.soham.expencetracker.entity.GroupMemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GroupMemberRepository extends JpaRepository<GroupMemberEntity, UUID> {

    List<GroupMemberEntity> findByGroupIdOrderByJoinedAtAsc(UUID groupId);

    Optional<GroupMemberEntity> findByGroupIdAndPersonId(UUID groupId, UUID personId);

    boolean existsByGroupIdAndPersonId(UUID groupId, UUID personId);

    void deleteByGroupId(UUID groupId);
}
