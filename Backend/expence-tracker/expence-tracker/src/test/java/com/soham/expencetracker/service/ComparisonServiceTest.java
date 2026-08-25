package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.ComparisonResponse;
import com.soham.expencetracker.dto.IdealSummaryResponse;
import com.soham.expencetracker.entity.ActualTransactionEntity;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ComparisonServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private IdealService idealService;
    @Mock
    private ActualTransactionRepository actualTransactionRepository;

    @InjectMocks
    private ComparisonService comparisonService;

    @Test
    void compare_higherActualOutflow_usesNeutralWording_neverOverspent() {
        when(idealService.summary(eq(USER_ID), eq("2026-08"))).thenReturn(summary("10000", "8000"));
        when(actualTransactionRepository
                .findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(eq(USER_ID), any(), any()))
                .thenReturn(List.of(outgoing("9500")));

        ComparisonResponse response = comparisonService.compare(USER_ID, "2026-08");

        var outgoing = response.rows().stream().filter(r -> r.metric().equals("Outgoing")).findFirst().orElseThrow();
        assertThat(outgoing.ideal()).isEqualByComparingTo("8000");
        assertThat(outgoing.actual()).isEqualByComparingTo("9500");
        assertThat(outgoing.difference()).isEqualByComparingTo("1500");
        assertThat(outgoing.note())
                .isEqualTo("Actual outflow was 1500 higher than your Ideal entries.")
                .doesNotContainIgnoringCase("overspend");
        assertThat(outgoing.differencePercent()).isEqualByComparingTo("18.8");
    }

    @Test
    void compare_matchingTotals_saysMatches() {
        when(idealService.summary(eq(USER_ID), eq("2026-08"))).thenReturn(summary("10000", "5000"));
        when(actualTransactionRepository
                .findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(eq(USER_ID), any(), any()))
                .thenReturn(List.of(outgoing("5000"), incoming("10000")));

        ComparisonResponse response = comparisonService.compare(USER_ID, "2026-08");

        assertThat(response.rows().get(0).note()).isEqualTo("Actual incoming matches your Ideal.");
        assertThat(response.rows().get(1).note()).isEqualTo("Actual outgoing matches your Ideal.");
        assertThat(response.rows().get(0).differencePercent()).isEqualByComparingTo("0.0");
    }

    @Test
    void compare_zeroIdeal_differencePercentIsNull_zeroSafe() {
        when(idealService.summary(eq(USER_ID), eq("2026-08"))).thenReturn(summary("0", "0"));
        when(actualTransactionRepository
                .findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(eq(USER_ID), any(), any()))
                .thenReturn(List.of(outgoing("700")));

        ComparisonResponse response = comparisonService.compare(USER_ID, "2026-08");

        var incoming = response.rows().get(0);
        assertThat(incoming.differencePercent()).isNull();
        assertThat(incoming.note()).isEqualTo("Actual incoming matches your Ideal.");
        assertThat(response.rows().get(1).differencePercent()).isNull();
    }

    /**
     * §9/§21 aggregate-shape proof: a category scoped only to Ideal appears
     * in the Ideal total and is simply ABSENT from the independently
     * aggregated Actual side — no join, no duplication, no drop.
     */
    @Test
    void compare_idealScopedCategory_contributesZeroToActualSide_byAbsence() {
        when(idealService.summary(eq(USER_ID), eq("2026-08"))).thenReturn(summary("10000", "3000"));
        when(actualTransactionRepository
                .findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(eq(USER_ID), any(), any()))
                .thenReturn(List.of(outgoing("1200")));

        ComparisonResponse response = comparisonService.compare(USER_ID, "2026-08");

        var outgoing = response.rows().get(1);
        assertThat(outgoing.ideal()).isEqualByComparingTo("3000");
        assertThat(outgoing.actual()).isEqualByComparingTo("1200");
        assertThat(outgoing.difference()).isEqualByComparingTo("-1800");
    }

    private IdealSummaryResponse summary(String totalIncoming, String totalOutgoing) {
        return new IdealSummaryResponse("2026-08", true, BigDecimal.ZERO, BigDecimal.ZERO,
                new BigDecimal(totalIncoming), new BigDecimal(totalOutgoing),
                new BigDecimal(totalIncoming).subtract(new BigDecimal(totalOutgoing)),
                false, BigDecimal.ZERO, BigDecimal.ONE);
    }

    private ActualTransactionEntity outgoing(String amount) {
        ActualTransactionEntity txn = new ActualTransactionEntity();
        txn.setType(ActualTxnType.OUTGOING);
        txn.setAmount(new BigDecimal(amount));
        txn.setTxnDate(LocalDate.of(2026, 8, 12));
        return txn;
    }

    private ActualTransactionEntity incoming(String amount) {
        ActualTransactionEntity txn = new ActualTransactionEntity();
        txn.setType(ActualTxnType.INCOMING);
        txn.setAmount(new BigDecimal(amount));
        txn.setTxnDate(LocalDate.of(2026, 8, 1));
        return txn;
    }
}
