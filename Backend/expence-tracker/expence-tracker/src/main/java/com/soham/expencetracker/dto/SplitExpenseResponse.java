package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.SplitExpenseEntity;
import com.soham.expencetracker.entity.SplitMethod;
import com.soham.expencetracker.entity.SplitParticipantEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SplitExpenseResponse(
        UUID id,
        UUID groupId,
        String groupName,
        UUID createdByPersonId,
        String createdByPersonName,
        BigDecimal totalAmount,
        SplitMethod splitMethod,
        String description,
        LocalDate date,
        List<ParticipantResponse> participants) {

    public static SplitExpenseResponse from(SplitExpenseEntity entity, List<SplitParticipantEntity> participants) {
        return new SplitExpenseResponse(
                entity.getId(),
                entity.getGroup() != null ? entity.getGroup().getId() : null,
                entity.getGroup() != null ? entity.getGroup().getName() : null,
                entity.getCreatedBy().getId(),
                entity.getCreatedBy().getName(),
                entity.getTotalAmount(),
                entity.getSplitMethod(),
                entity.getDescription(),
                entity.getExpenseDate(),
                participants.stream().map(ParticipantResponse::from).toList());
    }

    public record ParticipantResponse(
            UUID personId,
            String personName,
            BigDecimal shareAmount,
            BigDecimal paidAmount,
            BigDecimal splitPercentage,
            BigDecimal splitUnits) {

        public static ParticipantResponse from(SplitParticipantEntity entity) {
            return new ParticipantResponse(
                    entity.getPerson().getId(),
                    entity.getPerson().getName(),
                    entity.getShareAmount(),
                    entity.getPaidAmount(),
                    entity.getSplitPercentage(),
                    entity.getSplitUnits());
        }
    }
}
