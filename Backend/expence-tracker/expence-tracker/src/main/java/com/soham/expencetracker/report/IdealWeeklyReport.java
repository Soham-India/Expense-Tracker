package com.soham.expencetracker.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 🎯 Ideal Weekly Report (§15): a compact "what happened in my Ideal plan
 * this week" summary.
 */
public record IdealWeeklyReport(
        LocalDate weekStart,
        LocalDate weekEnd,
        BigDecimal idealIncoming,
        BigDecimal idealOutgoing,
        BigDecimal monthBudgetUsedPercent,
        BigDecimal monthBudgetRemaining,
        List<CategorySlice> categoryBreakdown,
        List<DailyPoint> dailySpending,
        DayHighlight highestSpendingDay,
        DayHighlight lowestSpendingDay,
        String highestCategory,
        String lowestCategory,
        String mostFrequentCategory) {

    public record CategorySlice(String name, BigDecimal amount, BigDecimal percentOfWeek) {
    }

    public record DailyPoint(LocalDate date, BigDecimal amount) {
    }

    public record DayHighlight(LocalDate date, BigDecimal amount) {
    }
}
