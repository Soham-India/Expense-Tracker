package com.soham.expencetracker.report;

import com.soham.expencetracker.entity.IdealMonthEntity;
import com.soham.expencetracker.entity.IdealTransactionEntity;
import com.soham.expencetracker.entity.IdealTxnType;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.repository.IdealMonthRepository;
import com.soham.expencetracker.repository.IdealTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 🎯 Ideal reporting engine (§15 weekly, §16 monthly). All values are
 * derived at query time; projections never mutate records (§31).
 */
@Service
@RequiredArgsConstructor
public class IdealReportService {

    private static final String UNCATEGORIZED = "Uncategorized";

    private final IdealTransactionRepository transactionRepository;
    private final IdealMonthRepository monthRepository;

    @Transactional(readOnly = true)
    public IdealWeeklyReport weekly(UUID userId, String ref) {
        ReportPeriod week = ReportPeriod.weekly(parseDateRef(ref));
        List<IdealTransactionEntity> txns = fetch(userId, week.start(), week.end());

        BigDecimal incoming = sumByType(txns, IdealTxnType.INCOMING);
        BigDecimal outgoing = sumByType(txns, IdealTxnType.OUTGOING);

        YearMonth anchorMonth = YearMonth.from(week.start());
        BigDecimal monthUsed = monthUtilization(userId, anchorMonth);
        BigDecimal monthRemaining = monthRemaining(userId, anchorMonth);

        List<IdealWeeklyReport.CategorySlice> categories = categorySlices(txns, outgoing);
        List<IdealWeeklyReport.DailyPoint> daily = dailySpending(txns, week.start(), week.end());

        return new IdealWeeklyReport(
                week.start(),
                week.end(),
                incoming,
                outgoing,
                monthUsed,
                monthRemaining,
                categories,
                daily,
                dayHighlight(daily, true),
                dayHighlight(daily, false),
                extremeCategory(categories, true),
                extremeCategory(categories, false),
                mostFrequentCategory(txns));
    }

    @Transactional(readOnly = true)
    public IdealMonthlyReport monthly(UUID userId, String ref) {
        YearMonth month = parseMonthRef(ref);
        ReportPeriod period = ReportPeriod.monthly(month.atDay(1));
        List<IdealTransactionEntity> txns = fetch(userId, period.start(), period.end());

        BigDecimal incomingFromTxns = sumByType(txns, IdealTxnType.INCOMING);
        BigDecimal outgoing = sumByType(txns, IdealTxnType.OUTGOING);
        BigDecimal startingIncoming = monthRow(userId, month)
                .map(IdealMonthEntity::getStartingIncoming).orElse(BigDecimal.ZERO);
        BigDecimal totalIncoming = startingIncoming.add(incomingFromTxns);
        BigDecimal remaining = totalIncoming.subtract(outgoing);
        boolean overBudget = remaining.signum() < 0;
        BigDecimal utilization = ReportMath.pct(outgoing, totalIncoming);

        List<IdealWeeklyReport.DailyPoint> daily = dailySpending(txns, period.start(), period.end());

        BigDecimal prevIncoming = monthTotalIncoming(userId, month.minusMonths(1));
        BigDecimal prevOutgoing = monthOutgoing(userId, month.minusMonths(1));
        BigDecimal outgoingDelta = outgoing.subtract(prevOutgoing);

        List<IdealMonthlyReport.CategorySlice> categories = monthlyCategorySlices(txns, outgoing);
        List<IdealMonthlyReport.CategoryTrend> trends = categoryTrends(userId, month);

        BigDecimal usedPercent = utilization;
        BigDecimal elapsedPercent = ReportMath.pct(elapsedDays(period), period.end().toEpochDay()
                - period.start().toEpochDay() + 1);
        BigDecimal projection = ReportMath.projectMonthEnd(outgoing, period.start(), period.end(), LocalDate.now());
        boolean fullMonthActual = LocalDate.now().isAfter(period.end());

        List<String> insights = buildInsights(usedPercent, elapsedPercent, overBudget, remaining,
                categories, outgoing, projection, fullMonthActual, outgoingDelta, month, txns, totalIncoming,
                period);

        return new IdealMonthlyReport(
                month.toString(),
                new IdealMonthlyReport.Overview(totalIncoming, outgoing, remaining, overBudget, utilization),
                incomingAnalysis(txns, startingIncoming, incomingFromTxns),
                new IdealMonthlyReport.OverBudgetAnalysis(overBudget,
                        overBudget ? remaining.negate() : BigDecimal.ZERO,
                        crossedOn(txns, totalIncoming)),
                daily,
                weeklySlices(period, txns),
                categories,
                subcategorySlices(txns),
                frequencySlices(txns),
                dayHighlight(daily, true),
                dayHighlight(daily, false),
                new IdealMonthlyReport.BurnRate(usedPercent, elapsedPercent,
                        ReportMath.burnVerdict(usedPercent, elapsedPercent)),
                new IdealMonthlyReport.Projection(projection, fullMonthActual),
                new IdealMonthlyReport.PreviousComparison(month.minusMonths(1).toString(),
                        prevIncoming, prevOutgoing, outgoingDelta,
                        prevOutgoing.signum() > 0
                                ? outgoingDelta.multiply(BigDecimal.valueOf(100))
                                        .divide(prevOutgoing, 1, java.math.RoundingMode.HALF_UP)
                                : null),
                trends,
                insights);
    }

