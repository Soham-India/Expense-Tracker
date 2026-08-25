package com.soham.expencetracker.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * 🤝 Split Weekly Report (§19): debt and settlement activity for the week
 * plus the current standing.
 */
public record SplitWeeklyReport(
        LocalDate weekStart,
        LocalDate weekEnd,
        long newSplitExpenseCount,
        BigDecimal newSplitExpenseTotal,
        long settlementCount,
        BigDecimal settlementsPaidByMe,
        BigDecimal settlementsReceivedByMe,
        BigDecimal currentYouOwe,
        BigDecimal currentOwedToYou,
        BigDecimal currentNetBalance,
        List<PersonStanding> peopleOverview) {

    public record PersonStanding(UUID personId, String name, BigDecimal netWithMe) {
    }
}
