package com.soham.expencetracker.dto;

import java.util.UUID;

public record SubcategoryResponse(UUID id, String name, boolean hidden, int sortOrder) {

    public static SubcategoryResponse from(com.soham.expencetracker.entity.SubcategoryEntity entity) {
        return new SubcategoryResponse(entity.getId(), entity.getName(), entity.isHidden(), entity.getSortOrder());
    }
}
