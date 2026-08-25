package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.ActualTransactionResponse;
import com.soham.expencetracker.dto.DashboardResponse;
import com.soham.expencetracker.dto.IdealSummaryResponse;
import com.soham.expencetracker.dto.IdealTransactionResponse;
import com.soham.expencetracker.dto.SplitExpenseResponse;
import com.soham.expencetracker.entity.ActualTransactionEntity;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.entity.SplitParticipantEntity;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.repository.AccountRepository;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import com.soham.expencetracker.repository.IdealTransactionRepository;
import com.soham.expencetracker.repository.PersonRepository;
import com.soham.expencetracker.repository.SplitParticipantRepository;
import com.soham.expencetracker.repository.SplitExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Dashboard snapshot (§11, §34): a concise three-system view of one month —
 * explicitly NOT a report. Reuses the domain services so the numbers can
 * never drift from the systems themselves.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final IdealService idealService;
    private final SplitService splitService;
    private final IdealTransactionRepository idealTransactionRepository;
    private final ActualTransactionRepository actualTransactionRepository;
    private final SplitExpenseRepository splitExpenseRepository;
    private final SplitParticipantRepository splitParticipantRepository;
    private final AccountRepository accountRepository;
    private final PersonRepository personRepository;

    @Transactional(readOnly = true)
    public DashboardResponse snapshot(UUID userId, String monthStr) {
        YearMonth month = parseMonth(monthStr);
        String monthLabel = month.toString();

        IdealSummaryResponse ideal = idealService.summary(userId, monthLabel);

        List<ActualTransactionEntity> actualTxns = actualTransactionRepository
                .findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(
                        userId, month.atDay(1), month.atEndOfMonth());
        BigDecimal moneyIn = sumByType(actualTxns, ActualTxnType.INCOMING);
        BigDecimal moneyOut = sumByType(actualTxns, ActualTxnType.OUTGOING);

        var balances = splitService.balances(userId);

        List<IdealTransactionResponse> recentIdeal = idealTransactionRepository
                .findTop5ByUserIdOrderByTxnDateDescCreatedAtDescIdDesc(userId).stream()
                .map(IdealTransactionResponse::from)
                .toList();
        List<ActualTransactionResponse> recentActual = actualTransactionRepository
                .findTop5ByUserIdOrderByTxnDateDescCreatedAtDescIdDesc(userId).stream()
                .map(ActualTransactionResponse::from)
                .toList();
        var recentSplitExpenses = splitExpenseRepository
                .findTop5ByUserIdOrderByExpenseDateDescCreatedAtDescIdDesc(userId);
        Set<UUID> recentIds = recentSplitExpenses.stream()
                .map(e -> e.getId()).collect(Collectors.toSet());
        Map<UUID, List<SplitParticipantEntity>> participants = splitParticipantRepository
                .findOfUserExpenses(userId).stream()
                .filter(p -> recentIds.contains(p.getSplitExpense().getId()))
                .collect(Collectors.groupingBy(p -> p.getSplitExpense().getId()));
        List<SplitExpenseResponse> recentSplits = recentSplitExpenses.stream()
                .map(e -> SplitExpenseResponse.from(e,
                        participants.getOrDefault(e.getId(), List.of())))
                .toList();

        boolean hasNoAccounts = accountRepository
                .findByUserIdAndArchivedFalseOrderByNameAsc(userId).isEmpty();
        boolean hasNoPeople = personRepository
                .findByUserIdAndArchivedFalseOrderByNameAsc(userId).stream()
                .noneMatch(p -> !p.isSelf());

        return new DashboardResponse(
                monthLabel,
                new DashboardResponse.IdealBlock(ideal.monthStarted(), ideal.totalIncoming(),
                        ideal.totalOutgoing(), ideal.budgetRemaining(), ideal.overBudget(),
                        ideal.overBudgetAmount(), ideal.utilizationPercent()),
                new DashboardResponse.ActualBlock(moneyIn, moneyOut,
                        moneyIn.subtract(moneyOut), actualTxns.size()),
                new DashboardResponse.SplitsBlock(balances.youOwe(), balances.owedToYou(),
                        balances.netBalance()),
                new DashboardResponse.RecentsBlock(recentIdeal, recentActual, recentSplits),
                new DashboardResponse.HintsBlock(!ideal.monthStarted(), hasNoAccounts, hasNoPeople));
    }

    private BigDecimal sumByType(List<ActualTransactionEntity> txns, ActualTxnType type) {
        return txns.stream().filter(t -> t.getType() == type)
                .map(ActualTransactionEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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
