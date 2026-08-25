package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.SplitGroupStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateGroupRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @Size(max = 255, message = "Description must be at most 255 characters")
        String description,

        @NotNull(message = "status is required (ACTIVE or ARCHIVED)")
        SplitGroupStatus status) {
}
