package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.CategoryScope;

import java.util.List;
import java.util.UUID;

public record CategoryResponse(
        UUID id,
        String name,
        CategoryScope scope,
        boolean hidden,
        int sortOrder,
        List<SubcategoryResponse> subcategories) {
}
