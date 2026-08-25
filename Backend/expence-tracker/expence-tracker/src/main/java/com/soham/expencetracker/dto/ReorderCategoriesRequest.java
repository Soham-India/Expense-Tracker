package com.soham.expencetracker.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record ReorderCategoriesRequest(

        @NotEmpty(message = "categoryIds is required")
        List<UUID> categoryIds) {
}
