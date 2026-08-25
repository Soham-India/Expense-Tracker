package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.IdealMonthResponse;
import com.soham.expencetracker.dto.IdealSummaryResponse;
import com.soham.expencetracker.dto.IdealTransactionRequest;
import com.soham.expencetracker.dto.IdealTransactionResponse;
import com.soham.expencetracker.dto.StartIdealMonthRequest;
import com.soham.expencetracker.dto.UpdateIdealMonthRequest;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.CategoryScope;
import com.soham.expencetracker.entity.IdealMonthEntity;
import com.soham.expencetracker.entity.IdealTransactionEntity;
import com.soham.expencetracker.entity.IdealTxnType;
import com.soham.expencetracker.entity.SubcategoryEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.IdealMonthRepository;
import com.soham.expencetracker.repository.IdealTransactionRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
import com.soham.expencetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IdealService {

    private final IdealMonthRepository idealMonthRepository;
    private final IdealTransactionRepository idealTransactionRepository;
    private final CategoryRepository categoryRepository;
    private final SubcategoryRepository subcategoryRepository;
    private final UserRepository userRepository;

    @Transactional
    public IdealMonthResponse startMonth(UUID userId, StartIdealMonthRequest request) {
        YearMonth parsed = parseMonth(request.month());
        LocalDate firstOfMonth = parsed.atDay(1);
        if (idealMonthRepository.existsByUserIdAndMonth(userId, firstOfMonth)) {
            throw new DuplicateResourceException("Ideal month " + parsed + " has already been started");
        }
        IdealMonthEntity month = new IdealMonthEntity();
        month.setUser(userRepository.getReferenceById(userId));
        month.setMonth(firstOfMonth);
        month.setStartingIncoming(request.startingIncoming());
        return toResponse(idealMonthRepository.save(month));
    }

    @Transactional(readOnly = true)
    public List<IdealMonthResponse> listMonths(UUID userId) {
        return idealMonthRepository.findByUserIdOrderByMonthDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IdealMonthResponse updateMonth(UUID userId, UUID monthId, UpdateIdealMonthRequest request) {
        IdealMonthEntity month = getOwnedMonth(userId, monthId);
        month.setStartingIncoming(request.startingIncoming());
        return toResponse(month);
    }

    @Transactional
    public IdealTransactionResponse addTransaction(UUID userId, IdealTransactionRequest request) {
        LocalDate date = request.date();
        IdealMonthEntity month = getRequiredMonth(userId, YearMonth.from(date));
        Classification classification = resolveClassification(userId, request.categoryId(), request.subcategoryId());

        IdealTransactionEntity txn = new IdealTransactionEntity();
        txn.setUser(userRepository.getReferenceById(userId));
        txn.setMonth(month);
        applyRequest(txn, request, classification);
        return IdealTransactionResponse.from(idealTransactionRepository.save(txn));
    }

    @Transactional(readOnly = true)
    public List<IdealTransactionResponse> listTransactions(UUID userId, String rawMonth, IdealTxnType type) {
        YearMonth parsed = parseOptionalMonth(rawMonth);
        LocalDate start = parsed.atDay(1);
        LocalDate end = parsed.atEndOfMonth();
        List<IdealTransactionEntity> txns = type == null
                ? idealTransactionRepository.findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(userId, start, end)
                : idealTransactionRepository.findByUserIdAndTypeAndTxnDateBetweenOrderByTxnDateDescIdDesc(
                        userId, type, start, end);
        return txns.stream().map(IdealTransactionResponse::from).toList();
    }

    @Transactional
    public IdealTransactionResponse updateTransaction(UUID userId, UUID txnId, IdealTransactionRequest request) {
        IdealTransactionEntity txn = idealTransactionRepository.findByUserIdAndId(userId, txnId)
                .orElseThrow(() -> new ResourceNotFoundException("Ideal transaction not found"));
        IdealMonthEntity targetMonth = getRequiredMonth(userId, YearMonth.from(request.date()));
        Classification classification = resolveClassification(userId, request.categoryId(), request.subcategoryId());

        txn.setMonth(targetMonth);
        applyRequest(txn, request, classification);
        return IdealTransactionResponse.from(txn);
    }

    @Transactional
    public void deleteTransaction(UUID userId, UUID txnId) {
        IdealTransactionEntity txn = idealTransactionRepository.findByUserIdAndId(userId, txnId)
                .orElseThrow(() -> new ResourceNotFoundException("Ideal transaction not found"));
        idealTransactionRepository.delete(txn);
    }

    /**
     * Budget summary per PRD §5.5: Total Incoming = starting + additional,
     * Budget Remaining = Total Incoming − Outgoing, Over Budget is the
     * absolute value of a negative remainder, Utilization is zero-safe.
     */
    @Transactional(readOnly = true)
    public IdealSummaryResponse summary(UUID userId, String rawMonth) {
        YearMonth parsed = parseOptionalMonth(rawMonth);
        Optional<IdealMonthEntity> month =
                idealMonthRepository.findByUserIdAndMonth(userId, parsed.atDay(1));

        BigDecimal incomingFromTransactions = BigDecimal.ZERO;
        BigDecimal totalOutgoing = BigDecimal.ZERO;
        for (IdealTransactionRepository.TypeTotal row : idealTransactionRepository.sumTotalsByTypeBetween(
                userId, parsed.atDay(1), parsed.atEndOfMonth())) {
            if (row.getType() == IdealTxnType.INCOMING) {
                incomingFromTransactions = row.getTotal();
            } else {
                totalOutgoing = row.getTotal();
            }
        }

        BigDecimal startingIncoming = month.map(IdealMonthEntity::getStartingIncoming).orElse(BigDecimal.ZERO);
        BigDecimal totalIncoming = startingIncoming.add(incomingFromTransactions);
        BigDecimal additionalIncoming = incomingFromTransactions;
        BigDecimal budgetRemaining = totalIncoming.subtract(totalOutgoing);
        boolean overBudget = budgetRemaining.signum() < 0;
        BigDecimal overBudgetAmount = overBudget ? budgetRemaining.abs() : BigDecimal.ZERO;
        BigDecimal utilization = totalIncoming.signum() > 0
                ? totalOutgoing.multiply(BigDecimal.valueOf(100)).divide(totalIncoming, 1, RoundingMode.HALF_UP)
                : null;

        return new IdealSummaryResponse(
                parsed.toString(),
                month.isPresent(),
                startingIncoming,
                additionalIncoming,
                totalIncoming,
                totalOutgoing,
                budgetRemaining,
                overBudget,
                overBudgetAmount,
                utilization);
    }

    private void applyRequest(IdealTransactionEntity txn,
                              IdealTransactionRequest request,
                              Classification classification) {
        txn.setType(request.type());
        txn.setAmount(request.amount());
        txn.setCategory(classification.category());
        txn.setSubcategory(classification.subcategory());
        txn.setDescription(trimOrNull(request.description()));
        txn.setTxnDate(request.date());
        txn.setNotes(trimOrNull(request.notes()));
    }

    private Classification resolveClassification(UUID userId, UUID categoryId, UUID subcategoryId) {
        if (categoryId == null && subcategoryId == null) {
            return new Classification(null, null);
        }
        if (categoryId == null) {
            throw new InvalidRequestException("categoryId is required when a subcategoryId is provided");
        }
        CategoryEntity category = categoryRepository.findByUserIdAndId(userId, categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
        if (category.getScope() == CategoryScope.ACTUAL) {
            throw new InvalidRequestException(
                    "Category '" + category.getName() + "' is not available in the Ideal system (scope: ACTUAL)");
        }
        SubcategoryEntity subcategory = null;
        if (subcategoryId != null) {
            subcategory = subcategoryRepository.findByIdAndCategoryUserId(subcategoryId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Subcategory not found"));
            if (!subcategory.getCategory().getId().equals(category.getId())) {
                throw new InvalidRequestException(
                        "Subcategory does not belong to category '" + category.getName() + "'");
            }
        }
        return new Classification(category, subcategory);
    }

    private IdealMonthEntity getOwnedMonth(UUID userId, UUID monthId) {
        return idealMonthRepository.findByUserIdAndId(userId, monthId)
                .orElseThrow(() -> new ResourceNotFoundException("Ideal month not found"));
    }

    private IdealMonthEntity getRequiredMonth(UUID userId, YearMonth month) {
        return idealMonthRepository.findByUserIdAndMonth(userId, month.atDay(1))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No Ideal month started for " + month + ". Start the month first"));
    }

    private YearMonth parseMonth(String raw) {
        try {
            return YearMonth.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidRequestException("month must be in yyyy-MM format");
        }
    }

    private YearMonth parseOptionalMonth(String raw) {
        return raw == null || raw.isBlank() ? YearMonth.now() : parseMonth(raw);
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private IdealMonthResponse toResponse(IdealMonthEntity month) {
        return new IdealMonthResponse(month.getId(), YearMonth.from(month.getMonth()).toString(),
                month.getStartingIncoming());
    }

    private record Classification(CategoryEntity category, SubcategoryEntity subcategory) {
    }
}
