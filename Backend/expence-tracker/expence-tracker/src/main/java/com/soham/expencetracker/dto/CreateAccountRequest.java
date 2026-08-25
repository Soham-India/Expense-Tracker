package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.AccountType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateAccountRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 80, message = "Name must be at most 80 characters")
        String name,

        @NotNull(message = "Account type is required (BANK, CASH, UPI, CARD or OTHER)")
        AccountType accountType,

        @DecimalMin(value = "0.00", message = "Starting balance cannot be negative")
        BigDecimal startingBalance) {
}
