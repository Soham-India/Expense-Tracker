package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.ConfirmRecurringRequest;
import com.soham.expencetracker.dto.CreateRecurringRequest;
import com.soham.expencetracker.dto.IdealTransactionRequest;
import com.soham.expencetracker.dto.ActualTransactionRequest;
import com.soham.expencetracker.dto.PrepareRecurringResponse;
import com.soham.expencetracker.dto.RecurringEntryResponse;
import com.soham.expencetracker.dto.UpdateRecurringRequest;
import com.soham.expencetracker.entity.AccountEntity;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.CategoryScope;
import com.soham.expencetracker.entity.IdealTxnType;
import com.soham.expencetracker.entity.RecurringDomain;
import com.soham.expencetracker.entity.RecurringEntryEntity;
import com.soham.expencetracker.entity.SubcategoryEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.AccountRepository;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.RecurringEntryRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
import com.soham.expencetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Recurring templates (§10): preparation and explicit confirmation only —
 * nothing ever posts automatically (§41).
 */
@Service
@RequiredArgsConstructor
public class RecurringService {

    private static final Set<String> VALID_TYPES = Set.of("INCOMING", "OUTGOING");

    private final RecurringEntryRepository recurringEntryRepository;
    private final CategoryRepository categoryRepository;
    private final SubcategoryRepository subcategoryRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final IdealService idealService;
    private final ActualService actualService;

    @Transactional
    public RecurringEntryResponse create(UUID userId, CreateRecurringRequest request) {
        RecurringEntryEntity template = new RecurringEntryEntity();
        template.setUser(userRepository.getReferenceById(userId));
        template.setDomain(request.domain());
        applyTemplate(userId, template, request.type(), request.amount(), request.categoryId(),
                request.subcategoryId(), request.accountId(), request.description(), request.dayOfMonth());
        template.setActive(true);
        return toResponse(recurringEntryRepository.save(template));
    }

