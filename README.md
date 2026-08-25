# Expense-Tracker

A personal finance platform built around **three deliberately independent financial systems**: Ideal (planning), Actual (real money movement), and Splits (interpersonal obligations). The systems can be viewed together on the dashboard and compared analytically, but no system silently overwrites, validates, or infers records in another.

## The Three-Domain Model

| System | Answers | Independence |
|---|---|---|
| 🎯 **Ideal** | What have I planned or assigned for myself? | User-defined values — never reconciled against Actual |
| 💳 **Actual** | What actually came in or went out? | Real movement only; transfers are neither income nor expense |
| 🤝 **Splits** | Who owes whom? | Private per-account ledger; settlements never auto-create Actual records |

**Golden rules** (enforced in code, not just documented):

- Budget Remaining = Total Ideal Incoming − Ideal Outgoing. A negative value is shown as *Over Budget*, never as a bank loss.
- Recording a split settlement does **not** create an Actual transaction unless explicitly linked.
- Settlements are recorded as stated — they may overpay and flip a pair's balance.
- Ideal-vs-Actual comparison uses neutral wording ("Actual outflow was ₹X higher than your Ideal entries") — the app never claims you "overspent".
- Recurring templates never auto-post; a real entry is created only on explicit confirmation.

## Tech Stack

**Backend** (this repo): Java 21 · Spring Boot 4.1 (Web MVC, Security, Data JPA/Hibernate 7, Validation, Flyway) · PostgreSQL 18 · JJWT 0.12.6 (HS256) · Lombok · JUnit 5 + Mockito

**Planned frontend**: Next.js + React + TypeScript + Tailwind CSS + Redux Toolkit/RTK Query + Recharts (not started yet).

## Project Structure

```
Backend/expence-tracker/expence-tracker/
├── src/main/java/com/soham/expencetracker/
│   ├── config/        # Security filter chain, CORS
│   ├── security/      # JWT issue/verify, auth filter, principal
│   ├── controller/    # REST endpoints (auth, categories, ideal, actual,
│   │                  # splits, reports, dashboard, comparison, recurring)
│   ├── dto/           # Request/response contracts (Jakarta Validation)
│   ├── entity/        # JPA domain mapping (PG native enums via NAMED_ENUM)
│   ├── repository/    # Spring Data JPA
│   ├── service/       # Business rules, split algorithms, balance derivation
│   ├── report/        # Domain-owned weekly/monthly report engines (§14–§20)
│   └── exception/     # Centralized REST error envelope
└── src/main/resources/
    ├── application.properties          # Placeholders only — safe to commit
    ├── application.properties.example  # Template for local secrets
    └── db/migration/V1__initial_schema.sql
```

## Getting Started

**Prerequisites**: Java 21+ · PostgreSQL 14+ (18 tested) · Maven wrapper included

1. **Configure secrets** (never commit them):

   ```powershell
   cd Backend/expence-tracker/expence-tracker/src/main/resources
   Copy-Item application.properties.example application-local.properties
   # then edit application-local.properties with real values
   ```

   `application-local.properties` is git-ignored. Values can also come from plain environment variables (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`).

2. **Create the database**:

   ```sql
   CREATE DATABASE expense_tracker;
   ```

   Flyway applies `V1__initial_schema.sql` automatically on first boot (14 tables, 9 PG enums, settlement ledger view).

3. **Run**:

   ```powershell
   .\mvnw.cmd spring-boot:run
   ```

4. **Test**:

   ```powershell
   .\mvnw.cmd test
   ```

On first registration the app seeds default categories (Food/Travel/Shopping/Bills/Entertainment/Other), the user's self `Person` record, and is ready for all three systems immediately.

## API Surface

All endpoints are JWT-protected (except register/login) and strictly user-scoped at the service layer.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` |
| Categories | CRUD `/api/categories`, reorder, nested subcategories, `/api/subcategories/{id}` |
| 🎯 Ideal | `/api/ideal/months` (start/list/update) · `/api/ideal/transactions` CRUD · `/api/ideal/summary?month=` |
| 💳 Actual | `/api/actual/accounts` CRUD · `/api/actual/transactions` CRUD (INCOMING/OUTGOING/TRANSFER) |
| 🤝 Splits | `/api/splits/people` · `/api/splits/groups` (+members) · `/api/splits/expenses` (EQUAL/EXACT/PERCENTAGE/SHARE) · `/api/splits/settlements` · `/api/splits/balances` |
| Reports | `GET /api/reports/{ideal\|actual\|splits}/{weekly\|monthly}?ref=` — six domain-owned engines |
| Dashboard | `GET /api/dashboard?month=` — three-system snapshot + recents + empty-state hints |
| Comparison | `GET /api/comparison?month=` — neutral Ideal-vs-Actual rows |
| Recurring | `/api/recurring` CRUD · `GET /prepare?month=` · `POST /{id}/confirm` |

Error responses use a consistent envelope: `{status, message, timestamp, fieldErrors?}`.

## Notable Engineering Details

- **Split math**: cent remainders distributed by largest-remainder method; ledger derived at read time via greedy largest-debtor→largest-creditor pairing over `net = paid − share` (§7.6).
- **Balances**: pairwise signed debt matrix; settlements subtract as stated and may flip a pair's direction.
- **Reports**: derived at query time only; projections never mutate records; highest/lowest-day and most-frequent ties broken alphabetically (§15).
- **Partial-data rule**: account balances are computed only where starting balances are configured; responses flag `allStartingBalancesConfigured` otherwise (§6.6).
- **Hibernate 7 + PG enums**: enums mapped with `@JdbcTypeCode(NAMED_ENUM)`; enum values are always bound as query **parameters** — HQL enum literals render a wrong type name on PostgreSQL.
- **Recency queries** use `txn_date DESC, created_at DESC, id DESC` — UUIDs don't correlate with insertion order.

## Verification

- 71 unit tests (algorithms, guards, money math, tie-breaks, zero-safety)
- Every domain exercised end-to-end against a real PostgreSQL 18 instance (auth flows, budget math incl. over-budget, transfer shape rules, split/settlement lifecycle, all six report engines numerically verified)

## Roadmap

- [x] Schema, auth, categories, Ideal, Actual, Splits, Reports, Dashboard, Comparison, Recurring
- [ ] Next.js frontend (planned)
- [ ] Docker packaging & deployment (Vercel / Render / managed PostgreSQL)

## Security

Secrets live only in git-ignored files or environment variables. `application.properties` contains placeholders exclusively. `.gitignore` blocks `.env*`, `application-local.properties`, build outputs, and IDE folders.