    // ------------------------------------------------------------------

    private List<IdealTransactionEntity> fetch(UUID userId, LocalDate start, LocalDate end) {
        return transactionRepository.findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(userId, start, end);
    }

    private BigDecimal sumByType(List<IdealTransactionEntity> txns, IdealTxnType type) {
        return txns.stream().filter(t -> t.getType() == type)
                .map(IdealTransactionEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private java.util.Optional<IdealMonthEntity> monthRow(UUID userId, YearMonth month) {
        return monthRepository.findByUserIdAndMonth(userId, month.atDay(1));
    }

    private BigDecimal monthUtilization(UUID userId, YearMonth month) {
        BigDecimal totalIn = monthTotalIncoming(userId, month);
        BigDecimal out = monthOutgoing(userId, month);
        return ReportMath.pct(out, totalIn);
    }

    private BigDecimal monthRemaining(UUID userId, YearMonth month) {
        return monthTotalIncoming(userId, month).subtract(monthOutgoing(userId, month));
    }

    private BigDecimal monthTotalIncoming(UUID userId, YearMonth month) {
        ReportPeriod period = ReportPeriod.monthly(month.atDay(1));
        BigDecimal fromTxns = sumByType(fetch(userId, period.start(), period.end()), IdealTxnType.INCOMING);
        return monthRow(userId, month)
                .map(row -> row.getStartingIncoming().add(fromTxns))
                .orElse(fromTxns);
    }

    private BigDecimal monthOutgoing(UUID userId, YearMonth month) {
        ReportPeriod period = ReportPeriod.monthly(month.atDay(1));
        return sumByType(fetch(userId, period.start(), period.end()), IdealTxnType.OUTGOING);
    }

    private String nameOf(IdealTransactionEntity txn) {
        return txn.getCategory() != null ? txn.getCategory().getName() : UNCATEGORIZED;
    }

    private List<IdealWeeklyReport.CategorySlice> categorySlices(
            List<IdealTransactionEntity> txns, BigDecimal outgoingTotal) {
        Map<String, BigDecimal> byName = new LinkedHashMap<>();
        txns.stream().filter(t -> t.getType() == IdealTxnType.OUTGOING)
                .forEach(t -> byName.merge(nameOf(t), t.getAmount(), BigDecimal::add));
        return byName.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()
                        .thenComparing(Map.Entry::getKey))
                .map(e -> new IdealWeeklyReport.CategorySlice(e.getKey(), e.getValue(),
                        ReportMath.pct(e.getValue(), outgoingTotal)))
                .toList();
    }

    private List<IdealMonthlyReport.CategorySlice> monthlyCategorySlices(
            List<IdealTransactionEntity> txns, BigDecimal outgoingTotal) {
        Map<String, List<IdealTransactionEntity>> byName = new LinkedHashMap<>();
        txns.stream().filter(t -> t.getType() == IdealTxnType.OUTGOING)
                .forEach(t -> byName.computeIfAbsent(nameOf(t), k -> new ArrayList<>()).add(t));
        List<IdealMonthlyReport.CategorySlice> slices = new ArrayList<>();
        for (Map.Entry<String, List<IdealTransactionEntity>> entry : byName.entrySet()) {
            BigDecimal amount = entry.getValue().stream()
                    .map(IdealTransactionEntity::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            slices.add(new IdealMonthlyReport.CategorySlice(
                    entry.getKey(), amount,
                    ReportMath.pct(amount, outgoingTotal), entry.getValue().size()));
        }
        slices.sort(java.util.Comparator.comparing(IdealMonthlyReport.CategorySlice::amount)
                .reversed()
                .thenComparing(IdealMonthlyReport.CategorySlice::name));
        return slices;
    }

    private List<IdealWeeklyReport.DailyPoint> dailySpending(
            List<IdealTransactionEntity> txns, LocalDate start, LocalDate end) {
        Map<LocalDate, BigDecimal> byDay = new LinkedHashMap<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            byDay.put(d, BigDecimal.ZERO);
        }
        txns.stream().filter(t -> t.getType() == IdealTxnType.OUTGOING)
                .forEach(t -> byDay.merge(t.getTxnDate(), t.getAmount(), BigDecimal::add));
        return byDay.entrySet().stream()
                .map(e -> new IdealWeeklyReport.DailyPoint(e.getKey(), e.getValue()))
                .toList();
    }

    private IdealWeeklyReport.DayHighlight dayHighlight(List<IdealWeeklyReport.DailyPoint> daily,
                                                        boolean highest) {
        List<IdealWeeklyReport.DailyPoint> candidates = highest
                ? daily
                : daily.stream().filter(p -> p.amount().signum() > 0).toList();
        if (candidates.isEmpty()) {
            return null;
        }
        IdealWeeklyReport.DailyPoint winner = highest
                ? ReportMath.maxByAmountThenName(candidates,
                        IdealWeeklyReport.DailyPoint::amount, p -> p.date().toString())
                : ReportMath.minByAmountThenName(candidates,
                        IdealWeeklyReport.DailyPoint::amount, p -> p.date().toString());
        return new IdealWeeklyReport.DayHighlight(winner.date(), winner.amount());
    }

    private String extremeCategory(List<IdealWeeklyReport.CategorySlice> categories, boolean highest) {
        List<IdealWeeklyReport.CategorySlice> withSpend = categories.stream()
                .filter(c -> c.amount().signum() > 0).toList();
        if (withSpend.isEmpty()) {
            return null;
        }
        IdealWeeklyReport.CategorySlice winner = highest
                ? ReportMath.maxByAmountThenName(withSpend,
                        IdealWeeklyReport.CategorySlice::amount, IdealWeeklyReport.CategorySlice::name)
                : ReportMath.minByAmountThenName(withSpend,
                        IdealWeeklyReport.CategorySlice::amount, IdealWeeklyReport.CategorySlice::name);
        return winner.name();
    }

    private String mostFrequentCategory(List<IdealTransactionEntity> txns) {
        Map<String, Long> counts = new LinkedHashMap<>();
        txns.stream().filter(t -> t.getType() == IdealTxnType.OUTGOING)
                .forEach(t -> counts.merge(nameOf(t), 1L, Long::sum));
        if (counts.isEmpty()) {
            return null;
        }
        List<Map.Entry<String, Long>> entries = new ArrayList<>(counts.entrySet());
        return ReportMath.maxByCountThenName(entries, Map.Entry::getValue, Map.Entry::getKey).getKey();
    }

    private IdealMonthlyReport.IncomingAnalysis incomingAnalysis(List<IdealTransactionEntity> txns,
                                                                 BigDecimal starting, BigDecimal additional) {
        List<IdealTransactionEntity> incoming = txns.stream()
                .filter(t -> t.getType() == IdealTxnType.INCOMING).toList();
        IdealTransactionEntity largest = ReportMath.maxByAmountThenName(incoming,
                IdealTransactionEntity::getAmount,
                t -> t.getDescription() != null ? t.getDescription() : "");
        return new IdealMonthlyReport.IncomingAnalysis(starting, additional,
                starting.add(additional), incoming.size(),
                largest != null ? largest.getAmount() : null,
                largest != null ? largest.getDescription() : null);
    }

    private LocalDate crossedOn(List<IdealTransactionEntity> txns, BigDecimal totalIncoming) {
        if (totalIncoming.signum() <= 0) {
            return null;
        }
        BigDecimal cumulative = BigDecimal.ZERO;
        List<IdealTransactionEntity> outgoingSorted = txns.stream()
                .filter(t -> t.getType() == IdealTxnType.OUTGOING)
                .sorted(java.util.Comparator.comparing(IdealTransactionEntity::getTxnDate))
                .toList();
        for (IdealTransactionEntity t : outgoingSorted) {
            cumulative = cumulative.add(t.getAmount());
            if (cumulative.compareTo(totalIncoming) > 0) {
                return t.getTxnDate();
            }
        }
        return null;
    }

    private List<IdealMonthlyReport.WeekSlice> weeklySlices(ReportPeriod period,
                                                            List<IdealTransactionEntity> txns) {
        return ReportMath.weekBuckets(period).stream()
                .map(bucket -> new IdealMonthlyReport.WeekSlice(bucket.start(),
                        txns.stream()
                                .filter(t -> t.getType() == IdealTxnType.OUTGOING
                                        && bucket.contains(t.getTxnDate()))
                                .map(IdealTransactionEntity::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
    }

    private List<IdealMonthlyReport.SubcategorySlice> subcategorySlices(
            List<IdealTransactionEntity> txns) {
        Map<String, BigDecimal> byKey = new LinkedHashMap<>();
        txns.stream().filter(t -> t.getType() == IdealTxnType.OUTGOING && t.getSubcategory() != null)
                .forEach(t -> byKey.merge(nameOf(t) + " / " + t.getSubcategory().getName(),
                        t.getAmount(), BigDecimal::add));
        return byKey.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()
                        .thenComparing(Map.Entry::getKey))
                .map(e -> {
                    String[] parts = e.getKey().split(" / ", 2);
                    return new IdealMonthlyReport.SubcategorySlice(parts[0], parts[1], e.getValue());
                })
                .toList();
    }

    private List<IdealMonthlyReport.FrequencySlice> frequencySlices(List<IdealTransactionEntity> txns) {
        Map<String, List<IdealTransactionEntity>> byName = new LinkedHashMap<>();
        txns.stream().filter(t -> t.getType() == IdealTxnType.OUTGOING)
                .forEach(t -> byName.computeIfAbsent(nameOf(t), k -> new ArrayList<>()).add(t));
        List<IdealMonthlyReport.FrequencySlice> slices = new ArrayList<>();
        for (Map.Entry<String, List<IdealTransactionEntity>> entry : byName.entrySet()) {
            BigDecimal total = entry.getValue().stream()
                    .map(IdealTransactionEntity::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            slices.add(new IdealMonthlyReport.FrequencySlice(
                    entry.getKey(), entry.getValue().size(), total));
        }
        slices.sort(java.util.Comparator.comparingLong(IdealMonthlyReport.FrequencySlice::txnCount)
                .reversed()
                .thenComparing(IdealMonthlyReport.FrequencySlice::name));
        return slices;
    }

    private long elapsedDays(ReportPeriod period) {
        LocalDate today = LocalDate.now();
        LocalDate effective = today.isBefore(period.start()) ? period.start()
                : today.isAfter(period.end()) ? period.end() : today;
        return effective.toEpochDay() - period.start().toEpochDay() + 1;
    }

    private List<IdealMonthlyReport.CategoryTrend> categoryTrends(UUID userId, YearMonth endMonth) {
        YearMonth startMonth = endMonth.minusMonths(5);
        ReportPeriod span = ReportPeriod.monthly(startMonth.atDay(1));
        ReportPeriod end = ReportPeriod.monthly(endMonth.atDay(1));
        List<IdealTransactionEntity> txns = fetch(userId,
                span.start().isBefore(end.start()) ? span.start() : end.start(),
                end.end());

        Map<String, Map<YearMonth, BigDecimal>> byCategory = new LinkedHashMap<>();
        for (IdealTransactionEntity t : txns) {
            if (t.getType() != IdealTxnType.OUTGOING) {
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
                .map(e -> new IdealMonthlyReport.CategoryTrend(e.getKey(), months.stream()
                        .map(m -> new IdealMonthlyReport.CategoryTrend.MonthPoint(m.toString(),
                                e.getValue().getOrDefault(m, BigDecimal.ZERO)))
                        .toList()))
                .toList();
    }

    private List<String> buildInsights(BigDecimal usedPercent, BigDecimal elapsedPercent,
                                       boolean overBudget, BigDecimal remaining,
                                       List<IdealMonthlyReport.CategorySlice> categories,
                                       BigDecimal outgoing, BigDecimal projection, boolean fullMonth,
                                       BigDecimal outgoingDelta, YearMonth month,
                                       List<IdealTransactionEntity> txns, BigDecimal totalIncoming,
                                       ReportPeriod period) {
        List<String> insights = new ArrayList<>();
        if (totalIncoming.signum() > 0) {
            insights.add("You have used " + usedPercent + "% of your Ideal budget with "
                    + elapsedPercent + "% of the month elapsed — "
                    + ReportMath.burnVerdict(usedPercent, elapsedPercent) + ".");
        }
        if (overBudget) {
            insights.add("Your Ideal plan is over budget by " + remaining.negate()
                    + " for " + month + ".");
        } else {
            insights.add("Budget Remaining for " + month + ": " + remaining + ".");
        }
        if (!categories.isEmpty()) {
            var top = categories.get(0);
            insights.add("'" + top.name() + "' is your largest Ideal outflow at " + top.amount()
                    + " (" + top.percentOfMonth() + "% of the month).");
        }
        if (!fullMonth && projection.signum() > 0) {
            insights.add("At the current pace, projected Ideal outflow for the month is "
                    + projection + " (analytical projection, not a recorded value).");
        }
        if (outgoingDelta.signum() != 0) {
            insights.add("Ideal outflow was " + outgoingDelta.abs() + " "
                    + (outgoingDelta.signum() > 0 ? "higher" : "lower") + " than "
                    + month.minusMonths(1) + ".");
        }
        String frequent = mostFrequentCategory(txns);
        if (frequent != null) {
            insights.add("'" + frequent + "' had the most Ideal entries this month.");
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
