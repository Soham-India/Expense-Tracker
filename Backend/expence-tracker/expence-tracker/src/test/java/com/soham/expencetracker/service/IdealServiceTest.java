package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.IdealSummaryResponse;
import com.soham.expencetracker.dto.IdealTransactionRequest;
import com.soham.expencetracker.dto.StartIdealMonthRequest;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.CategoryScope;
import com.soham.expencetracker.entity.IdealMonthEntity;
import com.soham.expencetracker.entity.IdealTxnType;
import com.soham.expencetracker.entity.SubcategoryEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.IdealMonthRepository;
import com.soham.expencetracker.repository.IdealTransactionRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
import com.soham.expencetracker.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
class IdealServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final LocalDate AUG_1 = LocalDate.of(2026, 8, 1);

    @Mock
    private IdealMonthRepository idealMonthRepository;
    @Mock
    private IdealTransactionRepository idealTransactionRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private SubcategoryRepository subcategoryRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private IdealService idealService;

    @Test
    void startMonth_normalizesToFirstOfMonth() {
        when(idealMonthRepository.existsByUserIdAndMonth(USER_ID, AUG_1)).thenReturn(false);
        ArgumentCaptor<IdealMonthEntity> captor = ArgumentCaptor.forClass(IdealMonthEntity.class);
        when(idealMonthRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = idealService.startMonth(
                USER_ID, new StartIdealMonthRequest("2026-08", new BigDecimal("25000.00")));

        assertThat(response.month()).isEqualTo("2026-08");
        verifySaved(captor);
        assertThat(captor.getValue().getMonth()).isEqualTo(AUG_1);
        assertThat(captor.getValue().getStartingIncoming()).isEqualByComparingTo("25000.00");
    }

    @Test
    void startMonth_duplicate_throwsConflict() {
        when(idealMonthRepository.existsByUserIdAndMonth(USER_ID, AUG_1)).thenReturn(true);

        assertThatThrownBy(() ->
                idealService.startMonth(USER_ID, new StartIdealMonthRequest("2026-08", BigDecimal.TEN)))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("already been started");
    }

    @Test
    void addTransaction_withoutStartedMonth_throwsWithPrompt() {
        when(idealMonthRepository.findByUserIdAndMonth(USER_ID, AUG_1)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                idealService.addTransaction(USER_ID, request(IdealTxnType.OUTGOING, "300", "2026-08-15")))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("2026-08")
                .hasMessageContaining("Start the month first");
    }

    @Test
    void addTransaction_actualOnlyCategory_rejected() {
        stubMonthExists(AUG_1);
        CategoryEntity salary = category("Salary", CategoryScope.ACTUAL);
        when(categoryRepository.findByUserIdAndId(USER_ID, salary.getId())).thenReturn(Optional.of(salary));

        IdealTransactionRequest request = new IdealTransactionRequest(
                IdealTxnType.INCOMING, new BigDecimal("50000"), salary.getId(), null,
                null, LocalDate.of(2026, 8, 5), null);

        assertThatThrownBy(() -> idealService.addTransaction(USER_ID, request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("not available in the Ideal system");
    }

    @Test
    void addTransaction_subcategoryFromOtherCategory_rejected() {
        stubMonthExists(AUG_1);
        CategoryEntity food = category("Food", CategoryScope.BOTH);
        CategoryEntity travel = category("Travel", CategoryScope.BOTH);
        SubcategoryEntity airportTaxi = subcategory("Airport Taxi", travel);
        when(categoryRepository.findByUserIdAndId(USER_ID, food.getId())).thenReturn(Optional.of(food));
        when(subcategoryRepository.findByIdAndCategoryUserId(airportTaxi.getId(), USER_ID))
                .thenReturn(Optional.of(airportTaxi));

        IdealTransactionRequest request = new IdealTransactionRequest(
                IdealTxnType.OUTGOING, new BigDecimal("450"), food.getId(), airportTaxi.getId(),
                "Lunch", LocalDate.of(2026, 8, 15), null);

        assertThatThrownBy(() -> idealService.addTransaction(USER_ID, request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("does not belong");
    }

    @Test
    void summary_overBudgetMath_isExact() {
        when(idealMonthRepository.findByUserIdAndMonth(USER_ID, AUG_1))
                .thenReturn(Optional.of(month(new BigDecimal("10000"))));
        when(idealTransactionRepository.sumTotalsByTypeBetween(USER_ID, AUG_1, LocalDate.of(2026, 8, 31)))
                .thenReturn(List.of(
                        totals(IdealTxnType.INCOMING, "12000"),
                        totals(IdealTxnType.OUTGOING, "23000")));

        IdealSummaryResponse summary = idealService.summary(USER_ID, "2026-08");

        assertThat(summary.totalIncoming()).isEqualByComparingTo("22000");
        assertThat(summary.additionalIncoming()).isEqualByComparingTo("12000");
        assertThat(summary.startingIncoming()).isEqualByComparingTo("10000");
        assertThat(summary.totalOutgoing()).isEqualByComparingTo("23000");
        assertThat(summary.budgetRemaining()).isEqualByComparingTo("-1000");
        assertThat(summary.overBudget()).isTrue();
        assertThat(summary.overBudgetAmount()).isEqualByComparingTo("1000");
        assertThat(summary.utilizationPercent()).isEqualByComparingTo("104.5");
    }

    @Test
    void summary_zeroIncoming_utilizationIsNull_notCrash() {
        when(idealMonthRepository.findByUserIdAndMonth(USER_ID, AUG_1)).thenReturn(Optional.empty());
        when(idealTransactionRepository.sumTotalsByTypeBetween(USER_ID, AUG_1, LocalDate.of(2026, 8, 31)))
                .thenReturn(List.of());

        IdealSummaryResponse summary = idealService.summary(USER_ID, "2026-08");

        assertThat(summary.monthStarted()).isFalse();
        assertThat(summary.budgetRemaining()).isEqualByComparingTo("0");
        assertThat(summary.overBudget()).isFalse();
        assertThat(summary.utilizationPercent()).isNull();
    }

    @Test
    void updateTransaction_movingAcrossMonths_requiresTargetMonth() {
        UUID txnId = UUID.randomUUID();
        when(idealTransactionRepository.findByUserIdAndId(USER_ID, txnId))
                .thenReturn(Optional.of(new com.soham.expencetracker.entity.IdealTransactionEntity()));
        when(idealMonthRepository.findByUserIdAndMonth(USER_ID, LocalDate.of(2026, 9, 1)))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                idealService.updateTransaction(USER_ID, txnId,
                        request(IdealTxnType.OUTGOING, "100", "2026-09-05")))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("No Ideal month started for 2026-09");
    }

    private IdealTransactionRequest request(IdealTxnType type, String amount, String date) {
        return new IdealTransactionRequest(
                type, new BigDecimal(amount), null, null, null, LocalDate.parse(date), null);
    }

    private void stubMonthExists(LocalDate firstOfMonth) {
        when(idealMonthRepository.findByUserIdAndMonth(USER_ID, firstOfMonth))
                .thenReturn(Optional.of(month(BigDecimal.ZERO)));
    }

    private IdealMonthEntity month(BigDecimal startingIncoming) {
        IdealMonthEntity entity = new IdealMonthEntity();
        entity.setId(UUID.randomUUID());
        entity.setMonth(AUG_1);
        entity.setStartingIncoming(startingIncoming);
        return entity;
    }

    private CategoryEntity category(String name, CategoryScope scope) {
        CategoryEntity entity = new CategoryEntity();
        entity.setId(UUID.randomUUID());
        entity.setName(name);
        entity.setScope(scope);
        return entity;
    }

    private SubcategoryEntity subcategory(String name, CategoryEntity category) {
        SubcategoryEntity entity = new SubcategoryEntity();
        entity.setId(UUID.randomUUID());
        entity.setName(name);
        entity.setCategory(category);
        return entity;
    }

    private static IdealTransactionRepository.TypeTotal totals(IdealTxnType type, String total) {
        return new IdealTransactionRepository.TypeTotal() {
            @Override
            public IdealTxnType getType() {
                return type;
            }

            @Override
            public BigDecimal getTotal() {
                return new BigDecimal(total);
            }
        };
    }

    private void verifySaved(ArgumentCaptor<IdealMonthEntity> captor) {
        org.mockito.Mockito.verify(idealMonthRepository).save(captor.capture());
    }
}
