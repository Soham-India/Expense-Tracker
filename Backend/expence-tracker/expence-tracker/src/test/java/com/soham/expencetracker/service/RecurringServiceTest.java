package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.ConfirmRecurringRequest;
import com.soham.expencetracker.dto.CreateRecurringRequest;
import com.soham.expencetracker.dto.IdealMonthResponse;
import com.soham.expencetracker.dto.PrepareRecurringResponse;
import com.soham.expencetracker.entity.AccountEntity;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.CategoryScope;
import com.soham.expencetracker.entity.RecurringDomain;
import com.soham.expencetracker.entity.RecurringEntryEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidRequestException;
import com.soham.expencetracker.repository.AccountRepository;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.RecurringEntryRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecurringServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private RecurringEntryRepository recurringEntryRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private SubcategoryRepository subcategoryRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private IdealService idealService;
    @Mock
    private ActualService actualService;

    @InjectMocks
    private RecurringService recurringService;

    @Test
    void create_idealTemplateWithAccount_rejected() {
        assertThatThrownBy(() -> recurringService.create(USER_ID,
                new CreateRecurringRequest(RecurringDomain.IDEAL, "OUTGOING", new BigDecimal("8000"),
                        null, null, UUID.randomUUID(), "Rent", 1)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("cannot reference an account");
    }

    @Test
    void create_transferType_rejected() {
        assertThatThrownBy(() -> recurringService.create(USER_ID,
                new CreateRecurringRequest(RecurringDomain.ACTUAL, "TRANSFER", new BigDecimal("100"),
                        null, null, null, "Savings sweep", 5)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("INCOMING or OUTGOING only");
    }

    @Test
    void create_scopeMismatch_rejected() {
        CategoryEntity idealOnly = new CategoryEntity();
        idealOnly.setId(UUID.randomUUID());
        idealOnly.setName("Wishlist");
        idealOnly.setScope(CategoryScope.IDEAL);
        when(categoryRepository.findByUserIdAndId(USER_ID, idealOnly.getId()))
                .thenReturn(Optional.of(idealOnly));
        when(userRepository.getReferenceById(USER_ID)).thenReturn(new com.soham.expencetracker.entity.UserEntity());

        assertThatThrownBy(() -> recurringService.create(USER_ID,
                new CreateRecurringRequest(RecurringDomain.ACTUAL, "OUTGOING", new BigDecimal("900"),
                        idealOnly.getId(), null, null, "Wishlist top-up", 10)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("not available in the ACTUAL system");
    }

    @Test
    void confirm_secondTimeSameMonth_throwsConflict() {
        RecurringEntryEntity template = template(RecurringDomain.ACTUAL, "OUTGOING");
        template.setLastConfirmedMonth(LocalDate.of(2026, 8, 1));
        when(recurringEntryRepository.findByUserIdAndId(USER_ID, template.getId()))
                .thenReturn(Optional.of(template));

        assertThatThrownBy(() -> recurringService.confirm(USER_ID, template.getId(),
                new ConfirmRecurringRequest("2026-08")))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("already confirmed");
    }

    @Test
    void confirm_pausedTemplate_rejected() {
        RecurringEntryEntity template = template(RecurringDomain.ACTUAL, "OUTGOING");
        template.setActive(false);
        when(recurringEntryRepository.findByUserIdAndId(USER_ID, template.getId()))
                .thenReturn(Optional.of(template));

        assertThatThrownBy(() -> recurringService.confirm(USER_ID, template.getId(),
                new ConfirmRecurringRequest("2026-08")))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("paused");
    }

    @Test
    void confirm_idealTemplate_delegatesToIdealService_withClampedDate() {
        RecurringEntryEntity template = template(RecurringDomain.IDEAL, "OUTGOING");
        template.setDayOfMonth((short) 31);
        when(recurringEntryRepository.findByUserIdAndId(USER_ID, template.getId()))
                .thenReturn(Optional.of(template));

        recurringService.confirm(USER_ID, template.getId(), new ConfirmRecurringRequest("2026-02"));

        verify(idealService).addTransaction(org.mockito.ArgumentMatchers.eq(USER_ID),
                org.mockito.ArgumentMatchers.argThat(req ->
                        req.date().equals(LocalDate.of(2026, 2, 28))
                                && req.amount().compareTo(new BigDecimal("8000")) == 0
                                && req.type() == com.soham.expencetracker.entity.IdealTxnType.OUTGOING));
        assertThat(template.getLastConfirmedMonth()).isEqualTo(LocalDate.of(2026, 2, 1));
    }

    @Test
    void prepare_clampsDay_andFlagsMissingIdealMonth() {
        RecurringEntryEntity idealTemplate = template(RecurringDomain.IDEAL, "OUTGOING");
        idealTemplate.setDayOfMonth((short) 31);
        when(recurringEntryRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(idealTemplate));
        when(idealService.listMonths(USER_ID)).thenReturn(List.of());

        PrepareRecurringResponse response = recurringService.prepare(USER_ID, "2026-02");

        assertThat(response.templates()).hasSize(1);
        var prepared = response.templates().get(0);
        assertThat(prepared.targetDate()).isEqualTo(LocalDate.of(2026, 2, 28));
        assertThat(prepared.alreadyConfirmed()).isFalse();
        assertThat(prepared.blockReason()).isEqualTo("Start the Ideal month first");
    }

    private RecurringEntryEntity template(RecurringDomain domain, String type) {
        RecurringEntryEntity entity = new RecurringEntryEntity();
        entity.setId(UUID.randomUUID());
        entity.setDomain(domain);
        entity.setType(type);
        entity.setAmount(new BigDecimal("8000"));
        entity.setDescription("Rent");
        entity.setDayOfMonth((short) 1);
        entity.setActive(true);
        return entity;
    }
}
