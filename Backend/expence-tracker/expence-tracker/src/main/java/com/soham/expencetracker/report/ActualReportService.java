package com.soham.expencetracker.report;

import com.soham.expencetracker.entity.AccountEntity;
import com.soham.expencetracker.entity.ActualTransactionEntity;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.repository.AccountRepository;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 💳 Actual reporting engine (§17 weekly, §18 monthly). Never computes
 * Ideal budget figures; account balances appear only where starting
 * balances exist (§6.6).
 */
@Service
@RequiredArgsConstructor
public class ActualReportService {

    private static final String UNCATEGORIZED = "Uncategorized";

    private final ActualTransactionRepository transactionRepository;
    private final AccountRepository accountRepository;

    @Transactional(readOnly = true)
    public ActualWeeklyReport weekly(UUID userId, String ref) {
        ReportPeriod week = ReportPeriod.weekly(parseDateRef(ref));
        List<ActualTransactionEntity> txns = fetch(userId, week.start(), week.end());

        BigDecimal moneyIn = sumByType(txns, ActualTxnType.INCOMING);
        BigDecimal moneyOut = sumByType(txns, ActualTxnType.OUTGOING);

        return new ActualWeeklyReport(
                week.start(),
                week.end(),
                moneyIn,
                moneyOut,
                moneyIn.subtract(moneyOut),
                sideBreakdown(txns, ActualTxnType.INCOMING),
                sideBreakdown(txns, ActualTxnType.OUTGOING),
                methodBreakdown(txns),
                dailyFlows(txns, week.start(), week.end()));
    }

    @Transactional(readOnly = true)
    public ActualMonthlyReport monthly(UUID userId, String ref) {
        YearMonth month = parseMonthRef(ref);
        ReportPeriod period = ReportPeriod.monthly(month.atDay(1));
        List<ActualTransactionEntity> txns = fetch(userId, period.start(), period.end());

        BigDecimal moneyIn = sumByType(txns, ActualTxnType.INCOMING);
        BigDecimal moneyOut = sumByType(txns, ActualTxnType.OUTGOING);

        List<AccountEntity> accounts = accountRepository.findByUserIdOrderByNameAsc(userId);
        boolean allConfigured = !accounts.isEmpty() && accounts.stream()
                .allMatch(a -> a.getStartingBalance() != null);
        List<ActualMonthlyReport.AccountSlice> accountSlices = accounts.stream()
                .map(account -> accountSlice(txns, account))
                .toList();

        List<ActualMonthlyReport.PreviousComparison> prev = List.of(previousComparison(userId, month));
        var comparison = prev.get(0);

        ActualMonthlyReport.SideAnalysis incomeAnalysis = sideAnalysis(txns, ActualTxnType.INCOMING, moneyIn);
        ActualMonthlyReport.SideAnalysis expenseAnalysis = sideAnalysis(txns, ActualTxnType.OUTGOING, moneyOut);
        List<ActualMonthlyReport.CategorySlice> categories = expenseAnalysis.byCategory();
        List<ActualMonthlyReport.CashFlowTrend> trends = cashFlowTrends(userId, month);
        List<ActualMonthlyReport.CategoryTrend> categoryTrends = categoryTrends(userId, month);

        return new ActualMonthlyReport(
                month.toString(),
                new ActualMonthlyReport.CashFlowOverview(moneyIn, moneyOut,
                        moneyIn.subtract(moneyOut), txns.size()),
                incomeAnalysis,
                expenseAnalysis,
                categories,
                accountSlices,
                allConfigured,
                methodBreakdown(txns).stream()
                        .map(m -> new ActualMonthlyReport.MethodSlice(m.method(), m.amount(), m.txnCount()))
                        .toList(),
                new ActualMonthlyReport.TransactionCounts(
                        txns.size(),
                        countByType(txns, ActualTxnType.INCOMING),
                        countByType(txns, ActualTxnType.OUTGOING),
                        countByType(txns, ActualTxnType.TRANSFER)),
                dailyFlows(txns, period.start(), period.end()).stream()
                        .map(d -> new ActualMonthlyReport.DailyFlow(d.date(), d.inflow(),
                                d.outflow(), d.net()))
                        .toList(),
                largestTransactions(txns),
                comparison,
                categoryTrends,
                trends,
                buildInsights(moneyIn, moneyOut, categories, txns, comparison, allConfigured));
    }

