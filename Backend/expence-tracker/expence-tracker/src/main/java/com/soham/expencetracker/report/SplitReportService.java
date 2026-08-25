package com.soham.expencetracker.report;

import com.soham.expencetracker.dto.BalancesResponse;
import com.soham.expencetracker.entity.PersonEntity;
import com.soham.expencetracker.entity.SettlementEntity;
import com.soham.expencetracker.entity.SplitExpenseEntity;
import com.soham.expencetracker.entity.SplitParticipantEntity;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.PersonRepository;
import com.soham.expencetracker.repository.SettlementRepository;
import com.soham.expencetracker.repository.SplitExpenseRepository;
import com.soham.expencetracker.repository.SplitParticipantRepository;
import com.soham.expencetracker.service.SplitAlgorithms;
import com.soham.expencetracker.service.SplitService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 🤝 Split reporting engine (§19 weekly, §20 monthly). Relationship
 * oriented: obligations, fronted money, settlement activity, groups and
 * trends. Balances are derived at read time (§7.6).
 */
@Service
@RequiredArgsConstructor
public class SplitReportService {

    private final SplitService splitService;
    private final PersonRepository personRepository;
    private final SplitExpenseRepository expenseRepository;
    private final SplitParticipantRepository participantRepository;
    private final SettlementRepository settlementRepository;

    @Transactional(readOnly = true)
    public SplitWeeklyReport weekly(UUID userId, String ref) {
        ReportPeriod week = ReportPeriod.weekly(parseDateRef(ref));
        List<SplitExpenseEntity> expenses = expenseRepository
                .findByUserIdAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
                        userId, week.start(), week.end());
        List<SettlementEntity> settlements = settlementRepository
                .findByUserIdAndSettlementDateBetweenOrderBySettlementDateDescIdDesc(
                        userId, week.start(), week.end());

