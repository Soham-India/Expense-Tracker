package com.soham.expencetracker.dto;

import java.math.BigDecimal;

public record IdealSummaryResponse(
        String month,
        boolean monthStarted,
        BigDecimal startingIncoming,
        BigDecimal additionalIncoming,
        BigDecimal totalIncoming,
        BigDecimal totalOutgoing,
        BigDecimal budgetRemaining,
        boolean overBudget,
        BigDecimal overBudgetAmount,
        BigDecimal utilizationPercent) {
}