    // ------------------------------------------------------------------

    private List<ActualTransactionEntity> fetch(UUID userId, LocalDate start, LocalDate end) {
        return transactionRepository.findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(userId, start, end);
    }

    private BigDecimal sumByType(List<ActualTransactionEntity> txns, ActualTxnType type) {
        return txns.stream().filter(t -> t.getType() == type)
                .map(ActualTransactionEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private long countByType(List<ActualTransactionEntity> txns, ActualTxnType type) {
        return txns.stream().filter(t -> t.getType() == type).count();
    }

    private String nameOf(ActualTransactionEntity txn) {
        return txn.getCategory() != null ? txn.getCategory().getName() : UNCATEGORIZED;
    }

    private List<ActualWeeklyReport.CategorySlice> sideBreakdown(List<ActualTransactionEntity> txns,
                                                                 ActualTxnType type) {
        Map<String, List<ActualTransactionEntity>> byName = new LinkedHashMap<>();
        txns.stream().filter(t -> t.getType() == type)
                .forEach(t -> byName.computeIfAbsent(nameOf(t), k -> new ArrayList<>()).add(t));
        return byName.entrySet().stream()
                .map(e -> new ActualWeeklyReport.CategorySlice(e.getKey(),
                        e.getValue().stream().map(ActualTransactionEntity::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add),
                        e.getValue().size()))
                .sorted(Comparator.comparing(ActualWeeklyReport.CategorySlice::amount).reversed()
                        .thenComparing(ActualWeeklyReport.CategorySlice::name))
                .toList();
    }

    private List<ActualWeeklyReport.MethodSlice> methodBreakdown(List<ActualTransactionEntity> txns) {
        Map<String, List<ActualTransactionEntity>> byMethod = new LinkedHashMap<>();
        txns.stream().filter(t -> t.getPaymentMethod() != null)
                .forEach(t -> byMethod.computeIfAbsent(t.getPaymentMethod().name(),
                        k -> new ArrayList<>()).add(t));
        return byMethod.entrySet().stream()
                .map(e -> new ActualWeeklyReport.MethodSlice(e.getKey(),
                        e.getValue().stream().map(ActualTransactionEntity::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add),
                        e.getValue().size()))
                .sorted(Comparator.comparing(ActualWeeklyReport.MethodSlice::amount).reversed()
                        .thenComparing(ActualWeeklyReport.MethodSlice::method))
                .toList();
    }

    private List<ActualWeeklyReport.DailyFlow> dailyFlows(List<ActualTransactionEntity> txns,
                                                          LocalDate start, LocalDate end) {
        Map<LocalDate, BigDecimal[]> byDay = new LinkedHashMap<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            byDay.put(d, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
        }
        for (ActualTransactionEntity t : txns) {
            if (t.getType() == ActualTxnType.TRANSFER) {
                continue;
            }
            BigDecimal[] bucket = byDay.get(t.getTxnDate());
            if (bucket == null) {
                continue;
            }
            if (t.getType() == ActualTxnType.INCOMING) {
                bucket[0] = bucket[0].add(t.getAmount());
            } else {
                bucket[1] = bucket[1].add(t.getAmount());
            }
        }
        return byDay.entrySet().stream()
                .map(e -> new ActualWeeklyReport.DailyFlow(e.getKey(), e.getValue()[0],
                        e.getValue()[1], e.getValue()[0].subtract(e.getValue()[1])))
                .toList();
    }

    private ActualMonthlyReport.SideAnalysis sideAnalysis(List<ActualTransactionEntity> txns,
                                                          ActualTxnType type, BigDecimal total) {
        List<ActualTransactionEntity> side = txns.stream().filter(t -> t.getType() == type).toList();
        List<ActualWeeklyReport.CategorySlice> breakdown = sideBreakdown(txns, type);
        ActualTransactionEntity largest = ReportMath.maxByAmountThenName(side,
                ActualTransactionEntity::getAmount,
                t -> t.getDescription() != null ? t.getDescription() : "");
        return new ActualMonthlyReport.SideAnalysis(total, side.size(),
                largest != null ? largest.getAmount() : null,
                largest != null ? largest.getDescription() : null,
                breakdown.stream()
                        .map(s -> new ActualMonthlyReport.CategorySlice(s.name(), s.amount(),
                                s.txnCount(), ReportMath.pct(s.amount(), total)))
                        .toList());
    }

    private ActualMonthlyReport.AccountSlice accountSlice(List<ActualTransactionEntity> txns,
                                                          AccountEntity account) {
        BigDecimal inflow = BigDecimal.ZERO;
        BigDecimal outflow = BigDecimal.ZERO;
        for (ActualTransactionEntity t : txns) {
            boolean fromAccount = t.getAccount() != null && account.getId().equals(t.getAccount().getId());
            boolean toAccount = t.getTransferToAccount() != null
                    && account.getId().equals(t.getTransferToAccount().getId());
            if (t.getType() == ActualTxnType.INCOMING && fromAccount) {
                inflow = inflow.add(t.getAmount());
            } else if (t.getType() == ActualTxnType.OUTGOING && fromAccount) {
                outflow = outflow.add(t.getAmount());
            } else if (t.getType() == ActualTxnType.TRANSFER) {
                if (fromAccount) {
                    outflow = outflow.add(t.getAmount());
                } else if (toAccount) {
                    inflow = inflow.add(t.getAmount());
                }
            }
        }
        BigDecimal currentBalance = account.getStartingBalance() == null ? null
                : account.getStartingBalance()
                        .add(transactionRepository.totalInflowForAccount(
                                account.getUser().getId(), account.getId(),
                                ActualTxnType.INCOMING, ActualTxnType.TRANSFER))
                        .subtract(transactionRepository.totalOutflowForAccount(
                                account.getUser().getId(), account.getId(),
                                java.util.EnumSet.of(ActualTxnType.OUTGOING, ActualTxnType.TRANSFER)));
        return new ActualMonthlyReport.AccountSlice(account.getId(), account.getName(),
                account.getAccountType().name(), inflow, outflow, inflow.subtract(outflow),
                account.getStartingBalance(), currentBalance);
    }

    private List<ActualMonthlyReport.LargeTransaction> largestTransactions(
            List<ActualTransactionEntity> txns) {
        return ReportMath.topByAmountDesc(txns,
                ActualTransactionEntity::getAmount,
                ActualTransactionEntity::getTxnDate,
                5)
                .stream()
                .map(t -> new ActualMonthlyReport.LargeTransaction(t.getId(), t.getType().name(),
                        t.getAmount(), t.getDescription(), t.getTxnDate()))
                .toList();
    }

    private ActualMonthlyReport.PreviousComparison previousComparison(UUID userId, YearMonth month) {
        YearMonth prev = month.minusMonths(1);
        ReportPeriod period = ReportPeriod.monthly(prev.atDay(1));
        List<ActualTransactionEntity> txns = fetch(userId, period.start(), period.end());
        BigDecimal prevIn = sumByType(txns, ActualTxnType.INCOMING);
        BigDecimal prevOut = sumByType(txns, ActualTxnType.OUTGOING);
        return new ActualMonthlyReport.PreviousComparison(prev.toString(), prevIn, prevOut, null, null);
    }

    private List<ActualMonthlyReport.CashFlowTrend> cashFlowTrends(UUID userId, YearMonth endMonth) {
        YearMonth startMonth = endMonth.minusMonths(5);
        List<ActualMonthlyReport.CashFlowTrend> trends = new ArrayList<>();
        for (YearMonth m = startMonth; !m.isAfter(endMonth); m = m.plusMonths(1)) {
            ReportPeriod period = ReportPeriod.monthly(m.atDay(1));
            List<ActualTransactionEntity> txns = fetch(userId, period.start(), period.end());
            BigDecimal in = sumByType(txns, ActualTxnType.INCOMING);
            BigDecimal out = sumByType(txns, ActualTxnType.OUTGOING);
            trends.add(new ActualMonthlyReport.CashFlowTrend(m.toString(), in, out, in.subtract(out)));
        }
        return trends;
    }

    private List<ActualMonthlyReport.CategoryTrend> categoryTrends(UUID userId, YearMonth endMonth) {
        YearMonth startMonth = endMonth.minusMonths(5);
        ReportPeriod startPeriod = ReportPeriod.monthly(startMonth.atDay(1));
        ReportPeriod endPeriod = ReportPeriod.monthly(endMonth.atDay(1));
        List<ActualTransactionEntity> txns = fetch(userId, startPeriod.start(), endPeriod.end());

        Map<String, Map<YearMonth, BigDecimal>> byCategory = new LinkedHashMap<>();
        for (ActualTransactionEntity t : txns) {
            if (t.getType() != ActualTxnType.OUTGOING) {
                continue;
            }
            byCategory.computeIfAbsent(nameOf(t), k -> new LinkedHashMap<>())
                    .merge(YearMonth.from(t.getTxnDate()), t.getAmount(), BigDecimal::add);
        }
        List<YearMonth> months = new ArrayList<>();
        for (YearMonth m = startMonth; !m.isAfter(endMonth); m = m.plusMonths(1)) {
            months.add(m);
        }
        return byCategory.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new ActualMonthlyReport.CategoryTrend(e.getKey(), months.stream()
                        .map(m -> new ActualMonthlyReport.CategoryTrend.MonthPoint(m.toString(),
                                e.getValue().getOrDefault(m, BigDecimal.ZERO)))
                        .toList()))
                .toList();
    }

    private List<String> buildInsights(BigDecimal moneyIn, BigDecimal moneyOut,
                                       List<ActualMonthlyReport.CategorySlice> categories,
                                       List<ActualTransactionEntity> txns,
                                       ActualMonthlyReport.PreviousComparison comparison,
                                       boolean allConfigured) {
        List<String> insights = new ArrayList<>();
        BigDecimal net = moneyIn.subtract(moneyOut);
        insights.add("Net cash flow for the month: " + net + " (in " + moneyIn + ", out " + moneyOut + ").");
        if (moneyIn.signum() > 0) {
            insights.add("You kept " + ReportMath.pct(net.max(BigDecimal.ZERO), moneyIn)
                    + "% of your real income this month.");
        }
        if (!categories.isEmpty()) {
            insights.add("'" + categories.get(0).name() + "' was your largest expense category at "
                    + categories.get(0).amount() + ".");
        }
        long transfers = countByType(txns, ActualTxnType.TRANSFER);
        if (transfers > 0) {
            insights.add(transfers + " transfer" + (transfers == 1 ? "" : "s") + " recorded — "
                    + "excluded from income and expense totals.");
        }
        if (comparison.previousOut() != null && comparison.previousOut().signum() > 0) {
            BigDecimal delta = moneyOut.subtract(comparison.previousOut());
            insights.add("Real outflow was " + delta.abs() + " "
                    + (delta.signum() > 0 ? "higher" : "lower") + " than " + comparison.previousMonth() + ".");
        }
        if (!allConfigured) {
            insights.add("Some accounts have no starting balance — balance figures are partial data.");
        }
        return insights;
    }

    private LocalDate parseDateRef(String ref) {
        if (ref == null || ref.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(ref.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidRequestException("ref must be a date in yyyy-MM-dd format for weekly reports");
        }
    }

    private YearMonth parseMonthRef(String ref) {
        if (ref == null || ref.isBlank()) {
            return YearMonth.now();
        }
        String trimmed = ref.trim();
        try {
            return YearMonth.parse(trimmed.length() > 7 ? trimmed.substring(0, 7) : trimmed);
        } catch (DateTimeParseException e) {
            throw new InvalidRequestException("ref must be in yyyy-MM format for monthly reports");
        }
    }
}
