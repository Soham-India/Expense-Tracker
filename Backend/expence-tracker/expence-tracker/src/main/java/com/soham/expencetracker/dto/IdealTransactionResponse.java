package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.IdealTransactionEntity;
import com.soham.expencetracker.entity.IdealTxnType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record IdealTransactionResponse(
        UUID id,
        IdealTxnType type,
        BigDecimal amount,
        UUID categoryId,
        String categoryName,
        UUID subcategoryId,
        String subcategoryName,
        String description,
        LocalDate date,
        String notes,
        OffsetDateTime createdAt) {

    public static IdealTransactionResponse from(IdealTransactionEntity entity) {
        return new IdealTransactionResponse(
                entity.getId(),
                entity.getType(),
                entity.getAmount(),
                entity.getCategory() != null ? entity.getCategory().getId() : null,
                entity.getCategory() != null ? entity.getCategory().getName() : null,
                entity.getSubcategory() != null ? entity.getSubcategory().getId() : null,
                entity.getSubcategory() != null ? entity.getSubcategory().getName() : null,
                entity.getDescription(),
                entity.getTxnDate(),
                entity.getNotes(),
                entity.getCreatedAt());
    }
}
