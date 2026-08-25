package com.soham.expencetracker.report;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * 🤝 Split Monthly Report (§20): relationship-oriented review —
 * obligations, fronted money, settlement activity, groups, trends.
 */
public record SplitMonthlyReport(
        String month,
        BigDecimal moneyYouOwe,
        BigDecimal moneyOwedToYou,
        BigDecimal netBalance,
        BigDecimal moneyYouFronted,
        BigDecimal moneyFrontedForYou,
        NewExpenses newSplitExpenses,
        SettlementActivity settlements,
        List<PersonBreakdown> personBreakdown,
        List<GroupBreakdown> groupBreakdown,
        List<OutstandingPair> outstandingBalances,
        BigDecimal settlementRatePercent,
        PreviousComparison previousMonthComparison,
        List<DebtTrend> debtTrends,
        List<String> keyInsights) {

    public record NewExpenses(long count, BigDecimal total) {
    }

    public record SettlementActivity(long count, BigDecimal paidByMe, BigDecimal receivedByMe) {
    }

    public record PersonBreakdown(UUID personId, String name, BigDecimal netWithMe,
                                  long sharedExpenseCount) {
    }

    public record GroupBreakdown(UUID groupId, String name, long expenseCount,
                                 BigDecimal totalAmount, BigDecimal myShare, BigDecimal myPaid) {
    }

    public record OutstandingPair(UUID fromPersonId, String fromPersonName,
                                  UUID toPersonId, String toPersonName, BigDecimal amount) {
    }

    public record PreviousComparison(String previousMonth,
                                     long previousExpenseCount, BigDecimal previousExpenseTotal,
                                     long previousSettlementCount, BigDecimal previousSettlementTotal) {
    }

    public record DebtTrend(String month, BigDecimal newDebtCreated, BigDecimal settledAmount) {
    }
}
