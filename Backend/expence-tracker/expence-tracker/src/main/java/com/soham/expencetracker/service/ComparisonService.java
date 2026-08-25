package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.ComparisonResponse;
import com.soham.expencetracker.dto.IdealSummaryResponse;
import com.soham.expencetracker.entity.ActualTransactionEntity;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.report.ReportMath;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

/**
 * Ideal vs Actual comparison (§21) — neutral and analytical.
 *
 * Aggregate shape note: the two sides below are INDEPENDENT per-domain
 * aggregates (never a category join). A category scoped to only one domain
 * therefore contributes zero to the other side by absence from its row set,
 * not by join arithmetic — a joined query could silently drop or duplicate
 * rows, so none is used.
 */
@Service
@RequiredArgsConstructor
public class ComparisonService {

    private final IdealService idealService;
    private final ActualTransactionRepository actualTransactionRepository;

    @Transactional(readOnly = true)
    public ComparisonResponse compare(UUID userId, String monthStr) {
        YearMonth month = parseMonth(monthStr);

        IdealSummaryResponse ideal = idealService.summary(userId, month.toString());

        List<ActualTransactionEntity> actualTxns = actualTransactionRepository
                .findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(
                        userId, month.atDay(1), month.atEndOfMonth());
        BigDecimal actualIn = actualTxns.stream()
                .filter(t -> t.getType() == ActualTxnType.INCOMING)
                .map(ActualTransactionEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal actualOut = actualTxns.stream()
                .filter(t -> t.getType() == ActualTxnType.OUTGOING)
                .map(ActualTransactionEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ComparisonResponse(month.toString(), List.of(
                row("Incoming", ideal.totalIncoming(), actualIn),
                row("Outgoing", ideal.totalOutgoing(), actualOut)));
    }

    private ComparisonResponse.ComparisonRow row(String metric, BigDecimal ideal, BigDecimal actual) {
        BigDecimal difference = actual.subtract(ideal);
        BigDecimal differencePercent = (ideal.signum() > 0)
                ? difference.multiply(BigDecimal.valueOf(100)).divide(ideal, 1, java.math.RoundingMode.HALF_UP)
                : null;
        return new ComparisonResponse.ComparisonRow(
                metric, ideal, actual, difference, differencePercent, neutralNote(metric, difference));
    }

    /**
     * §21 wording: differences are stated, never judged. No "overspent".
     */
    private String neutralNote(String metric, BigDecimal difference) {
        if (difference.signum() == 0) {
            return "Actual " + metric.toLowerCase() + " matches your Ideal.";
        }
        if (metric.equals("Incoming")) {
            return "Actual incoming was " + difference.abs() + " "
                    + (difference.signum() > 0 ? "higher" : "lower") + " than your Ideal incoming.";
        }
        return "Actual outflow was " + difference.abs() + " "
                + (difference.signum() > 0 ? "higher" : "lower") + " than your Ideal entries.";
    }

    private YearMonth parseMonth(String raw) {
        if (raw == null || raw.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidRequestException("month must be in yyyy-MM format");
        }
    }
}
