package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.SplitGroupStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateGroupRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @Size(max = 255, message = "Description must be at most 255 characters")
        String description,

        List<UUID> memberPersonIds) {
}
