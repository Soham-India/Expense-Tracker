package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.SettlementEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SettlementResponse(
        UUID id,
        UUID fromPersonId,
        String fromPersonName,
        UUID toPersonId,
        String toPersonName,
        BigDecimal amount,
        LocalDate date,
        String note,
        UUID actualTransactionId,
        OffsetDateTime createdAt) {

    public static SettlementResponse from(SettlementEntity entity) {
        return new SettlementResponse(
                entity.getId(),
                entity.getFromPerson().getId(),
                entity.getFromPerson().getName(),
                entity.getToPerson().getId(),
                entity.getToPerson().getName(),
                entity.getAmount(),
                entity.getSettlementDate(),
                entity.getNote(),
                entity.getActualTransaction() != null ? entity.getActualTransaction().getId() : null,
                entity.getCreatedAt());
    }
}
