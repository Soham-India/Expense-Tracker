package com.soham.expencetracker.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Recurring template (§10) — never posts by itself; confirmation always
 * creates the real entry (§41 non-goals).
 */
@Entity
@Table(name = "recurring_entries")
@Getter
@Setter
@NoArgsConstructor
public class RecurringEntryEntity {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private RecurringDomain domain;

    /**
     * VARCHAR(20) in the schema — validated against ideal_txn_type or
     * actual_txn_type in the service layer depending on `domain`
     * (Postgres enums cannot be conditionally shared in one column).
     */
    @Column(nullable = false)
    private String type;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private CategoryEntity category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subcategory_id")
    private SubcategoryEntity subcategory;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private AccountEntity account;

    @Column(nullable = false)
    private String description;

    /** SMALLINT column — Short maps cleanly under ddl-auto=validate. */
    @Column(name = "day_of_month", nullable = false)
    private Short dayOfMonth;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "last_confirmed_month")
    private LocalDate lastConfirmedMonth;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
