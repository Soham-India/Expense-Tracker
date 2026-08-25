package com.soham.expencetracker.dto;

import java.math.BigDecimal;
import java.util.List;

public record DashboardResponse(
        String month,
        IdealBlock ideal,
        ActualBlock actual,
        SplitsBlock splits,
        RecentsBlock recents,
        HintsBlock hints) {

    public record IdealBlock(boolean monthStarted, BigDecimal totalIncoming, BigDecimal totalOutgoing,
                             BigDecimal budgetRemaining, boolean overBudget,
                             BigDecimal overBudgetAmount, BigDecimal utilizationPercent) {
    }

    public record ActualBlock(BigDecimal moneyIn, BigDecimal moneyOut, BigDecimal netCashFlow,
                              long txnCount) {
    }

    public record SplitsBlock(BigDecimal youOwe, BigDecimal owedToYou, BigDecimal netBalance) {
    }

    public record RecentsBlock(List<IdealTransactionResponse> ideal,
                               List<ActualTransactionResponse> actual,
                               List<SplitExpenseResponse> splits) {
    }

    /** §35 empty-state prompts instead of silent zeros. */
    public record HintsBlock(boolean needsIdealMonth, boolean hasNoAccounts, boolean hasNoPeople) {
    }
}
