package com.soham.expencetracker.service;

import com.soham.expencetracker.exception.InvalidRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SplitAlgorithmsTest {

    @Test
    void distributeEqual_dividesCleanly() {
        List<BigDecimal> shares = SplitAlgorithms.distributeEqual(new BigDecimal("300.00"), 3);
        assertThat(shares).extracting(BigDecimal::toPlainString)
                .containsExactly("100.00", "100.00", "100.00");
    }

    @Test
    void distributeEqual_givesLeftoverCentsToEarliestParticipants() {
        List<BigDecimal> shares = SplitAlgorithms.distributeEqual(new BigDecimal("100.00"), 3);
        assertThat(sum(shares)).isEqualByComparingTo("100.00");
        assertThat(shares).extracting(BigDecimal::toPlainString)
                .containsExactly("33.34", "33.33", "33.33");
    }

    @Test
    void distributeByUnits_usesLargestRemainder() {
        List<BigDecimal> shares = SplitAlgorithms.distributeByUnits(
                new BigDecimal("10.00"), List.of(new BigDecimal("3"), new BigDecimal("2"), new BigDecimal("1")));
        assertThat(sum(shares)).isEqualByComparingTo("10.00");
        assertThat(shares).extracting(BigDecimal::toPlainString)
                .containsExactly("5.00", "3.33", "1.67");
    }

    @Test
    void distributeByUnits_singleCentTieBreaksByRequestOrder() {
        List<BigDecimal> shares = SplitAlgorithms.distributeByUnits(
                new BigDecimal("0.01"), List.of(BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE));
        assertThat(sum(shares)).isEqualByComparingTo("0.01");
        assertThat(shares).extracting(BigDecimal::toPlainString)
                .containsExactly("0.01", "0.00", "0.00");
    }

    @Test
    void distributePercentage_rejectsIncompletePercentages() {
        assertThatThrownBy(() -> SplitAlgorithms.distributePercentage(new BigDecimal("200"),
                List.of(new BigDecimal("50"), new BigDecimal("40"))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("exactly 100%");
    }

    @Test
    void distributePercentage_computesRatioShares() {
        List<BigDecimal> shares = SplitAlgorithms.distributePercentage(new BigDecimal("200.00"),
                List.of(new BigDecimal("60"), new BigDecimal("40")));
        assertThat(sum(shares)).isEqualByComparingTo("200.00");
        assertThat(shares).extracting(BigDecimal::toPlainString)
                .containsExactly("120.00", "80.00");
    }

    @Test
    void distributeExact_rejectsMismatchedTotal() {
        assertThatThrownBy(() -> SplitAlgorithms.distributeExact(new BigDecimal("90"),
                List.of(new BigDecimal("50"), new BigDecimal("30"))))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("must add up to the total");
    }

    @Test
    void distributeExact_passesThroughValidShares() {
        List<BigDecimal> shares = SplitAlgorithms.distributeExact(new BigDecimal("90.00"),
                List.of(new BigDecimal("50.00"), new BigDecimal("40.00")));
        assertThat(shares).extracting(BigDecimal::toPlainString)
                .containsExactly("50.00", "40.00");
    }

    @Test
    void greedyPairing_singleDebtorCreditor() {
        Map<UUID, BigDecimal> nets = new LinkedHashMap<>();
        UUID payer = UUID.randomUUID();
        UUID ower = UUID.randomUUID();
        nets.put(payer, new BigDecimal("60"));
        nets.put(ower, new BigDecimal("-60"));

        List<SplitAlgorithms.LedgerEntry> entries = SplitAlgorithms.greedyPairing(nets);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).debtorId()).isEqualTo(ower);
        assertThat(entries.get(0).creditorId()).isEqualTo(payer);
        assertThat(entries.get(0).amount()).isEqualByComparingTo("60");
    }

    @Test
    void greedyPairing_matchesLargestDebtorToLargestCreditor() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        UUID d = UUID.randomUUID();

        Map<UUID, BigDecimal> nets = new LinkedHashMap<>();
        nets.put(a, new BigDecimal("60"));
        nets.put(b, new BigDecimal("40"));
        nets.put(c, new BigDecimal("-70"));
        nets.put(d, new BigDecimal("-30"));

        List<SplitAlgorithms.LedgerEntry> entries = SplitAlgorithms.greedyPairing(nets);

        assertThat(entries).hasSize(3);
        assertThat(entries)
                .extracting(e -> e.debtorId() + "->" + e.creditorId() + ":" + e.amount().toPlainString())
                .containsExactlyInAnyOrder(
                        c + "->" + a + ":60",
                        c + "->" + b + ":10",
                        d + "->" + b + ":30");
    }

    @Test
    void greedyPairing_ignoresSettledPositions() {
        Map<UUID, BigDecimal> nets = new LinkedHashMap<>();
        nets.put(UUID.randomUUID(), BigDecimal.ZERO);
        nets.put(UUID.randomUUID(), BigDecimal.ZERO);

        assertThat(SplitAlgorithms.greedyPairing(nets)).isEmpty();
    }

    private BigDecimal sum(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
