package com.soham.expencetracker.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 🎯 Ideal Monthly Report (§16): a detailed financial review of the user's
 * Ideal model, including trends, projections and insights.
 */
public record IdealMonthlyReport(
        String month,
        Overview overview,
        IncomingAnalysis incomingAnalysis,
        OverBudgetAnalysis overBudgetAnalysis,
        List<IdealWeeklyReport.DailyPoint> dailySpending,
        List<WeekSlice> weeklySpending,
        List<CategorySlice> categoryBreakdown,
        List<SubcategorySlice> subcategoryBreakdown,
        List<FrequencySlice> spendingFrequency,
        IdealWeeklyReport.DayHighlight highestSpendingDay,
        IdealWeeklyReport.DayHighlight lowestSpendingDay,
        BurnRate burnRate,
        Projection projection,
        PreviousComparison previousMonthComparison,
        List<CategoryTrend> categoryTrends,
        List<String> keyInsights) {

    public record Overview(BigDecimal totalIncoming, BigDecimal totalOutgoing,
                           BigDecimal budgetRemaining, boolean overBudget,
                           BigDecimal utilizationPercent) {
    }

    public record IncomingAnalysis(BigDecimal startingIncoming, BigDecimal additionalIncoming,
                                   BigDecimal totalIncoming, long incomingCount,
                                   BigDecimal largestIncoming, String largestIncomingDescription) {
    }

    public record OverBudgetAnalysis(boolean overBudget, BigDecimal overBudgetAmount,
                                     LocalDate crossedOn) {
    }

    public record CategorySlice(String name, BigDecimal amount, BigDecimal percentOfMonth,
                                long txnCount) {
    }

    public record SubcategorySlice(String categoryName, String subcategoryName, BigDecimal amount) {
    }

    public record FrequencySlice(String name, long txnCount, BigDecimal total) {
    }

    public record WeekSlice(LocalDate weekStart, BigDecimal amount) {
    }

    public record BurnRate(BigDecimal usedPercent, BigDecimal elapsedPercent, String verdict) {
    }

    public record Projection(BigDecimal projectedMonthEndOutgoing, boolean isFullMonthActual) {
    }

    public record PreviousComparison(String previousMonth,
                                     BigDecimal previousIncoming, BigDecimal previousOutgoing,
                                     BigDecimal outgoingDelta, BigDecimal outgoingDeltaPercent) {
    }

    public record CategoryTrend(String category, List<MonthPoint> months) {
        public record MonthPoint(String month, BigDecimal outgoing) {
        }
    }
}
