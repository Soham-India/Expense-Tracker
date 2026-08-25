-- =====================================================================
-- Personal Finance & Expense Tracker — Initial Schema
-- Flyway migration V1
-- Domains: Ideal / Actual / Splits (kept structurally independent
-- per Golden Product Rules — no domain has a required FK into another)
--
-- Additions over the drafted schema (agreed during planning):
--   * payment_method enum + nullable column on actual_transactions
--     (required by PRD §13.2 Quick Add, §17 weekly, §18 monthly)
--   * group_members join table (explicit group rosters, PRD §7.3/§20)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
CREATE TYPE category_scope        AS ENUM ('IDEAL', 'ACTUAL', 'BOTH');
CREATE TYPE ideal_txn_type        AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE actual_txn_type       AS ENUM ('INCOMING', 'OUTGOING', 'TRANSFER');
CREATE TYPE account_type          AS ENUM ('BANK', 'CASH', 'UPI', 'CARD', 'OTHER');
CREATE TYPE payment_method        AS ENUM ('UPI', 'CASH', 'CARD', 'NETBANKING', 'OTHER');
CREATE TYPE split_group_status    AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE split_method          AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARE');
CREATE TYPE ledger_source_type    AS ENUM ('SPLIT_EXPENSE', 'SETTLEMENT');
CREATE TYPE recurring_domain      AS ENUM ('IDEAL', 'ACTUAL');

-- =====================================================================
-- USERS
-- =====================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(120) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- CATEGORIES / SUBCATEGORIES  (shared classification, §9)
-- =====================================================================
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name            VARCHAR(80) NOT NULL,
    scope           category_scope NOT NULL DEFAULT 'BOTH', -- available in Ideal, Actual, or both (§9)
    is_hidden       BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);
CREATE INDEX idx_categories_user ON categories(user_id);

CREATE TABLE subcategories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name            VARCHAR(80) NOT NULL,
    is_hidden       BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, name)
);
CREATE INDEX idx_subcategories_category ON subcategories(category_id);

-- =====================================================================
-- 🎯 IDEAL DOMAIN (§5, §23)
-- =====================================================================
CREATE TABLE ideal_months (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    month                   DATE NOT NULL, -- always stored as the 1st of the month
    starting_incoming       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (starting_incoming >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, month)
);
CREATE INDEX idx_ideal_months_user ON ideal_months(user_id, month);

CREATE TABLE ideal_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    month_id            UUID NOT NULL REFERENCES ideal_months(id) ON DELETE RESTRICT,
    type                ideal_txn_type NOT NULL,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0), -- user-defined, no reconciliation (§5.2)
    category_id         UUID REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id      UUID REFERENCES subcategories(id) ON DELETE RESTRICT,
    description         VARCHAR(255),
    txn_date            DATE NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    -- Deliberately NO actual_transaction_id column — Ideal must remain
    -- independent from Actual (§23 closing note).
);
CREATE INDEX idx_ideal_txn_user_date   ON ideal_transactions(user_id, txn_date);
CREATE INDEX idx_ideal_txn_month       ON ideal_transactions(month_id);
CREATE INDEX idx_ideal_txn_category    ON ideal_transactions(category_id);

-- =====================================================================
-- 💳 ACTUAL DOMAIN (§6, §24)
-- =====================================================================
CREATE TABLE accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name                VARCHAR(80) NOT NULL,
    account_type        account_type NOT NULL,
    starting_balance    NUMERIC(14,2), -- NULL means "not configured" (§6.6 partial-data rule)
    is_archived         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);
CREATE INDEX idx_accounts_user ON accounts(user_id);

CREATE TABLE actual_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type                    actual_txn_type NOT NULL,
    amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    category_id             UUID REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id          UUID REFERENCES subcategories(id) ON DELETE RESTRICT,
    account_id              UUID REFERENCES accounts(id) ON DELETE RESTRICT, -- source account
    transfer_to_account_id  UUID REFERENCES accounts(id) ON DELETE RESTRICT, -- only for TRANSFER (§6.5)
    payment_method          payment_method, -- optional (§13.2); breakdowns in §17/§18 reports
    description             VARCHAR(255),
    txn_date                DATE NOT NULL,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Deliberately NO ideal_transaction_id column — Actual is completely
    -- independent from Ideal (§24 closing note).
    CONSTRAINT chk_transfer_shape CHECK (
        (type = 'TRANSFER' AND account_id IS NOT NULL
                            AND transfer_to_account_id IS NOT NULL
                            AND account_id <> transfer_to_account_id)
        OR
        (type <> 'TRANSFER' AND transfer_to_account_id IS NULL)
    )
);
CREATE INDEX idx_actual_txn_user_date  ON actual_transactions(user_id, txn_date);
CREATE INDEX idx_actual_txn_account    ON actual_transactions(account_id);
CREATE INDEX idx_actual_txn_category   ON actual_transactions(category_id);

-- =====================================================================
-- 🤝 SPLITS DOMAIN (§7, §25)
-- =====================================================================

