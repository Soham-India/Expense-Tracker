package com.soham.expencetracker.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 💳 Actual Weekly Report (§17): "what happened to my real money this
 * week". Deliberately contains no Ideal budget figures.
 */
public record ActualWeeklyReport(
        LocalDate weekStart,
        LocalDate weekEnd,
        BigDecimal moneyIn,
        BigDecimal moneyOut,
        BigDecimal netCashFlow,
        List<CategorySlice> incomeBreakdown,
        List<CategorySlice> expenseBreakdown,
        List<MethodSlice> paymentMethodBreakdown,
        List<DailyFlow> dailyCashFlow) {

    public record CategorySlice(String name, BigDecimal amount, long txnCount) {
    }

    public record MethodSlice(String method, BigDecimal amount, long txnCount) {
    }

    public record DailyFlow(LocalDate date, BigDecimal inflow, BigDecimal outflow, BigDecimal net) {
    }
}
