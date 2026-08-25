package com.soham.expencetracker.report;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ReportMathTest {

    record Named(String name, BigDecimal amount) {
    }

    @Test
    void pct_zeroDenominator_returnsNull() {
        assertThat(ReportMath.pct(BigDecimal.TEN, BigDecimal.ZERO)).isNull();
        assertThat(ReportMath.pct(BigDecimal.TEN, null)).isNull();
    }

    @Test
    void pct_roundsHalfUpToOneDecimal() {
        assertThat(ReportMath.pct(new BigDecimal("115"), new BigDecimal("120")))
                .isEqualByComparingTo("95.8");
        assertThat(ReportMath.pct(new BigDecimal("1"), new BigDecimal("3")))
                .isEqualByComparingTo("33.3");
    }

    @Test
    void maxByAmountThenName_tieBreaksAlphabetically() {
        List<Named> items = List.of(new Named("zeta", new BigDecimal("50")),
                new Named("alpha", new BigDecimal("50")),
                new Named("mid", new BigDecimal("10")));
        assertThat(ReportMath.maxByAmountThenName(items, Named::amount, Named::name).name())
                .isEqualTo("alpha");
    }

    @Test
    void minByAmountThenName_tieBreaksAlphabetically() {
        List<Named> items = List.of(new Named("beta", new BigDecimal("5")),
                new Named("acorn", new BigDecimal("5")),
                new Named("big", new BigDecimal("90")));
        assertThat(ReportMath.minByAmountThenName(items, Named::amount, Named::name).name())
                .isEqualTo("acorn");
    }

    @Test
    void maxByCountThenName_tieBreaksAlphabetically() {
        List<Map.Entry<String, Long>> items = List.of(
                Map.entry("coffee", 3L),
                Map.entry("auto", 3L),
                Map.entry("food", 5L));
        assertThat(ReportMath.maxByCountThenName(items, Map.Entry::getValue, Map.Entry::getKey).getKey())
                .isEqualTo("food");
    }

    @Test
    void burnVerdict_classifiesPace() {
        assertThat(ReportMath.burnVerdict(new BigDecimal("68"), new BigDecimal("50")))
                .isEqualTo("ahead of the month");
        assertThat(ReportMath.burnVerdict(new BigDecimal("30"), new BigDecimal("50")))
                .isEqualTo("behind the month");
        assertThat(ReportMath.burnVerdict(new BigDecimal("52"), new BigDecimal("50")))
                .isEqualTo("roughly on track");
        assertThat(ReportMath.burnVerdict(null, new BigDecimal("50"))).isEqualTo("not enough data");
    }

    @Test
    void projectMonthEnd_extrapolatesAverageDaily() {
        BigDecimal projection = ReportMath.projectMonthEnd(new BigDecimal("300"),
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                LocalDate.of(2026, 8, 10));
        assertThat(projection).isEqualByComparingTo("930.00");
    }

    @Test
    void projectMonthEnd_zeroOutgoing_isZero_notCrash() {
        assertThat(ReportMath.projectMonthEnd(BigDecimal.ZERO,
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                LocalDate.of(2026, 8, 10))).isEqualByComparingTo("0");
    }

    @Test
    void topByAmountDesc_largestFirst_tiesNewestFirst() {
        record Txn(String id, BigDecimal amount, LocalDate date) {
        }
        List<Txn> txns = List.of(
                new Txn("small", new BigDecimal("300"), LocalDate.of(2026, 8, 13)),
                new Txn("salary", new BigDecimal("50000"), LocalDate.of(2026, 8, 1)),
                new Txn("mid-new", new BigDecimal("5000"), LocalDate.of(2026, 8, 14)),
                new Txn("mid-old", new BigDecimal("5000"), LocalDate.of(2026, 8, 2)));

        List<Txn> top = ReportMath.topByAmountDesc(txns, Txn::amount, Txn::date, 3);

        assertThat(top).extracting(Txn::id)
                .containsExactly("salary", "mid-new", "mid-old");
    }

    @Test
    void weeklyPeriod_runsMondayToSunday() {
        ReportPeriod week = ReportPeriod.weekly(LocalDate.of(2026, 8, 12));
        assertThat(week.start()).isEqualTo(LocalDate.of(2026, 8, 10));
        assertThat(week.end()).isEqualTo(LocalDate.of(2026, 8, 16));
    }

    @Test
    void weekBuckets_coverTheWholeMonth_contiguously() {
        ReportPeriod month = ReportPeriod.monthly(LocalDate.of(2026, 8, 1));
        List<ReportPeriod> buckets = ReportMath.weekBuckets(month);

        assertThat(buckets.get(0).start()).isEqualTo(month.start());
        assertThat(buckets.get(buckets.size() - 1).end()).isEqualTo(month.end());
        for (int i = 1; i < buckets.size(); i++) {
            assertThat(buckets.get(i).start()).isEqualTo(buckets.get(i - 1).end().plusDays(1));
        }
    }
}