    @Transactional(readOnly = true)
    public List<RecurringEntryResponse> list(UUID userId, RecurringDomain domain, boolean activeOnly) {
        List<RecurringEntryEntity> templates;
        if (domain != null && activeOnly) {
            templates = recurringEntryRepository.findByUserIdAndDomainAndActiveTrueOrderByCreatedAtDesc(userId, domain);
        } else if (domain != null) {
            templates = recurringEntryRepository.findByUserIdAndDomainOrderByCreatedAtDesc(userId, domain);
        } else if (activeOnly) {
            templates = recurringEntryRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId);
        } else {
            templates = recurringEntryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        }
        return templates.stream().map(this::toResponse).toList();
    }

    @Transactional
    public RecurringEntryResponse update(UUID userId, UUID templateId, UpdateRecurringRequest request) {
        RecurringEntryEntity template = getOwned(userId, templateId);
        applyTemplate(userId, template, request.type(), request.amount(), request.categoryId(),
                request.subcategoryId(), request.accountId(), request.description(), request.dayOfMonth());
        template.setActive(request.isActive());
        return toResponse(template);
    }

    @Transactional
    public void delete(UUID userId, UUID templateId) {
        recurringEntryRepository.delete(getOwned(userId, templateId));
    }

    /**
     * §10 preview: what WOULD be created for the month. Purely read-only.
     */
    @Transactional(readOnly = true)
    public PrepareRecurringResponse prepare(UUID userId, String monthStr) {
        YearMonth month = parseMonth(monthStr);
        Set<String> startedIdealMonths = idealService.listMonths(userId).stream()
                .map(m -> m.month())
                .collect(java.util.stream.Collectors.toSet());
        List<RecurringEntryEntity> templates =
                recurringEntryRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId);
        List<PrepareRecurringResponse.PreparedTemplate> prepared = templates.stream()
                .map(template -> {
                    LocalDate targetDate = clampToMonth(template.getDayOfMonth(), month);
                    String blockReason = null;
                    if (template.getDomain() == RecurringDomain.IDEAL
                            && !startedIdealMonths.contains(month.toString())) {
                        blockReason = "Start the Ideal month first";
                    }
                    return new PrepareRecurringResponse.PreparedTemplate(
                            template.getId(),
                            template.getDomain().name(),
                            template.getType(),
                            template.getDescription(),
                            template.getAmount(),
                            template.getDayOfMonth(),
                            targetDate,
                            isConfirmedFor(template, month),
                            blockReason);
                })
                .toList();
        return new PrepareRecurringResponse(month.toString(), prepared);
    }

    /**
     * Explicit confirmation creates the real entry by delegating to the
     * domain services (so all money-movement validation applies at confirm
     * time, including category scope). Double confirmation is rejected.
     */
    @Transactional
    public RecurringEntryResponse confirm(UUID userId, UUID templateId, ConfirmRecurringRequest request) {
        RecurringEntryEntity template = getOwned(userId, templateId);
        if (!template.isActive()) {
            throw new InvalidRequestException("This template is paused — activate it before confirming");
        }
        YearMonth month = parseMonth(request.month());
        if (isConfirmedFor(template, month)) {
            throw new DuplicateResourceException(
                    "Template was already confirmed for " + month);
        }
        LocalDate targetDate = clampToMonth(template.getDayOfMonth(), month);

        if (template.getDomain() == RecurringDomain.IDEAL) {
            idealService.addTransaction(userId, new IdealTransactionRequest(
                    IdealTxnType.valueOf(template.getType()),
                    template.getAmount(),
                    categoryId(template),
                    subcategoryId(template),
                    template.getDescription(),
                    targetDate,
                    "Recurring template"));
            template.setLastConfirmedMonth(month.atDay(1));
            return toResponse(template);
        }

        actualService.addTransaction(userId, new ActualTransactionRequest(
                ActualTxnType.valueOf(template.getType()),
                template.getAmount(),
                categoryId(template),
                subcategoryId(template),
                template.getAccount() != null ? template.getAccount().getId() : null,
                null,
                null,
                template.getDescription(),
                targetDate,
                "Recurring template"));
        template.setLastConfirmedMonth(month.atDay(1));
        return toResponse(template);
    }

    // ------------------------------------------------------------------

    private void applyTemplate(UUID userId, RecurringEntryEntity template, String type,
                               BigDecimal amount, UUID categoryId, UUID subcategoryId,
                               UUID accountId, String description, Integer dayOfMonth) {
        String trimmedType = type == null ? null : type.trim().toUpperCase();
        if (trimmedType == null || !VALID_TYPES.contains(trimmedType)) {
            throw new InvalidRequestException(
                    "Recurring templates support INCOMING or OUTGOING only (transfers stay manual)");
        }
        template.setType(trimmedType);

        if (template.getDomain() == RecurringDomain.IDEAL && accountId != null) {
            throw new InvalidRequestException("Ideal templates cannot reference an account");
        }
        AccountEntity account = null;
        if (template.getDomain() == RecurringDomain.ACTUAL && accountId != null) {
            account = accountRepository.findByUserIdAndId(userId, accountId)
                    .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        }
        template.setAccount(account);

        CategoryEntity category = null;
        if (categoryId != null) {
            category = categoryRepository.findByUserIdAndId(userId, categoryId)
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            CategoryScope required = template.getDomain() == RecurringDomain.IDEAL
                    ? CategoryScope.IDEAL : CategoryScope.ACTUAL;
            if (category.getScope() != required && category.getScope() != CategoryScope.BOTH) {
                throw new InvalidRequestException("Category '" + category.getName()
                        + "' is not available in the " + template.getDomain() + " system (scope: "
                        + category.getScope() + ")");
            }
        }
        template.setCategory(category);

        SubcategoryEntity subcategory = null;
        if (subcategoryId != null) {
            if (categoryId == null) {
                throw new InvalidRequestException("categoryId is required when a subcategoryId is provided");
            }
            subcategory = subcategoryRepository.findByIdAndCategoryUserId(subcategoryId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Subcategory not found"));
            if (!subcategory.getCategory().getId().equals(categoryId)) {
                throw new InvalidRequestException("Subcategory does not belong to the provided category");
            }
        }
        template.setSubcategory(subcategory);

        template.setAmount(amount);
        template.setDescription(description.trim());
        template.setDayOfMonth(dayOfMonth.shortValue());
    }

    private UUID categoryId(RecurringEntryEntity template) {
        return template.getCategory() != null ? template.getCategory().getId() : null;
    }

    private UUID subcategoryId(RecurringEntryEntity template) {
        return template.getSubcategory() != null ? template.getSubcategory().getId() : null;
    }

    private LocalDate clampToMonth(short dayOfMonth, YearMonth month) {
        return month.atDay(Math.min(dayOfMonth, month.lengthOfMonth()));
    }

    private boolean isConfirmedFor(RecurringEntryEntity template, YearMonth month) {
        return template.getLastConfirmedMonth() != null
                && YearMonth.from(template.getLastConfirmedMonth()).equals(month);
    }

    private RecurringEntryEntity getOwned(UUID userId, UUID templateId) {
        return recurringEntryRepository.findByUserIdAndId(userId, templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring template not found"));
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

    private RecurringEntryResponse toResponse(RecurringEntryEntity template) {
        return new RecurringEntryResponse(
                template.getId(),
                template.getDomain(),
                template.getType(),
                template.getAmount(),
                template.getCategory() != null ? template.getCategory().getId() : null,
                template.getCategory() != null ? template.getCategory().getName() : null,
                template.getSubcategory() != null ? template.getSubcategory().getId() : null,
                template.getSubcategory() != null ? template.getSubcategory().getName() : null,
                template.getAccount() != null ? template.getAccount().getId() : null,
                template.getAccount() != null ? template.getAccount().getName() : null,
                template.getDescription(),
                template.getDayOfMonth(),
                template.isActive(),
                template.getLastConfirmedMonth(),
                template.getCreatedAt());
    }
}
