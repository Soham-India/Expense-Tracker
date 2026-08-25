package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.AccountType;

import java.math.BigDecimal;
import java.util.UUID;

public record AccountResponse(
        UUID id,
        String name,
        AccountType accountType,
        BigDecimal startingBalance,
        boolean archived,
        BigDecimal totalInflow,
        BigDecimal totalOutflow,
        BigDecimal currentBalance) {
}
