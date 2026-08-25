package com.soham.expencetracker.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.ToLongFunction;

/**
 * Shared report math per PRD §31: zero-denominator safety, percentages,
 * alphabetical tie-breaking (§15), burn-rate verdicts and week bucketing.
 */
public final class ReportMath {

    private ReportMath() {
    }

    public static BigDecimal pct(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() <= 0) {
            return null;
        }
        return part.multiply(BigDecimal.valueOf(100)).divide(whole, 1, RoundingMode.HALF_UP);
    }

    public static BigDecimal pct(long part, long whole) {
        return whole <= 0 ? null
                : BigDecimal.valueOf(part * 100L).divide(BigDecimal.valueOf(whole), 1, RoundingMode.HALF_UP);
    }

    /**
     * §15 tie rule: equal values are broken by alphabetical order of the
     * name — the alphabetically FIRST name wins in both directions.
     */
    public static <T> T maxByAmountThenName(List<T> items,
                                            Function<T, BigDecimal> amount,
                                            Function<T, String> name) {
        return items.stream()
                .max(Comparator.comparing(amount)
                        .thenComparing(name, Comparator.reverseOrder()))
                .orElse(null);
    }

    public static <T> T minByAmountThenName(List<T> items,
                                            Function<T, BigDecimal> amount,
                                            Function<T, String> name) {
        return items.stream()
                .min(Comparator.comparing(amount).thenComparing(name))
                .orElse(null);
    }

    public static <T> T maxByCountThenName(List<T> items,
                                           ToLongFunction<T> count,
                                           Function<T, String> name) {
        return items.stream()
                .max(Comparator.comparingLong(count)
                        .thenComparing(name, Comparator.reverseOrder()))
                .orElse(null);
    }

    /**
     * §16.1 burn-rate verdict: compares elapsed month progress with the
     * percentage of budget already used.
     */
    public static String burnVerdict(BigDecimal usedPercent, BigDecimal elapsedPercent) {
        if (usedPercent == null || elapsedPercent == null) {
            return "not enough data";
        }
        int diff = usedPercent.subtract(elapsedPercent).intValue();
        if (diff > 5) {
            return "ahead of the month";
        }
        if (diff < -5) {
            return "behind the month";
        }
        return "roughly on track";
    }

    /**
     * §16.2 projection: average daily Ideal outgoing × days in month.
     * Purely analytical — never mutates records.
     */
    public static BigDecimal projectMonthEnd(BigDecimal outgoingSoFar, LocalDate periodStart,
                                             LocalDate periodEnd, LocalDate today) {
        long daysInMonth = periodEnd.toEpochDay() - periodStart.toEpochDay() + 1;
        LocalDate effectiveToday = today.isAfter(periodEnd) ? periodEnd : today;
        long elapsed = effectiveToday.toEpochDay() - periodStart.toEpochDay() + 1;
        if (elapsed <= 0 || outgoingSoFar == null || outgoingSoFar.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal avgPerDay = outgoingSoFar.divide(BigDecimal.valueOf(elapsed), 4, RoundingMode.HALF_UP);
        return avgPerDay.multiply(BigDecimal.valueOf(daysInMonth)).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Buckets a month into Monday-start weeks clipped to the month.
     */
    public static List<ReportPeriod> weekBuckets(ReportPeriod month) {
        var buckets = new java.util.ArrayList<ReportPeriod>();
        LocalDate cursor = month.start();
        while (!cursor.isAfter(month.end())) {
            LocalDate weekStart = cursor.with(java.time.temporal.TemporalAdjusters
                    .previousOrSame(DayOfWeek.MONDAY));
            LocalDate bucketStart = weekStart.isBefore(month.start()) ? month.start() : weekStart;
            LocalDate bucketEnd = weekStart.plusDays(6);
            if (bucketEnd.isAfter(month.end())) {
                bucketEnd = month.end();
            }
            buckets.add(new ReportPeriod(bucketStart, bucketEnd));
            cursor = bucketEnd.plusDays(1);
        }
        return buckets;
    }

    public static BigDecimal sum(Map<?, BigDecimal> amounts) {
        return amounts.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Top-N by amount descending, ties broken by most recent date first.
     */
    public static <T> List<T> topByAmountDesc(List<T> items, Function<T, BigDecimal> amount,
                                              Function<T, LocalDate> date, int limit) {
        return items.stream()
                .sorted(Comparator.comparing(amount).reversed()
                        .thenComparing(date, Comparator.reverseOrder()))
                .limit(limit)
                .toList();
    }
}