        PersonEntity self = selfPerson(userId);
        BigDecimal newTotal = expenses.stream()
                .map(SplitExpenseEntity::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidByMe = settlements.stream()
                .filter(s -> s.getFromPerson().getId().equals(self.getId()))
                .map(SettlementEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal receivedByMe = settlements.stream()
                .filter(s -> s.getToPerson().getId().equals(self.getId()))
                .map(SettlementEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BalancesResponse balances = splitService.balances(userId);

        return new SplitWeeklyReport(
                week.start(),
                week.end(),
                expenses.size(),
                newTotal,
                settlements.size(),
                paidByMe,
                receivedByMe,
                balances.youOwe(),
                balances.owedToYou(),
                balances.netBalance(),
                balances.people().stream()
                        .map(p -> new SplitWeeklyReport.PersonStanding(p.personId(), p.personName(),
                                p.amount()))
                        .toList());
    }

    @Transactional(readOnly = true)
    public SplitMonthlyReport monthly(UUID userId, String ref) {
        YearMonth month = parseMonthRef(ref);
        ReportPeriod period = ReportPeriod.monthly(month.atDay(1));

        PersonEntity self = selfPerson(userId);
        BalancesResponse balances = splitService.balances(userId);

        List<SplitExpenseEntity> monthExpenses = expenseRepository
                .findByUserIdAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
                        userId, period.start(), period.end());
        Map<UUID, List<SplitParticipantEntity>> participantsByExpense =
                participantsByExpense(userId);

        Fronted fronted = frontedTotals(participantsByExpense, self.getId());

        BigDecimal monthExpenseTotal = monthExpenses.stream()
                .map(SplitExpenseEntity::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<SettlementEntity> monthSettlements = settlementRepository
                .findByUserIdAndSettlementDateBetweenOrderBySettlementDateDescIdDesc(
                        userId, period.start(), period.end());
        BigDecimal paidByMe = sumSettlements(monthSettlements, self.getId(), true);
        BigDecimal receivedByMe = sumSettlements(monthSettlements, self.getId(), false);

        List<SplitMonthlyReport.PersonBreakdown> personBreakdown = personBreakdown(
                userId, balances, monthExpenses, participantsByExpense);
        List<SplitMonthlyReport.GroupBreakdown> groupBreakdown = groupBreakdown(
                monthExpenses, participantsByExpense, self.getId());

        BigDecimal settledLifetime = sumSettlements(
                settlementRepository.findByUserIdOrderBySettlementDateAsc(userId), self.getId(), true);
        BigDecimal settlementRate = ReportMath.pct(settledLifetime,
                settledLifetime.add(balances.youOwe()));

        YearMonth prev = month.minusMonths(1);
        ReportPeriod prevPeriod = ReportPeriod.monthly(prev.atDay(1));
        List<SplitExpenseEntity> prevExpenses = expenseRepository
                .findByUserIdAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
                        userId, prevPeriod.start(), prevPeriod.end());
        List<SettlementEntity> prevSettlements = settlementRepository
                .findByUserIdAndSettlementDateBetweenOrderBySettlementDateDescIdDesc(
                        userId, prevPeriod.start(), prevPeriod.end());

        List<SplitMonthlyReport.DebtTrend> trends = debtTrends(userId, month, self.getId());

        return new SplitMonthlyReport(
                month.toString(),
                balances.youOwe(),
                balances.owedToYou(),
                balances.netBalance(),
                fronted.youFronted(),
                fronted.frontedForYou(),
                new SplitMonthlyReport.NewExpenses(monthExpenses.size(), monthExpenseTotal),
                new SplitMonthlyReport.SettlementActivity(monthSettlements.size(), paidByMe, receivedByMe),
                personBreakdown,
                groupBreakdown,
                balances.pairs().stream()
                        .map(p -> new SplitMonthlyReport.OutstandingPair(p.fromPersonId(),
                                p.fromPersonName(), p.toPersonId(), p.toPersonName(), p.amount()))
                        .toList(),
                settlementRate,
                new SplitMonthlyReport.PreviousComparison(prev.toString(),
                        (long) prevExpenses.size(),
                        prevExpenses.stream().map(SplitExpenseEntity::getTotalAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add),
                        (long) prevSettlements.size(),
                        sumSettlements(prevSettlements, self.getId(), true)),
                trends,
                buildInsights(balances, monthExpenses, monthSettlements, month, self, fronted,
                        settlementRate));
    }

    // ------------------------------------------------------------------

    private PersonEntity selfPerson(UUID userId) {
        return personRepository.findByUserIdAndSelfTrue(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Self person record missing — re-registering is required"));
    }

    private Map<UUID, List<SplitParticipantEntity>> participantsByExpense(UUID userId) {
        Map<UUID, List<SplitParticipantEntity>> byExpense = new HashMap<>();
        for (SplitParticipantEntity p : participantRepository.findOfUserExpenses(userId)) {
            byExpense.computeIfAbsent(p.getSplitExpense().getId(), k -> new ArrayList<>()).add(p);
        }
        return byExpense;
    }

    private Fronted frontedTotals(Map<UUID, List<SplitParticipantEntity>> participantsByExpense,
                                  UUID selfId) {
        BigDecimal youFronted = BigDecimal.ZERO;
        BigDecimal frontedForYou = BigDecimal.ZERO;
        for (List<SplitParticipantEntity> participants : participantsByExpense.values()) {
            for (SplitParticipantEntity p : participants) {
                if (!p.getPerson().getId().equals(selfId)) {
                    continue;
                }
                BigDecimal net = p.getPaidAmount().subtract(p.getShareAmount());
                if (net.signum() > 0) {
                    youFronted = youFronted.add(net);
                } else if (net.signum() < 0) {
                    frontedForYou = frontedForYou.add(net.negate());
                }
            }
        }
        return new Fronted(youFronted, frontedForYou);
    }

    private record Fronted(BigDecimal youFronted, BigDecimal frontedForYou) {
    }

    private BigDecimal sumSettlements(List<SettlementEntity> settlements, UUID selfId,
                                      boolean paidByMe) {
        return settlements.stream()
                .filter(s -> (paidByMe
                        ? s.getFromPerson().getId().equals(selfId)
                        : s.getToPerson().getId().equals(selfId)))
                .map(SettlementEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private List<SplitMonthlyReport.PersonBreakdown> personBreakdown(
            UUID userId, BalancesResponse balances, List<SplitExpenseEntity> monthExpenses,
            Map<UUID, List<SplitParticipantEntity>> participantsByExpense) {
        Map<UUID, Long> sharedCount = new HashMap<>();
        for (SplitExpenseEntity expense : monthExpenses) {
            for (SplitParticipantEntity p : participantsByExpense
                    .getOrDefault(expense.getId(), List.of())) {
                sharedCount.merge(p.getPerson().getId(), 1L, Long::sum);
            }
        }
        return balances.people().stream()
                .map(p -> new SplitMonthlyReport.PersonBreakdown(p.personId(), p.personName(),
                        p.amount(), sharedCount.getOrDefault(p.personId(), 0L)))
                .sorted(java.util.Comparator.comparing(SplitMonthlyReport.PersonBreakdown::name))
                .toList();
    }

    private List<SplitMonthlyReport.GroupBreakdown> groupBreakdown(
            List<SplitExpenseEntity> monthExpenses,
            Map<UUID, List<SplitParticipantEntity>> participantsByExpense, UUID selfId) {
        Map<UUID, List<SplitExpenseEntity>> byGroup = new LinkedHashMap<>();
        for (SplitExpenseEntity expense : monthExpenses) {
            if (expense.getGroup() != null) {
                byGroup.computeIfAbsent(expense.getGroup().getId(), k -> new ArrayList<>()).add(expense);
            }
        }
        return byGroup.entrySet().stream()
                .map(e -> {
                    List<SplitExpenseEntity> expenses = e.getValue();
                    BigDecimal total = expenses.stream().map(SplitExpenseEntity::getTotalAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal[] mine = expenses.stream()
                            .flatMap(exp -> participantsByExpense.getOrDefault(exp.getId(), List.of())
                                    .stream()
                                    .filter(p -> p.getPerson().getId().equals(selfId)))
                            .reduce(new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO},
                                    (acc, p) -> new BigDecimal[]{
                                            acc[0].add(p.getShareAmount()), acc[1].add(p.getPaidAmount())},
                                    (a, b) -> new BigDecimal[]{a[0].add(b[0]), a[1].add(b[1])});
                    return new SplitMonthlyReport.GroupBreakdown(e.getKey(),
                            expenses.get(0).getGroup().getName(), expenses.size(), total,
                            mine[0], mine[1]);
                })
                .sorted(java.util.Comparator.comparing(SplitMonthlyReport.GroupBreakdown::name))
                .toList();
    }

    private List<SplitMonthlyReport.DebtTrend> debtTrends(UUID userId, YearMonth endMonth,
                                                          UUID selfId) {
        YearMonth startMonth = endMonth.minusMonths(5);
        ReportPeriod span = ReportPeriod.monthly(startMonth.atDay(1));
        ReportPeriod end = ReportPeriod.monthly(endMonth.atDay(1));

        List<SplitExpenseEntity> expenses = expenseRepository
                .findByUserIdAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
                        userId, span.start(), end.end());
        Map<UUID, List<SplitParticipantEntity>> participantsByExpense = participantsByExpense(userId);

        Map<YearMonth, BigDecimal> newDebt = new LinkedHashMap<>();
        Map<YearMonth, BigDecimal> settled = new LinkedHashMap<>();
        for (YearMonth m = startMonth; !m.isAfter(endMonth); m = m.plusMonths(1)) {
            newDebt.put(m, BigDecimal.ZERO);
            settled.put(m, BigDecimal.ZERO);
        }

        for (SplitExpenseEntity expense : expenses) {
            Map<UUID, BigDecimal> nets = new LinkedHashMap<>();
            for (SplitParticipantEntity p : participantsByExpense
                    .getOrDefault(expense.getId(), List.of())) {
                nets.put(p.getPerson().getId(), p.getPaidAmount().subtract(p.getShareAmount()));
            }
            for (SplitAlgorithms.LedgerEntry entry : SplitAlgorithms.greedyPairing(nets)) {
                if (entry.debtorId().equals(selfId)) {
                    newDebt.merge(YearMonth.from(expense.getExpenseDate()), entry.amount(),
                            BigDecimal::add);
                }
            }
        }
        for (SettlementEntity s : settlementRepository
                .findByUserIdAndSettlementDateBetweenOrderBySettlementDateDescIdDesc(
                        userId, span.start(), end.end())) {
            if (s.getFromPerson().getId().equals(selfId)) {
                settled.merge(YearMonth.from(s.getSettlementDate()), s.getAmount(), BigDecimal::add);
            }
        }

        List<SplitMonthlyReport.DebtTrend> trends = new ArrayList<>();
        for (YearMonth m = startMonth; !m.isAfter(endMonth); m = m.plusMonths(1)) {
            trends.add(new SplitMonthlyReport.DebtTrend(m.toString(),
                    newDebt.getOrDefault(m, BigDecimal.ZERO),
                    settled.getOrDefault(m, BigDecimal.ZERO)));
        }
        return trends;
    }

    private List<String> buildInsights(BalancesResponse balances,
                                       List<SplitExpenseEntity> monthExpenses,
                                       List<SettlementEntity> monthSettlements,
                                       YearMonth month, PersonEntity self, Fronted fronted,
                                       BigDecimal settlementRate) {
        List<String> insights = new ArrayList<>();
        if (balances.youOwe().signum() > 0) {
            insights.add("You currently owe " + balances.youOwe() + " across "
                    + balances.people().stream().filter(p -> p.amount().signum() > 0).count()
                    + " person(s).");
        } else {
            insights.add("You owe nothing right now.");
        }
        if (balances.owedToYou().signum() > 0) {
            insights.add(balances.owedToYou() + " is owed to you across "
                    + balances.people().stream().filter(p -> p.amount().signum() < 0).count()
                    + " person(s).");
        }
        if (!monthExpenses.isEmpty()) {
            insights.add(monthExpenses.size() + " new split expense(s) totalling "
                    + monthExpenses.stream().map(SplitExpenseEntity::getTotalAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add)
                    + " were created in " + month + ".");
        }
        if (!monthSettlements.isEmpty()) {
            insights.add(monthSettlements.size() + " settlement(s) recorded in " + month + ".");
        }
        if (settlementRate != null) {
            insights.add("Lifetime settlement rate: " + settlementRate + "% of everything you owed.");
        }
        if (fronted.youFronted().signum() > 0) {
            insights.add("You are currently fronting " + fronted.youFronted()
                    + " for others across all splits.");
        }
        return insights;
    }

    private LocalDate parseDateRef(String ref) {
        if (ref == null || ref.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(ref.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidRequestException("ref must be a date in yyyy-MM-dd format for weekly reports");
        }
    }

    private YearMonth parseMonthRef(String ref) {
        if (ref == null || ref.isBlank()) {
            return YearMonth.now();
        }
        String trimmed = ref.trim();
        try {
            return YearMonth.parse(trimmed.length() > 7 ? trimmed.substring(0, 7) : trimmed);
        } catch (DateTimeParseException e) {
            throw new InvalidRequestException("ref must be in yyyy-MM format for monthly reports");
        }
    }
}
