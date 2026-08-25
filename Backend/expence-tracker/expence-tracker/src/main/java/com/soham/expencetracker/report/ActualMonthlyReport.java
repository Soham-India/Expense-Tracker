package com.soham.expencetracker.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * 💳 Actual Monthly Report (§18): detailed money-movement review. Account
 * analysis distinguishes movement from true balance — balances are only
 * present where starting balances are configured (§6.6).
 */
public record ActualMonthlyReport(
        String month,
        CashFlowOverview cashFlowOverview,
        SideAnalysis incomeAnalysis,
        SideAnalysis expenseAnalysis,
        List<CategorySlice> categoryBreakdown,
        List<AccountSlice> accountAnalysis,
        boolean allStartingBalancesConfigured,
        List<MethodSlice> paymentMethodAnalysis,
        TransactionCounts transactionCount,
        List<DailyFlow> dailyCashFlow,
        List<LargeTransaction> largestTransactions,
        PreviousComparison previousMonthComparison,
        List<CategoryTrend> categoryTrends,
        List<CashFlowTrend> cashFlowTrends,
        List<String> keyInsights) {

    public record CashFlowOverview(BigDecimal moneyIn, BigDecimal moneyOut,
                                   BigDecimal netCashFlow, long txnCount) {
    }

    public record SideAnalysis(BigDecimal total, long txnCount, BigDecimal largest,
                               String largestDescription, List<CategorySlice> byCategory) {
    }

    public record CategorySlice(String name, BigDecimal amount, long txnCount,
                                BigDecimal percentOfSide) {
    }

    public record AccountSlice(UUID accountId, String name, String accountType,
                               BigDecimal totalInflow, BigDecimal totalOutflow,
                               BigDecimal netMovement, BigDecimal startingBalance,
                               BigDecimal currentBalance) {
    }

    public record MethodSlice(String method, BigDecimal amount, long txnCount) {
    }

    public record TransactionCounts(long total, long incoming, long outgoing, long transfers) {
    }

    public record DailyFlow(LocalDate date, BigDecimal inflow, BigDecimal outflow, BigDecimal net) {
    }

    public record LargeTransaction(UUID id, String type, BigDecimal amount,
                                   String description, LocalDate date) {
    }

    public record PreviousComparison(String previousMonth,
                                     BigDecimal previousIn, BigDecimal previousOut,
                                     BigDecimal inDelta, BigDecimal outDelta) {
    }

    public record CategoryTrend(String category, List<MonthPoint> months) {
        public record MonthPoint(String month, BigDecimal outgoing) {
        }
    }

    public record CashFlowTrend(String month, BigDecimal in, BigDecimal out, BigDecimal net) {
    }
}
