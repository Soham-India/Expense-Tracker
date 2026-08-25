package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.CategoryScope;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateCategoryRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 80, message = "Name must be at most 80 characters")
        String name,

        @NotNull(message = "Scope is required (IDEAL, ACTUAL or BOTH)")
        CategoryScope scope,

        @NotNull(message = "isHidden is required (true or false)")
        Boolean hidden) {
}
