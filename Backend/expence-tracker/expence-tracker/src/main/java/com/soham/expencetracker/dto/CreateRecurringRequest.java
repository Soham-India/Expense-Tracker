package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.RecurringDomain;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateRecurringRequest(

        @NotNull(message = "Domain is required (IDEAL or ACTUAL)")
        RecurringDomain domain,

        @NotBlank(message = "Type is required (INCOMING or OUTGOING)")
        String type,

        @NotNull(message = "Amount is required")
        @Positive(message = "Amount must be greater than zero")
        BigDecimal amount,

        UUID categoryId,

        UUID subcategoryId,

        UUID accountId,

        @NotBlank(message = "Description is required")
        @Size(max = 255, message = "Description must be at most 255 characters")
        String description,

        @NotNull(message = "dayOfMonth is required")
        @Min(value = 1, message = "dayOfMonth must be between 1 and 31")
        @Max(value = 31, message = "dayOfMonth must be between 1 and 31")
        Integer dayOfMonth) {
}
