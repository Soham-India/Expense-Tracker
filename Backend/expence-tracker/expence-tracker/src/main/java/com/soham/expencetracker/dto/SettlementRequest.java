package com.soham.expencetracker.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SettlementRequest(

        @NotNull(message = "fromPersonId is required (who is paying)")
        UUID fromPersonId,

        @NotNull(message = "toPersonId is required (who is being paid)")
        UUID toPersonId,

        @NotNull(message = "Amount is required")
        @Positive(message = "Amount must be greater than zero")
        BigDecimal amount,

        @NotNull(message = "Date is required")
        LocalDate date,

        @Size(max = 255, message = "Note must be at most 255 characters")
        String note,

        UUID actualTransactionId) {
}
