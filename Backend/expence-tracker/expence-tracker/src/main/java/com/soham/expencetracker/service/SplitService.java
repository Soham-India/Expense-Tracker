package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.AddGroupMemberRequest;
import com.soham.expencetracker.dto.BalancesResponse;
import com.soham.expencetracker.dto.CreateGroupRequest;
import com.soham.expencetracker.dto.CreatePersonRequest;
import com.soham.expencetracker.dto.GroupResponse;
import com.soham.expencetracker.dto.PersonResponse;
import com.soham.expencetracker.dto.SettlementRequest;
import com.soham.expencetracker.dto.SettlementResponse;
import com.soham.expencetracker.dto.SplitExpenseRequest;
import com.soham.expencetracker.dto.SplitExpenseResponse;
import com.soham.expencetracker.dto.UpdateGroupRequest;
import com.soham.expencetracker.dto.UpdatePersonRequest;
import com.soham.expencetracker.entity.ActualTransactionEntity;
import com.soham.expencetracker.entity.GroupMemberEntity;
import com.soham.expencetracker.entity.PersonEntity;
import com.soham.expencetracker.entity.SettlementEntity;
import com.soham.expencetracker.entity.SplitExpenseEntity;
import com.soham.expencetracker.entity.SplitGroupEntity;
import com.soham.expencetracker.entity.SplitMethod;
import com.soham.expencetracker.entity.SplitParticipantEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.exception.ResourceInUseException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import com.soham.expencetracker.repository.GroupMemberRepository;
import com.soham.expencetracker.repository.PersonRepository;
import com.soham.expencetracker.repository.SettlementRepository;
import com.soham.expencetracker.repository.SplitExpenseRepository;
import com.soham.expencetracker.repository.SplitGroupRepository;
import com.soham.expencetracker.repository.SplitParticipantRepository;
import com.soham.expencetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SplitService {

    private final PersonRepository personRepository;
    private final SplitGroupRepository splitGroupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final SplitExpenseRepository splitExpenseRepository;
    private final SplitParticipantRepository splitParticipantRepository;
    private final SettlementRepository settlementRepository;
    private final ActualTransactionRepository actualTransactionRepository;
    private final UserRepository userRepository;

    // ------------------------------------------------------------------
    // People
    // ------------------------------------------------------------------

    @Transactional
    public PersonResponse createPerson(UUID userId, CreatePersonRequest request) {
        PersonEntity person = new PersonEntity();
        person.setUser(userRepository.getReferenceById(userId));
        applyPerson(person, request.name(), request.contactInfo(), false);
        return PersonResponse.from(personRepository.save(person));
    }

    @Transactional(readOnly = true)
    public List<PersonResponse> listPeople(UUID userId, boolean includeArchived) {
        return (includeArchived
                ? personRepository.findByUserIdOrderByNameAsc(userId)
                : personRepository.findByUserIdAndArchivedFalseOrderByNameAsc(userId))
                .stream().map(PersonResponse::from).toList();
    }

    @Transactional
    public PersonResponse updatePerson(UUID userId, UUID personId, UpdatePersonRequest request) {
        PersonEntity person = getOwnedPerson(userId, personId);
        applyPerson(person, request.name(), request.contactInfo(), request.archived());
        return PersonResponse.from(person);
    }

    @Transactional
    public void deletePerson(UUID userId, UUID personId) {
        PersonEntity person = getOwnedPerson(userId, personId);
        if (person.isSelf()) {
            throw new InvalidRequestException("Your own person record cannot be deleted");
        }
        try {
            personRepository.delete(person);
            personRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResourceInUseException(
                    "Person is referenced by splits, groups or settlements and cannot be deleted; archive them instead");
        }
    }

    // ------------------------------------------------------------------
    // Groups
    // ------------------------------------------------------------------

    @Transactional
    public GroupResponse createGroup(UUID userId, CreateGroupRequest request) {
        SplitGroupEntity group = new SplitGroupEntity();
        group.setUser(userRepository.getReferenceById(userId));
        applyGroup(group, request.name(), request.description());
        group = splitGroupRepository.save(group);

        Set<UUID> seen = new HashSet<>();
        if (request.memberPersonIds() != null) {
            for (UUID personId : request.memberPersonIds()) {
                if (seen.add(personId)) {
                    addMemberInternal(userId, group, personId);
                }
            }
        }
        return toGroupResponse(group);
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> listGroups(UUID userId) {
        return splitGroupRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toGroupResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroup(UUID userId, UUID groupId) {
        return toGroupResponse(getOwnedGroup(userId, groupId));
    }

    @Transactional
    public GroupResponse updateGroup(UUID userId, UUID groupId, UpdateGroupRequest request) {
        SplitGroupEntity group = getOwnedGroup(userId, groupId);
        applyGroup(group, request.name(), request.description());
        group.setStatus(request.status());
        return toGroupResponse(group);
    }

    @Transactional
    public GroupResponse addGroupMember(UUID userId, UUID groupId, AddGroupMemberRequest request) {
        SplitGroupEntity group = getOwnedGroup(userId, groupId);
        addMemberInternal(userId, group, request.personId());
        return toGroupResponse(group);
    }

    @Transactional
    public void removeGroupMember(UUID userId, UUID groupId, UUID personId) {
        getOwnedGroup(userId, groupId);
        GroupMemberEntity member = groupMemberRepository.findByGroupIdAndPersonId(groupId, personId)
                .orElseThrow(() -> new ResourceNotFoundException("Person is not a member of this group"));
        groupMemberRepository.delete(member);
    }

    @Transactional
    public void deleteGroup(UUID userId, UUID groupId) {
        SplitGroupEntity group = getOwnedGroup(userId, groupId);
        if (splitExpenseRepository.existsByGroupId(groupId)) {
            throw new ResourceInUseException(
                    "Group has split expenses and cannot be deleted; archive it instead");
        }
        groupMemberRepository.deleteByGroupId(groupId);
        groupMemberRepository.flush();
        splitGroupRepository.delete(group);
    }

    // ------------------------------------------------------------------
    // Split expenses
    // ------------------------------------------------------------------

    @Transactional
    public SplitExpenseResponse createExpense(UUID userId, SplitExpenseRequest request) {
        SplitExpenseEntity expense = new SplitExpenseEntity();
        expense.setUser(userRepository.getReferenceById(userId));
        expense.setCreatedBy(getOwnedPerson(userId, request.createdByPersonId()));
        if (request.groupId() != null) {
            expense.setGroup(getOwnedGroup(userId, request.groupId()));
        }
        applyExpenseFields(expense, request);
        splitExpenseRepository.save(expense);
        List<SplitParticipantEntity> participants = replaceParticipants(userId, expense, request);
        return SplitExpenseResponse.from(expense, participants);
    }

    @Transactional(readOnly = true)
    public List<SplitExpenseResponse> listExpenses(UUID userId, String rawMonth, UUID groupId) {
        YearMonth month = parseOptionalMonth(rawMonth);
        List<SplitExpenseEntity> expenses =
                splitExpenseRepository.findByUserIdAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
                        userId, month.atDay(1), month.atEndOfMonth());
        Map<UUID, List<SplitParticipantEntity>> byExpense = participantsByExpense(userId);
        return expenses.stream()
                .filter(e -> groupId == null || (e.getGroup() != null && e.getGroup().getId().equals(groupId)))
                .map(e -> SplitExpenseResponse.from(e, byExpense.getOrDefault(e.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public SplitExpenseResponse getExpense(UUID userId, UUID expenseId) {
        SplitExpenseEntity expense = getOwnedExpense(userId, expenseId);
        return SplitExpenseResponse.from(expense,
                splitParticipantRepository.findBySplitExpenseIdOrderByCreatedAtAscIdAsc(expenseId));
    }

    @Transactional
    public SplitExpenseResponse updateExpense(UUID userId, UUID expenseId, SplitExpenseRequest request) {
        SplitExpenseEntity expense = getOwnedExpense(userId, expenseId);
        expense.setCreatedBy(getOwnedPerson(userId, request.createdByPersonId()));
        if (request.groupId() != null) {
            expense.setGroup(getOwnedGroup(userId, request.groupId()));
        } else {
            expense.setGroup(null);
        }
        applyExpenseFields(expense, request);
        List<SplitParticipantEntity> participants = replaceParticipants(userId, expense, request);
        return SplitExpenseResponse.from(expense, participants);
    }

    @Transactional
    public void deleteExpense(UUID userId, UUID expenseId) {
        splitExpenseRepository.delete(getOwnedExpense(userId, expenseId));
    }

    // ------------------------------------------------------------------
    // Settlements
    // ------------------------------------------------------------------

    /**
     * Recorded exactly as stated (§7.7): no outstanding-balance validation,
     * no automatic Actual transaction. The actualTransactionId link is only
     * set when the caller explicitly provides one.
     */
    @Transactional
    public SettlementResponse createSettlement(UUID userId, SettlementRequest request) {
        PersonEntity from = getOwnedPerson(userId, request.fromPersonId());
        PersonEntity to = getOwnedPerson(userId, request.toPersonId());
        if (from.getId().equals(to.getId())) {
            throw new InvalidRequestException("A settlement needs two different people");
        }
        SettlementEntity settlement = new SettlementEntity();
        settlement.setUser(userRepository.getReferenceById(userId));
        settlement.setFromPerson(from);
        settlement.setToPerson(to);
        settlement.setAmount(request.amount());
        settlement.setSettlementDate(request.date());
        settlement.setNote(trimOrNull(request.note()));
        if (request.actualTransactionId() != null) {
            ActualTransactionEntity txn = actualTransactionRepository
                    .findByUserIdAndId(userId, request.actualTransactionId())
                    .orElseThrow(() -> new ResourceNotFoundException("Actual transaction not found"));
            settlement.setActualTransaction(txn);
        }
        return SettlementResponse.from(settlementRepository.save(settlement));
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> listSettlements(UUID userId, String rawMonth) {
        YearMonth month = parseOptionalMonth(rawMonth);
        return settlementRepository
                .findByUserIdAndSettlementDateBetweenOrderBySettlementDateDescIdDesc(
                        userId, month.atDay(1), month.atEndOfMonth())
                .stream().map(SettlementResponse::from).toList();
    }

    // ------------------------------------------------------------------
    // Balances (§7.6) — derived from a pairwise debt matrix:
    // debt[a][b] = amount a owes b. Ledger entries add, settlements
    // subtract (recorded as stated, so they may overpay and flip a pair).
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public BalancesResponse balances(UUID userId) {
        PersonEntity self = personRepository.findByUserIdAndSelfTrue(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Self person record missing — re-registering is required"));

        Map<UUID, Map<UUID, BigDecimal>> debt = new HashMap<>();

        Map<UUID, List<SplitParticipantEntity>> byExpense = participantsByExpense(userId);
        for (List<SplitParticipantEntity> participants : byExpense.values()) {
            Map<UUID, BigDecimal> nets = new LinkedHashMap<>();
            for (SplitParticipantEntity p : participants) {
                nets.put(p.getPerson().getId(), p.getPaidAmount().subtract(p.getShareAmount()));
            }
            for (SplitAlgorithms.LedgerEntry entry : SplitAlgorithms.greedyPairing(nets)) {
                debt.computeIfAbsent(entry.debtorId(), k -> new HashMap<>())
                        .merge(entry.creditorId(), entry.amount(), BigDecimal::add);
            }
        }
        for (SettlementEntity s : settlementRepository.findByUserIdOrderBySettlementDateAsc(userId)) {
            debt.computeIfAbsent(s.getFromPerson().getId(), k -> new HashMap<>())
                    .merge(s.getToPerson().getId(), s.getAmount().negate(), BigDecimal::add);
        }

        Map<UUID, PersonEntity> personById = new HashMap<>();
        personRepository.findByUserIdOrderByNameAsc(userId).forEach(p -> personById.put(p.getId(), p));

        BigDecimal youOwe = BigDecimal.ZERO;
        BigDecimal owedToYou = BigDecimal.ZERO;
        List<BalancesResponse.PersonBalance> peopleBalances = new ArrayList<>();
        List<BalancesResponse.PairDebt> pairs = new ArrayList<>();

        for (Map.Entry<UUID, PersonEntity> entry : personById.entrySet()) {
            PersonEntity person = entry.getValue();
            if (person.isSelf()) {
                continue;
            }
            BigDecimal netWithPerson = netOwes(debt, self.getId(), person.getId());
            if (netWithPerson.signum() > 0) {
                youOwe = youOwe.add(netWithPerson);
            } else if (netWithPerson.signum() < 0) {
                owedToYou = owedToYou.add(netWithPerson.negate());
            }
            if (!person.isArchived() || netWithPerson.signum() != 0) {
                peopleBalances.add(new BalancesResponse.PersonBalance(
                        person.getId(), person.getName(), false, netWithPerson));
            }
        }

        List<UUID> ids = new ArrayList<>(personById.keySet());
        for (int i = 0; i < ids.size(); i++) {
            for (int j = i + 1; j < ids.size(); j++) {
                BigDecimal net = netOwes(debt, ids.get(i), ids.get(j));
                if (net.signum() == 0) {
                    continue;
                }
                UUID debtorId = net.signum() > 0 ? ids.get(i) : ids.get(j);
                UUID creditorId = debtorId.equals(ids.get(i)) ? ids.get(j) : ids.get(i);
                pairs.add(new BalancesResponse.PairDebt(
                        debtorId, personById.get(debtorId).getName(),
                        creditorId, personById.get(creditorId).getName(), net.abs()));
            }
        }
        pairs.sort(java.util.Comparator.comparing(BalancesResponse.PairDebt::fromPersonName)
                .thenComparing(BalancesResponse.PairDebt::toPersonName));

        return new BalancesResponse(youOwe, owedToYou, owedToYou.subtract(youOwe),
                peopleBalances.stream()
                        .sorted(java.util.Comparator.comparing(BalancesResponse.PersonBalance::personName))
                        .toList(),
                pairs);
    }

    /**
     * netOwes(debt, a, b) > 0 means a owes b that amount.
     */
    private BigDecimal netOwes(Map<UUID, Map<UUID, BigDecimal>> debt, UUID a, UUID b) {
        BigDecimal ab = debt.getOrDefault(a, Map.of()).getOrDefault(b, BigDecimal.ZERO);
        BigDecimal ba = debt.getOrDefault(b, Map.of()).getOrDefault(a, BigDecimal.ZERO);
        return ab.subtract(ba);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private void applyPerson(PersonEntity person, String name, String contactInfo, boolean archived) {
        person.setName(name.trim());
        person.setContactInfo(trimOrNull(contactInfo));
        person.setArchived(archived);
    }

    private void applyGroup(SplitGroupEntity group, String name, String description) {
        group.setName(name.trim());
        group.setDescription(trimOrNull(description));
    }

    private void addMemberInternal(UUID userId, SplitGroupEntity group, UUID personId) {
        PersonEntity person = getOwnedPerson(userId, personId);
        if (groupMemberRepository.existsByGroupIdAndPersonId(group.getId(), personId)) {
            throw new DuplicateResourceException("Person is already a member of this group");
        }
        GroupMemberEntity member = new GroupMemberEntity();
        member.setUser(group.getUser());
        member.setGroup(group);
        member.setPerson(person);
        groupMemberRepository.save(member);
    }

    private void applyExpenseFields(SplitExpenseEntity expense, SplitExpenseRequest request) {
        expense.setTotalAmount(request.totalAmount());
        expense.setSplitMethod(request.splitMethod());
        expense.setDescription(trimOrNull(request.description()));
        expense.setExpenseDate(request.date());
    }

    /**
     * Recomputes canonical shares server-side (client hints are never
     * trusted), replaces all participant rows, and returns the fresh set.
     * Ledger is derived at read time, so replacement is always safe.
     */
    private List<SplitParticipantEntity> replaceParticipants(UUID userId,
                                                             SplitExpenseEntity expense,
                                                             SplitExpenseRequest request) {
        List<SplitExpenseRequest.ParticipantInput> inputs = request.participants();
        Set<UUID> uniqueIds = new HashSet<>();
        for (var input : inputs) {
            if (!uniqueIds.add(input.personId())) {
                throw new InvalidRequestException("Each person may appear only once in the participants list");
            }
        }

        List<PersonEntity> people = new ArrayList<>();
        for (var input : inputs) {
            PersonEntity person = getOwnedPerson(userId, input.personId());
            if (person.isArchived()) {
                throw new InvalidRequestException(
                        "'" + person.getName() + "' is archived and cannot be part of a split");
            }
            people.add(person);
        }

        List<BigDecimal> shares = switch (expense.getSplitMethod()) {
            case EQUAL -> SplitAlgorithms.distributeEqual(request.totalAmount(), inputs.size());
            case EXACT -> SplitAlgorithms.distributeExact(request.totalAmount(), shareValues(inputs));
            case PERCENTAGE -> SplitAlgorithms.distributePercentage(request.totalAmount(), shareValues(inputs));
            case SHARE -> SplitAlgorithms.distributeByUnits(request.totalAmount(), shareValues(inputs));
        };

        splitParticipantRepository.deleteBySplitExpenseId(expense.getId());
        splitParticipantRepository.flush();

        List<SplitParticipantEntity> saved = new ArrayList<>();
        for (int i = 0; i < inputs.size(); i++) {
            var input = inputs.get(i);
            SplitParticipantEntity participant = new SplitParticipantEntity();
            participant.setSplitExpense(expense);
            participant.setPerson(people.get(i));
            participant.setShareAmount(shares.get(i));
            participant.setPaidAmount(input.paidAmount() == null ? BigDecimal.ZERO : input.paidAmount());
            if (expense.getSplitMethod() == SplitMethod.PERCENTAGE) {
                participant.setSplitPercentage(input.shareValue());
            } else if (expense.getSplitMethod() == SplitMethod.SHARE) {
                participant.setSplitUnits(input.shareValue());
            }
            saved.add(participant);
        }
        return splitParticipantRepository.saveAll(saved);
    }

    private List<BigDecimal> shareValues(List<SplitExpenseRequest.ParticipantInput> inputs) {
        for (var input : inputs) {
            if (input.shareValue() == null || input.shareValue().signum() < 0) {
                throw new InvalidRequestException(
                        "Every participant needs a non-negative shareValue for this split method");
            }
        }
        return inputs.stream().map(SplitExpenseRequest.ParticipantInput::shareValue).toList();
    }

    private Map<UUID, List<SplitParticipantEntity>> participantsByExpense(UUID userId) {
        Map<UUID, List<SplitParticipantEntity>> byExpense = new HashMap<>();
        for (SplitParticipantEntity p : splitParticipantRepository.findOfUserExpenses(userId)) {
            byExpense.computeIfAbsent(p.getSplitExpense().getId(), k -> new ArrayList<>()).add(p);
        }
        return byExpense;
    }

    private GroupResponse toGroupResponse(SplitGroupEntity group) {
        return new GroupResponse(group.getId(), group.getName(), group.getDescription(), group.getStatus(),
                groupMemberRepository.findByGroupIdOrderByJoinedAtAsc(group.getId()).stream()
                        .map(m -> GroupResponse.MemberResponse.from(m.getPerson()))
                        .toList());
    }

    private PersonEntity getOwnedPerson(UUID userId, UUID personId) {
        return personRepository.findByUserIdAndId(userId, personId)
                .orElseThrow(() -> new ResourceNotFoundException("Person not found"));
    }

    private SplitGroupEntity getOwnedGroup(UUID userId, UUID groupId) {
        return splitGroupRepository.findByUserIdAndId(userId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
    }

    private SplitExpenseEntity getOwnedExpense(UUID userId, UUID expenseId) {
        return splitExpenseRepository.findByUserIdAndId(userId, expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("Split expense not found"));
    }

    private YearMonth parseOptionalMonth(String raw) {
        if (raw == null || raw.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidRequestException("month must be in yyyy-MM format");
        }
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
