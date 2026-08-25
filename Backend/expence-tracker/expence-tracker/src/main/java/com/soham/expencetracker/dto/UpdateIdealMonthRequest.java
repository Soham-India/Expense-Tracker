package com.soham.expencetracker.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record UpdateIdealMonthRequest(

        @NotNull(message = "Starting incoming is required (use 0 if none)")
        @DecimalMin(value = "0.00", message = "Starting incoming cannot be negative")
        BigDecimal startingIncoming) {
}
