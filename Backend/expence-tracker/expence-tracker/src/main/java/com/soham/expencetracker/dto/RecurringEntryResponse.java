package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.RecurringDomain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RecurringEntryResponse(
        UUID id,
        RecurringDomain domain,
        String type,
        BigDecimal amount,
        UUID categoryId,
        String categoryName,
        UUID subcategoryId,
        String subcategoryName,
        UUID accountId,
        String accountName,
        String description,
        int dayOfMonth,
        boolean isActive,
        LocalDate lastConfirmedMonth,
        OffsetDateTime createdAt) {
}
