package com.soham.expencetracker.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public record StartIdealMonthRequest(

        @NotBlank(message = "Month is required")
        @Pattern(regexp = "\\d{4}-\\d{2}", message = "Month must be in yyyy-MM format")
        String month,

        @NotNull(message = "Starting monthly incoming is required (use 0 if none)")
        @DecimalMin(value = "0.00", message = "Starting incoming cannot be negative")
        BigDecimal startingIncoming) {
}
