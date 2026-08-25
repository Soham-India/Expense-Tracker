package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.IdealTxnType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record IdealTransactionRequest(

        @NotNull(message = "Type is required (INCOMING or OUTGOING)")
        IdealTxnType type,

        @NotNull(message = "Amount is required")
        @Positive(message = "Amount must be greater than zero")
        BigDecimal amount,

        UUID categoryId,

        UUID subcategoryId,

        @Size(max = 255, message = "Description must be at most 255 characters")
        String description,

        @NotNull(message = "Date is required")
        LocalDate date,

        @Size(max = 2000, message = "Notes must be at most 2000 characters")
        String notes) {
}
