package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.BalancesResponse;
import com.soham.expencetracker.dto.CreatePersonRequest;
import com.soham.expencetracker.dto.SplitExpenseRequest;
import com.soham.expencetracker.dto.SplitExpenseResponse;
import com.soham.expencetracker.entity.PersonEntity;
import com.soham.expencetracker.entity.SettlementEntity;
import com.soham.expencetracker.entity.SplitExpenseEntity;
import com.soham.expencetracker.entity.SplitMethod;
import com.soham.expencetracker.entity.SplitParticipantEntity;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import com.soham.expencetracker.repository.GroupMemberRepository;
import com.soham.expencetracker.repository.PersonRepository;
import com.soham.expencetracker.repository.SettlementRepository;
import com.soham.expencetracker.repository.SplitExpenseRepository;
import com.soham.expencetracker.repository.SplitGroupRepository;
import com.soham.expencetracker.repository.SplitParticipantRepository;
import com.soham.expencetracker.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SplitServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private PersonRepository personRepository;
    @Mock
    private SplitGroupRepository splitGroupRepository;
    @Mock
    private GroupMemberRepository groupMemberRepository;
    @Mock
    private SplitExpenseRepository splitExpenseRepository;
    @Mock
    private SplitParticipantRepository splitParticipantRepository;
    @Mock
    private SettlementRepository settlementRepository;
    @Mock
    private ActualTransactionRepository actualTransactionRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SplitService splitService;

    @Test
    void createExpense_equalSplit_computesCanonicalShares() {
        PersonEntity self = person("Me", false, false);
        PersonEntity alice = person("Alice", false, false);
        PersonEntity bob = person("Bob", false, false);
        when(personRepository.findByUserIdAndId(USER_ID, self.getId())).thenReturn(Optional.of(self));
        when(personRepository.findByUserIdAndId(USER_ID, alice.getId())).thenReturn(Optional.of(alice));
        when(personRepository.findByUserIdAndId(USER_ID, bob.getId())).thenReturn(Optional.of(bob));
        when(userRepository.getReferenceById(USER_ID)).thenReturn(new com.soham.expencetracker.entity.UserEntity());
        when(splitExpenseRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(splitParticipantRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var request = new SplitExpenseRequest(null, self.getId(), "Lunch",
                new BigDecimal("100.00"), SplitMethod.EQUAL, LocalDate.of(2026, 8, 15),
                List.of(
                        new SplitExpenseRequest.ParticipantInput(self.getId(), new BigDecimal("100.00"), null),
                        new SplitExpenseRequest.ParticipantInput(alice.getId(), null, null),
                        new SplitExpenseRequest.ParticipantInput(bob.getId(), null, null)));

        var response = splitService.createExpense(USER_ID, request);

        assertThat(sumShares(response)).isEqualByComparingTo("100.00");
        assertThat(response.participants().get(0).shareAmount()).isEqualByComparingTo("33.34");
        assertThat(response.participants().get(0).paidAmount()).isEqualByComparingTo("100.00");
        assertThat(response.participants().get(1).shareAmount()).isEqualByComparingTo("33.33");
    }

    @Test
    void createExpense_duplicateParticipant_rejected() {
        PersonEntity self = person("Me", false, false);
        when(personRepository.findByUserIdAndId(USER_ID, self.getId())).thenReturn(Optional.of(self));
        when(userRepository.getReferenceById(USER_ID)).thenReturn(new com.soham.expencetracker.entity.UserEntity());

        var request = new SplitExpenseRequest(null, self.getId(), null,
                new BigDecimal("100"), SplitMethod.EQUAL, LocalDate.of(2026, 8, 15),
                List.of(
                        new SplitExpenseRequest.ParticipantInput(self.getId(), null, null),
                        new SplitExpenseRequest.ParticipantInput(self.getId(), null, null)));

        assertThatThrownBy(() -> splitService.createExpense(USER_ID, request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("only once");
    }

    @Test
    void deletePerson_selfRecord_blocked() {
        PersonEntity self = person("Me", true, false);
        when(personRepository.findByUserIdAndId(USER_ID, self.getId())).thenReturn(Optional.of(self));

        assertThatThrownBy(() -> splitService.deletePerson(USER_ID, self.getId()))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("cannot be deleted");
    }

    @Test
    void balances_settlementOverpay_flipsThePair_asStated() {
        PersonEntity self = person("Me", true, false);
        PersonEntity alice = person("Alice", false, false);

        SplitExpenseEntity expense = new SplitExpenseEntity();
        expense.setId(UUID.randomUUID());

        SplitParticipantEntity selfPart = participant(expense, self, "66.66", "0.00");
        SplitParticipantEntity alicePart = participant(expense, alice, "33.34", "100.00");

        SettlementEntity settlement = new SettlementEntity();
        settlement.setFromPerson(self);
        settlement.setToPerson(alice);
        settlement.setAmount(new BigDecimal("90.00"));

        when(personRepository.findByUserIdAndSelfTrue(USER_ID)).thenReturn(Optional.of(self));
        when(splitParticipantRepository.findOfUserExpenses(USER_ID))
                .thenReturn(List.of(selfPart, alicePart));
        when(settlementRepository.findByUserIdOrderBySettlementDateAsc(USER_ID))
                .thenReturn(List.of(settlement));
        when(personRepository.findByUserIdOrderByNameAsc(USER_ID)).thenReturn(List.of(self, alice));

        BalancesResponse balances = splitService.balances(USER_ID);

        // Expense: I owe Alice 66.66. Settlement of 90.00 is recorded as
        // stated and overpays, flipping the pair: Alice now owes me 23.34.
        BigDecimal expectedNet = new BigDecimal("90.00").subtract(new BigDecimal("66.66"));

        assertThat(balances.youOwe()).isEqualByComparingTo("0");
        assertThat(balances.owedToYou()).isEqualByComparingTo(expectedNet);
        assertThat(balances.netBalance()).isEqualByComparingTo(expectedNet);
        assertThat(balances.people().get(0).amount()).isEqualByComparingTo(expectedNet.negate());
        assertThat(balances.pairs()).anySatisfy(pair -> {
            assertThat(pair.fromPersonId()).isEqualTo(alice.getId());
            assertThat(pair.toPersonId()).isEqualTo(self.getId());
            assertThat(pair.amount()).isEqualByComparingTo(expectedNet);
        });
    }

    private PersonEntity person(String name, boolean self, boolean archived) {
        PersonEntity entity = new PersonEntity();
        entity.setId(UUID.randomUUID());
        entity.setName(name);
        entity.setSelf(self);
        entity.setArchived(archived);
        return entity;
    }

    private SplitParticipantEntity participant(SplitExpenseEntity expense, PersonEntity person,
                                               String share, String paid) {
        SplitParticipantEntity entity = new SplitParticipantEntity();
        entity.setSplitExpense(expense);
        entity.setPerson(person);
        entity.setShareAmount(new BigDecimal(share));
        entity.setPaidAmount(new BigDecimal(paid));
        return entity;
    }

    private BigDecimal sumShares(SplitExpenseResponse response) {
        return response.participants().stream()
                .map(SplitExpenseResponse.ParticipantResponse::shareAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
