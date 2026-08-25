package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.SplitMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SplitExpenseRequest(

        UUID groupId,

        @NotNull(message = "createdByPersonId is required (who is recording this expense)")
        UUID createdByPersonId,

        @Size(max = 255, message = "Description must be at most 255 characters")
        String description,

        @NotNull(message = "Total amount is required")
        @Positive(message = "Total amount must be greater than zero")
        BigDecimal totalAmount,

        SplitMethod splitMethod,

        @NotNull(message = "Date is required")
        LocalDate date,

        @Valid
        @NotNull(message = "participants is required")
        List<ParticipantInput> participants) {

    public SplitExpenseRequest {
        if (splitMethod == null) {
            splitMethod = SplitMethod.EQUAL;
        }
    }

    public record ParticipantInput(

            @NotNull(message = "personId is required for every participant")
            UUID personId,

            @PositiveOrZero(message = "paidAmount cannot be negative")
            BigDecimal paidAmount,

            BigDecimal shareValue) {
    }
}
