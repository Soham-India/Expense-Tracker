package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.UserEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(UUID id, String email, String displayName, OffsetDateTime createdAt) {

    public static UserResponse from(UserEntity user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt());
    }
}
