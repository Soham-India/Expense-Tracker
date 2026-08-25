package com.soham.expencetracker.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * §10 preparation preview — what WOULD be created for the month if each
 * active template were confirmed. Never creates records.
 */
public record PrepareRecurringResponse(String month, List<PreparedTemplate> templates) {

    public record PreparedTemplate(
            UUID templateId,
            String domain,
            String type,
            String description,
            java.math.BigDecimal amount,
            int dayOfMonth,
            LocalDate targetDate,
            boolean alreadyConfirmed,
            String blockReason) {
    }
}