-- "people" holds every party in a user's Splits world, including the
-- user themself (is_self = true), so split_participants and
-- settlements can reference all parties uniformly.
CREATE TABLE people (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name            VARCHAR(120) NOT NULL,
    contact_info    VARCHAR(255),
    is_self         BOOLEAN NOT NULL DEFAULT false,
    is_archived     BOOLEAN NOT NULL DEFAULT false, -- archive instead of delete (§26)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_people_user ON people(user_id);
-- exactly one self-row per user
CREATE UNIQUE INDEX uq_people_one_self_per_user ON people(user_id) WHERE is_self;

CREATE TABLE split_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name            VARCHAR(120) NOT NULL,
    description     VARCHAR(255),
    status          split_group_status NOT NULL DEFAULT 'ACTIVE', -- archive instead of delete (§26)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_split_groups_user ON split_groups(user_id);

-- Explicit group rosters (PRD §7.3): members are defined independently of
-- expenses; the §20 Group Breakdown report joins this table.
CREATE TABLE group_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    group_id    UUID NOT NULL REFERENCES split_groups(id) ON DELETE RESTRICT,
    person_id   UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, person_id)
);
CREATE INDEX idx_group_members_user   ON group_members(user_id);
CREATE INDEX idx_group_members_person ON group_members(person_id);

CREATE TABLE split_expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    group_id        UUID REFERENCES split_groups(id) ON DELETE RESTRICT, -- optional (§7.4)
    created_by      UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    total_amount    NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
    split_method    split_method NOT NULL,
    description     VARCHAR(255),
    expense_date    DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_split_expenses_user_date ON split_expenses(user_id, expense_date);
CREATE INDEX idx_split_expenses_group     ON split_expenses(group_id);

CREATE TABLE split_participants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    split_expense_id    UUID NOT NULL REFERENCES split_expenses(id) ON DELETE CASCADE, -- child rows of the expense itself, not independent history
    person_id           UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    share_amount        NUMERIC(14,2) NOT NULL CHECK (share_amount >= 0), -- what they owe for this expense
    paid_amount         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0), -- what they actually paid
    split_percentage    NUMERIC(6,3),  -- populated when split_method = PERCENTAGE
    split_units         NUMERIC(10,3), -- populated when split_method = SHARE
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (split_expense_id, person_id)
);
CREATE INDEX idx_split_participants_expense ON split_participants(split_expense_id);
CREATE INDEX idx_split_participants_person  ON split_participants(person_id);

CREATE TABLE settlements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    from_person_id          UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT, -- debtor
    to_person_id            UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT, -- creditor
    amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    settlement_date         DATE NOT NULL,
    note                    VARCHAR(255),
    actual_transaction_id   UUID REFERENCES actual_transactions(id) ON DELETE SET NULL, -- optional, explicit link only (§7.7)
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_settlement_distinct_parties CHECK (from_person_id <> to_person_id)
    -- Deliberately no CHECK against outstanding balance — settlements
    -- are recorded as stated, even if they overpay (§7.7).
);
CREATE INDEX idx_settlements_user_date ON settlements(user_id, settlement_date);
CREATE INDEX idx_settlements_from      ON settlements(from_person_id);
CREATE INDEX idx_settlements_to        ON settlements(to_person_id);

-- =====================================================================
-- RECURRING ENTRIES (§10) — templates only, never auto-post (§41)
-- =====================================================================
CREATE TABLE recurring_entries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    domain                  recurring_domain NOT NULL,
    type                    VARCHAR(20) NOT NULL, -- validated against ideal_txn_type / actual_txn_type in the service layer per `domain`
    amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    category_id             UUID REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id          UUID REFERENCES subcategories(id) ON DELETE RESTRICT,
    account_id              UUID REFERENCES accounts(id) ON DELETE RESTRICT, -- only relevant when domain = ACTUAL
    description             VARCHAR(255) NOT NULL,
    day_of_month            SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    is_active               BOOLEAN NOT NULL DEFAULT true,
    last_confirmed_month    DATE, -- last month this template was confirmed into a real entry
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_entries_user ON recurring_entries(user_id, domain);

-- =====================================================================
-- SPLIT LEDGER VIEW (§7.6)
-- Settlement-derived ledger rows can be expressed directly in SQL.
-- SplitExpense-derived ledger rows require the greedy debtor/creditor
-- matching algorithm from §7.6, which is NOT expressed here — that
-- pairing logic belongs in the service layer (it's iterative, not
-- set-based) and should write into a `split_ledger_entries` table
-- (or an application-level computed structure) rather than a view.
-- This view covers the SETTLEMENT half only.
-- =====================================================================
CREATE VIEW v_settlement_ledger AS
SELECT
    s.id                AS source_id,
    'SETTLEMENT'::ledger_source_type AS source_type,
    s.from_person_id    AS debtor_person_id,
    s.to_person_id      AS creditor_person_id,
    s.amount,
    s.settlement_date   AS ledger_date
FROM settlements s;

-- =====================================================================
-- Notes for the service layer (not enforced in SQL):
--  * On user registration, insert a `people` row with is_self = true
--    for that user before any Split feature is used.
--  * `recurring_entries.type` is a free-text column validated in code
--    against ideal_txn_type or actual_txn_type based on `domain`,
--    since Postgres enums can't be conditionally shared across two
--    types in one column.
--  * category_id / subcategory_id on ideal_transactions and
--    actual_transactions must additionally be checked in the service
--    layer against `categories.scope` (IDEAL/ACTUAL/BOTH) — not
--    enforceable as a plain FK constraint.
-- =====================================================================
