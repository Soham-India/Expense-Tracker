package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.AccountResponse;
import com.soham.expencetracker.dto.AccountsResponse;
import com.soham.expencetracker.dto.ActualTransactionRequest;
import com.soham.expencetracker.dto.CreateAccountRequest;
import com.soham.expencetracker.entity.AccountEntity;
import com.soham.expencetracker.entity.AccountType;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.CategoryScope;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.exception.ResourceInUseException;
import com.soham.expencetracker.repository.AccountRepository;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
import com.soham.expencetracker.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActualServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private AccountRepository accountRepository;
    @Mock
    private ActualTransactionRepository actualTransactionRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private SubcategoryRepository subcategoryRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ActualService actualService;

    @Test
    void createAccount_duplicateName_throwsConflict() {
        when(accountRepository.existsByUserIdAndNameIgnoreCase(USER_ID, "sbi")).thenReturn(true);

        assertThatThrownBy(() ->
                actualService.createAccount(USER_ID, new CreateAccountRequest("sbi", AccountType.BANK, null)))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void addTransfer_missingTargetAccount_rejected() {
        assertThatThrownBy(() -> actualService.addTransaction(USER_ID,
                transferRequest("1000", UUID.randomUUID(), null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("source and a target");
    }

    @Test
    void addTransfer_sameAccountOnBothSides_rejected() {
        UUID same = UUID.randomUUID();

        assertThatThrownBy(() -> actualService.addTransaction(USER_ID,
                transferRequest("1000", same, same)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("must be different");
    }

    @Test
    void addTransfer_withCategory_rejectedAsNotIncomeOrExpense() {
        assertThatThrownBy(() -> {
            ActualTransactionRequest request = new ActualTransactionRequest(
                    ActualTxnType.TRANSFER, new BigDecimal("1000"),
                    UUID.randomUUID(), null, UUID.randomUUID(), UUID.randomUUID(),
                    null, null, LocalDate.of(2026, 8, 10), null);
            actualService.addTransaction(USER_ID, request);
        }).isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("not income or expense");
    }

    @Test
    void addTransfer_happyPath_resolvesBothAccounts() {
        UUID fromId = UUID.randomUUID();
        UUID toId = UUID.randomUUID();
        stubOwnedAccount(fromId);
        stubOwnedAccount(toId);
        when(actualTransactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = actualService.addTransaction(
                USER_ID, transferRequest("5000", fromId, toId));

        ArgumentCaptor<com.soham.expencetracker.entity.ActualTransactionEntity> captor =
                ArgumentCaptor.forClass(com.soham.expencetracker.entity.ActualTransactionEntity.class);
        verify(actualTransactionRepository).save(captor.capture());
        assertThat(captor.getValue().getAccount().getId()).isEqualTo(fromId);
        assertThat(captor.getValue().getTransferToAccount().getId()).isEqualTo(toId);
        assertThat(response.type()).isEqualTo(ActualTxnType.TRANSFER);
    }

    @Test
    void addNonTransfer_withTransferTarget_rejected() {
        assertThatThrownBy(() -> {
            ActualTransactionRequest request = new ActualTransactionRequest(
                    ActualTxnType.INCOMING, new BigDecimal("500"), null, null,
                    UUID.randomUUID(), UUID.randomUUID(), null, null,
                    LocalDate.of(2026, 8, 10), null);
            actualService.addTransaction(USER_ID, request);
        }).isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("only valid for TRANSFER");
    }

    @Test
    void addExpense_idealOnlyCategory_rejected() {
        CategoryEntity idealOnly = new CategoryEntity();
        idealOnly.setId(UUID.randomUUID());
        idealOnly.setName("Planned Vacation");
        idealOnly.setScope(CategoryScope.IDEAL);
        when(categoryRepository.findByUserIdAndId(USER_ID, idealOnly.getId()))
                .thenReturn(Optional.of(idealOnly));

        assertThatThrownBy(() -> {
            ActualTransactionRequest request = new ActualTransactionRequest(
                    ActualTxnType.OUTGOING, new BigDecimal("900"),
                    idealOnly.getId(), null, null, null, null, null,
                    LocalDate.of(2026, 8, 12), null);
            actualService.addTransaction(USER_ID, request);
        }).isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("not available in the Actual system");
    }

    @Test
    void listAccounts_balanceMath_includesTransfers_andFlagsPartialData() {
        AccountEntity sbi = account("SBI", new BigDecimal("5000"));
        AccountEntity upi = account("UPI Wallet", null);
        when(accountRepository.findByUserIdOrderByNameAsc(USER_ID)).thenReturn(List.of(sbi, upi));
        when(actualTransactionRepository.totalInflowForAccount(USER_ID, sbi.getId(),
                ActualTxnType.INCOMING, ActualTxnType.TRANSFER)).thenReturn(new BigDecimal("3000"));
        when(actualTransactionRepository.totalOutflowForAccount(USER_ID, sbi.getId(),
                EnumSet.of(ActualTxnType.OUTGOING, ActualTxnType.TRANSFER))).thenReturn(new BigDecimal("4500"));

        AccountsResponse response = actualService.listAccounts(USER_ID, true);

        assertThat(response.allStartingBalancesConfigured()).isFalse();
        AccountResponse sbiResponse = response.accounts().get(0);
        assertThat(sbiResponse.currentBalance()).isEqualByComparingTo("3500");
        assertThat(response.accounts().get(1).currentBalance()).isNull();
    }

    @Test
    void deleteAccount_referencedByTransactions_translatesToConflict() {
        AccountEntity sbi = account("SBI", BigDecimal.TEN);
        when(accountRepository.findByUserIdAndId(USER_ID, sbi.getId())).thenReturn(Optional.of(sbi));
        doThrow(new DataIntegrityViolationException("fk"))
                .when(accountRepository).delete(sbi);

        assertThatThrownBy(() -> actualService.deleteAccount(USER_ID, sbi.getId()))
                .isInstanceOf(ResourceInUseException.class)
                .hasMessageContaining("archive it instead");
    }

    private ActualTransactionRequest transferRequest(String amount, UUID from, UUID to) {
        return new ActualTransactionRequest(
                ActualTxnType.TRANSFER, new BigDecimal(amount), null, null,
                from, to, null, null, LocalDate.of(2026, 8, 10), null);
    }

    private void stubOwnedAccount(UUID accountId) {
        AccountEntity account = new AccountEntity();
        account.setId(accountId);
        account.setName("Acc-" + accountId);
        when(accountRepository.findByUserIdAndId(USER_ID, accountId)).thenReturn(Optional.of(account));
    }

    private AccountEntity account(String name, BigDecimal startingBalance) {
        AccountEntity entity = new AccountEntity();
        entity.setId(UUID.randomUUID());
        entity.setName(name);
        entity.setAccountType(AccountType.BANK);
        entity.setStartingBalance(startingBalance);
        return entity;
    }
}
