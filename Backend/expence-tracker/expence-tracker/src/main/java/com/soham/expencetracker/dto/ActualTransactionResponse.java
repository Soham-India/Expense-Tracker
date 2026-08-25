package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.ActualTransactionEntity;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.entity.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ActualTransactionResponse(
        UUID id,
        ActualTxnType type,
        BigDecimal amount,
        UUID categoryId,
        String categoryName,
        UUID subcategoryId,
        String subcategoryName,
        UUID accountId,
        String accountName,
        UUID transferToAccountId,
        String transferToAccountName,
        PaymentMethod paymentMethod,
        String description,
        LocalDate date,
        String notes,
        OffsetDateTime createdAt) {

    public static ActualTransactionResponse from(ActualTransactionEntity entity) {
        return new ActualTransactionResponse(
                entity.getId(),
                entity.getType(),
                entity.getAmount(),
                entity.getCategory() != null ? entity.getCategory().getId() : null,
                entity.getCategory() != null ? entity.getCategory().getName() : null,
                entity.getSubcategory() != null ? entity.getSubcategory().getId() : null,
                entity.getSubcategory() != null ? entity.getSubcategory().getName() : null,
                entity.getAccount() != null ? entity.getAccount().getId() : null,
                entity.getAccount() != null ? entity.getAccount().getName() : null,
                entity.getTransferToAccount() != null ? entity.getTransferToAccount().getId() : null,
                entity.getTransferToAccount() != null ? entity.getTransferToAccount().getName() : null,
                entity.getPaymentMethod(),
                entity.getDescription(),
                entity.getTxnDate(),
                entity.getNotes(),
                entity.getCreatedAt());
    }
}
