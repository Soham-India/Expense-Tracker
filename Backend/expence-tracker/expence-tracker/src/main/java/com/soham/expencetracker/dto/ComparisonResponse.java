package com.soham.expencetracker.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Ideal vs Actual comparison (§21) — neutral and analytical only.
 * A difference is never labelled as overspending or a problem.
 */
public record ComparisonResponse(String month, List<ComparisonRow> rows) {

    public record ComparisonRow(String metric, BigDecimal ideal, BigDecimal actual,
                                BigDecimal difference, BigDecimal differencePercent, String note) {
    }
}
