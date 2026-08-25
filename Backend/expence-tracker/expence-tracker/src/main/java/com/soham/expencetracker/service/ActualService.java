package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.AccountResponse;
import com.soham.expencetracker.dto.AccountsResponse;
import com.soham.expencetracker.dto.ActualTransactionRequest;
import com.soham.expencetracker.dto.ActualTransactionResponse;
import com.soham.expencetracker.dto.CreateAccountRequest;
import com.soham.expencetracker.dto.UpdateAccountRequest;
import com.soham.expencetracker.entity.AccountEntity;
import com.soham.expencetracker.entity.ActualTransactionEntity;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.CategoryScope;
import com.soham.expencetracker.entity.SubcategoryEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.exception.ResourceInUseException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.AccountRepository;
import com.soham.expencetracker.repository.ActualTransactionRepository;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
import com.soham.expencetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActualService {

    private final AccountRepository accountRepository;
    private final ActualTransactionRepository actualTransactionRepository;
    private final CategoryRepository categoryRepository;
    private final SubcategoryRepository subcategoryRepository;
    private final UserRepository userRepository;

    @Transactional
    public AccountResponse createAccount(UUID userId, CreateAccountRequest request) {
        String name = request.name().trim();
        if (accountRepository.existsByUserIdAndNameIgnoreCase(userId, name)) {
            throw new DuplicateResourceException("An account named '" + name + "' already exists");
        }
        AccountEntity account = new AccountEntity();
        account.setUser(userRepository.getReferenceById(userId));
        account.setName(name);
        account.setAccountType(request.accountType());
        account.setStartingBalance(request.startingBalance());
        return toResponseWithMovements(userId, accountRepository.save(account));
    }

    @Transactional(readOnly = true)
    public AccountsResponse listAccounts(UUID userId, boolean includeArchived) {
        List<AccountEntity> accounts = includeArchived
                ? accountRepository.findByUserIdOrderByNameAsc(userId)
                : accountRepository.findByUserIdAndArchivedFalseOrderByNameAsc(userId);
        List<AccountResponse> responses = accounts.stream()
                .map(account -> toResponseWithMovements(userId, account))
                .toList();
        boolean allConfigured = responses.stream()
                .allMatch(account -> account.startingBalance() != null);
        return new AccountsResponse(responses, allConfigured);
    }

    @Transactional(readOnly = true)
    public AccountResponse getAccount(UUID userId, UUID accountId) {
        return toResponseWithMovements(userId, getOwned(userId, accountId));
    }

    @Transactional
    public AccountResponse updateAccount(UUID userId, UUID accountId, UpdateAccountRequest request) {
        AccountEntity account = getOwned(userId, accountId);
        String name = request.name().trim();
        if (accountRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(userId, name, accountId)) {
            throw new DuplicateResourceException("An account named '" + name + "' already exists");
        }
        account.setName(name);
        account.setAccountType(request.accountType());
        account.setStartingBalance(request.startingBalance());
        account.setArchived(request.archived());
        return toResponseWithMovements(userId, account);
    }

    @Transactional
    public void deleteAccount(UUID userId, UUID accountId) {
        AccountEntity account = getOwned(userId, accountId);
        try {
            accountRepository.delete(account);
            accountRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResourceInUseException(
                    "Account is referenced by transactions and cannot be deleted; archive it instead");
        }
    }

    @Transactional
    public ActualTransactionResponse addTransaction(UUID userId, ActualTransactionRequest request) {
        ResolvedAccounts resolved = validateShape(userId, request);

        ActualTransactionEntity txn = new ActualTransactionEntity();
        txn.setUser(userRepository.getReferenceById(userId));
        applyRequest(userId, txn, request, resolved);
        return ActualTransactionResponse.from(actualTransactionRepository.save(txn));
    }

    @Transactional(readOnly = true)
    public List<ActualTransactionResponse> listTransactions(UUID userId, String rawMonth,
                                                            ActualTxnType type, UUID accountId) {
        YearMonth month = parseOptionalMonth(rawMonth);
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();

        List<ActualTransactionEntity> txns;
        if (accountId != null) {
            getOwned(userId, accountId);
            txns = actualTransactionRepository.findByUserIdAndAccountIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(
                    userId, accountId, start, end);
        } else if (type != null) {
            txns = actualTransactionRepository.findByUserIdAndTypeAndTxnDateBetweenOrderByTxnDateDescIdDesc(
                    userId, type, start, end);
        } else {
            txns = actualTransactionRepository.findByUserIdAndTxnDateBetweenOrderByTxnDateDescIdDesc(
                    userId, start, end);
        }
        return txns.stream().map(ActualTransactionResponse::from).toList();
    }

    @Transactional
    public ActualTransactionResponse updateTransaction(UUID userId, UUID txnId, ActualTransactionRequest request) {
        ActualTransactionEntity txn = actualTransactionRepository.findByUserIdAndId(userId, txnId)
                .orElseThrow(() -> new ResourceNotFoundException("Actual transaction not found"));
        ResolvedAccounts resolved = validateShape(userId, request);
        applyRequest(userId, txn, request, resolved);
        return ActualTransactionResponse.from(txn);
    }

    @Transactional
    public void deleteTransaction(UUID userId, UUID txnId) {
        ActualTransactionEntity txn = actualTransactionRepository.findByUserIdAndId(userId, txnId)
                .orElseThrow(() -> new ResourceNotFoundException("Actual transaction not found"));
        actualTransactionRepository.delete(txn);
    }

    private void applyRequest(UUID userId,
                              ActualTransactionEntity txn,
                              ActualTransactionRequest request,
                              ResolvedAccounts resolved) {
        txn.setType(request.type());
        txn.setAmount(request.amount());
        txn.setCategory(resolveCategory(userId, request));
        txn.setSubcategory(resolveSubcategory(userId, request));
        txn.setAccount(resolved.account());
        txn.setTransferToAccount(resolved.transferToAccount());
        txn.setPaymentMethod(request.paymentMethod());
        txn.setDescription(trimOrNull(request.description()));
        txn.setTxnDate(request.date());
        txn.setNotes(trimOrNull(request.notes()));
    }

    /**
     * Validates the shape rules of §6.5/§24: transfers need two distinct owned
     * accounts and are never income or expense (no category); non-transfers
     * never carry a transfer target. Category scope is enforced as
     * ACTUAL/BOTH only.
     */
    private ResolvedAccounts validateShape(UUID userId, ActualTransactionRequest request) {
        if (request.type() == ActualTxnType.TRANSFER) {
            if (request.categoryId() != null || request.subcategoryId() != null) {
                throw new InvalidRequestException(
                        "Transfers are not income or expense — remove the category/subcategory");
            }
            if (request.accountId() == null || request.transferToAccountId() == null) {
                throw new InvalidRequestException("A transfer requires both a source and a target account");
            }
            if (request.accountId().equals(request.transferToAccountId())) {
                throw new InvalidRequestException("Source and target accounts must be different");
            }
            return new ResolvedAccounts(getOwned(userId, request.accountId()),
                    getOwned(userId, request.transferToAccountId()));
        }

        if (request.transferToAccountId() != null) {
            throw new InvalidRequestException(
                    "transferToAccountId is only valid for TRANSFER transactions");
        }
        AccountEntity account = request.accountId() == null ? null : getOwned(userId, request.accountId());
        return new ResolvedAccounts(account, null);
    }

    private CategoryEntity resolveCategory(UUID userId, ActualTransactionRequest request) {
        if (request.categoryId() == null) {
            return null;
        }
        CategoryEntity category = categoryRepository.findByUserIdAndId(userId, request.categoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
        if (category.getScope() == CategoryScope.IDEAL) {
            throw new InvalidRequestException(
                    "Category '" + category.getName() + "' is not available in the Actual system (scope: IDEAL)");
        }
        return category;
    }

    private SubcategoryEntity resolveSubcategory(UUID userId, ActualTransactionRequest request) {
        if (request.subcategoryId() == null) {
            return null;
        }
        if (request.categoryId() == null) {
            throw new InvalidRequestException("categoryId is required when a subcategoryId is provided");
        }
        SubcategoryEntity subcategory = subcategoryRepository.findByIdAndCategoryUserId(request.subcategoryId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Subcategory not found"));
        if (!subcategory.getCategory().getId().equals(request.categoryId())) {
            throw new InvalidRequestException("Subcategory does not belong to the provided category");
        }
        return subcategory;
    }

    private AccountResponse toResponseWithMovements(UUID userId, AccountEntity account) {
        BigDecimal totalInflow = actualTransactionRepository.totalInflowForAccount(
                userId, account.getId(), ActualTxnType.INCOMING, ActualTxnType.TRANSFER);
        BigDecimal totalOutflow = actualTransactionRepository.totalOutflowForAccount(
                userId, account.getId(), EnumSet.of(ActualTxnType.OUTGOING, ActualTxnType.TRANSFER));
        BigDecimal currentBalance = account.getStartingBalance() == null
                ? null
                : account.getStartingBalance().add(totalInflow).subtract(totalOutflow);
        return new AccountResponse(
                account.getId(),
                account.getName(),
                account.getAccountType(),
                account.getStartingBalance(),
                account.isArchived(),
                totalInflow,
                totalOutflow,
                currentBalance);
    }

    private AccountEntity getOwned(UUID userId, UUID accountId) {
        return accountRepository.findByUserIdAndId(userId, accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
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

    private record ResolvedAccounts(AccountEntity account, AccountEntity transferToAccount) {
    }
}
