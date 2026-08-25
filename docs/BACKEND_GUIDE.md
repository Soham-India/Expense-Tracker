# Backend Internals Guide (for agents)

**Audience:** an agent about to **modify or extend** the backend. Read this + the specific files you're touching — that replaces a full codebase walkthrough.
**For API contracts** (request/response shapes), read `docs/FRONTEND_HANDOFF.md` instead — not duplicated here.
**Current state:** complete and verified — 72 unit tests green, 57-check live E2E passed (commit `db5b881` + docs).

---

## 1. Identity & Toolchain

| Fact | Value |
|---|---|
| Code root | `Backend/expence-tracker/expence-tracker/` |
| Java | 21 target (JDK 25 runtime works) |
| Framework | Spring Boot **4.1.1** (Framework 7, Hibernate 7.4, Jakarta EE 11) |
| Database | PostgreSQL (18 tested); Flyway owns schema |
| Auth | Spring Security + JJWT 0.12.6 (HS256) |
| Build | `.\mvnw.cmd` wrapper |

**Commands** (from the code root):
```powershell
.\mvnw.cmd spring-boot:run          # boot (needs DB_URL/DB_USER/DB_PASSWORD/JWT_SECRET — see §8)
.\mvnw.cmd test                     # 72 unit tests, no Docker needed
.\mvnw.cmd -DskipTests package      # fat jar in target\
```

**Boot 4 starter naming (differs from Boot 3 tutorials):** `spring-boot-starter-webmvc` (not `-web`), `spring-boot-starter-flyway`, `spring-boot-starter-jackson` (JSON is **not** bundled with the web starter), test starters like `spring-boot-starter-webmvc-test`, plus the classic `spring-boot-starter-test` (added manually for JUnit/Mockito/AssertJ).

---

## 2. Request Lifecycle

```
JwtAuthFilter (OncePerRequestFilter)
  └─ Bearer token → JwtService.parseToken → AuthenticatedUser(id, email) into SecurityContext
  └─ invalid/expired token → context cleared → SecurityConfig entry point → 401 JSON
Controller  (@AuthenticationPrincipal AuthenticatedUser principal)
  └─ @Valid DTO → Service (ALL queries take principal.id() — never trust a client userId)
     └─ Repository (Spring Data JPA, user-scoped derived queries / @Query)
        └─ throws ApiException family → GlobalExceptionHandler → ErrorResponse envelope
```

- **SecurityConfig** (`config/`): stateless, CSRF off, CORS from `app.cors.allowed-origins`, `permitAll` only for `POST /api/auth/register` + `POST /api/auth/login`; everything else `authenticated()`. 401/403 JSON written directly by the entry point / denied handler.
- **Error envelope** (every failure): `{ status, message, timestamp, fieldErrors? }` — `fieldErrors` only on 400 validation.
- **Exception family** (`exception/`): `ApiException(HttpStatus, message)` base → `DuplicateResourceException` 409 · `ResourceNotFoundException` 404 · `InvalidCredentialsException` 401 · `InvalidRequestException` 400 · `ResourceInUseException` 409. `GlobalExceptionHandler` also maps: bean validation → 400 + fieldErrors · `DataIntegrityViolationException` → 409 · `AccessDenied` → 403 · `NoResourceFound` → 404 · `HttpRequestMethodNotSupported` → 405 · anything else → 500 with a generic message (stack logged, never leaked).

---

## 3. Domain & Entity Map

Three structurally independent systems + one shared classification. **No cross-domain FKs** except the optional explicit `settlements.actual_transaction_id` (ON DELETE SET NULL).

| Package `entity/` | Table | Notes |
|---|---|---|
| `UserEntity` | users | Auth root; email stored lowercase |
| `CategoryEntity` / `SubcategoryEntity` | categories / subcategories | Shared classification; `scope` = IDEAL / ACTUAL / BOTH; `hidden` flag; `sortOrder` |
| `IdealMonthEntity`, `IdealTransactionEntity` (`IdealTxnType`) | ideal_months / ideal_transactions | Month row = `month` DATE always the 1st; txns require the month |
| `AccountEntity` (`AccountType`), `ActualTransactionEntity` (`ActualTxnType`, `PaymentMethod`) | accounts / actual_transactions | `startingBalance` **nullable** = "not configured"; TRANSFER = `account_id` + `transfer_to_account_id`, never a category |
| `PersonEntity` | people | `is_self` row per user (partial unique index); `archived` instead of delete |
| `SplitGroupEntity` (`SplitGroupStatus`), `GroupMemberEntity` | split_groups / group_members | Explicit rosters |
| `SplitExpenseEntity` (`SplitMethod`), `SplitParticipantEntity` | split_expenses / split_participants | Server computes canonical `shareAmount`; participants CASCADE from their expense (the only cascade in the schema) |
| `SettlementEntity` | settlements | Recorded **as stated** — no balance validation; optional explicit Actual link |
| `RecurringEntryEntity` (`RecurringDomain`) | recurring_entries | `type` is a **String** column, validated per domain in `RecurringService`; `lastConfirmedMonth` drives the prepare/confirm state machine |

---

## 4. Non-Negotiable Conventions

Breaking any of these has already caused real bugs — don't reintroduce them.

1. **Flyway owns the schema.** `spring.jpa.hibernate.ddl-auto=validate` — Hibernate only checks mappings. Schema changes happen **only** via a new `V(n)__*.sql` migration; never edit an applied migration.
2. **Money = `NUMERIC(14,2)` ↔ `BigDecimal`.** Always `@Column(precision = 14, scale = 2)`. Never `double`/`float`. Compare with `compareTo` / AssertJ `isEqualByComparingTo` (scale-safe), never `equals`.
3. **PG native enums:** `@Enumerated(EnumType.STRING)` + `@JdbcTypeCode(SqlTypes.NAMED_ENUM)`, enum class name/values matching the migration's `CREATE TYPE` exactly.
4. **Enum values in queries are ALWAYS parameters.** An HQL enum literal (`... where t.type = com.x.Foo.BAR`) makes Hibernate render a wrong PG type name (`actualtxntype` ≠ `actual_txn_type`) → runtime SQL error. Bind `:param` instead (see `ActualTransactionRepository.totalInflowForAccount`).
5. **Ownership scoping:** every repository read/write takes the principal's `userId` (`findByUserIdAndId(userId, id)` pattern). A query that isn't user-scoped is a security bug.
6. **Delete policy:** FKs are RESTRICT; people/groups/categories/accounts use archive flags. Delete endpoints load the owned row, then `try { delete; flush(); } catch (DataIntegrityViolationException) → ResourceInUseException("...hide/archive instead")`. Sole cascade: `split_participants` from their expense.
7. **Financial date ≠ audit date:** `txn_date` / `expense_date` / `settlement_date` are user-meaningful; `created_at`/`updated_at` are audit (`@PrePersist`/`@PreUpdate`).
8. **Recency = `created_at DESC`**, never `id DESC` — UUIDv4 order is random. Top-N queries: `TxnDateDescCreatedAtDescIdDesc` (id only as determinism tiebreak).
9. **Derived, not stored:** split ledger, balances, and every report number are computed at read time. Never persist an aggregate.
10. **Independence:** Ideal/Actual/Splits never read or validate each other (the comparison and dashboard *services* compose them read-only — that's allowed; cross-writes are not).

---

## 5. Algorithm Notes

**`service/SplitAlgorithms`** — static and pure; tested directly.
- **Share distribution:** floor every exact share to cents, then hand out leftover cents by largest fractional remainder (ties → participant order in the request). `EXACT` validates Σ = total; `PERCENTAGE` validates Σ = exactly 100.
- **`greedyPairing(nets)`**: `net = paid − share` per participant → repeatedly match largest debtor against largest creditor → immutable `LedgerEntry(debtorId, creditorId, amount)` list.

**Balance derivation** (`SplitService.balances`): pairwise matrix `debt[a][b]` = amount a owes b. Ledger entries **add**; settlements **subtract** (`debt[from][to] -= amount`) — recorded as stated, so overpays legitimately flip a pair. `netOwes(a,b) = debt[a][b] − debt[b][a]`; `youOwe = Σ max(net(self,P), 0)`.

**Report math** (`report/ReportMath` — static, pure): `pct` returns **null** on zero/negative denominator (render "N/A"); tie-breaks are **alphabetical by name** — note `maxByAmountThenName` uses `thenComparing(name, reverseOrder())` so the alphabetically *first* name wins on ties in both directions; `burnVerdict` thresholds at ±5pp; `projectMonthEnd` = avg daily × month days (analysis only, never mutates); `weekBuckets` = Monday-start clipped to month.

**Ideal summary** (`IdealService.summary`): `totalIncoming = startingIncoming + Σ(INCOMING txns)`; `budgetRemaining = totalIncoming − outgoing`; `utilizationPercent = null` when totalIncoming = 0 (render "N/A").

---

## 6. Gotchas (learned the hard way — all fixed, don't regress)

1. **Jackson 3, not 2.** Boot 4 auto-configures `tools.jackson.databind.ObjectMapper`. Importing `com.fasterxml.jackson...` fails to compile / misleads. (Only JJWT's internal Jackson 2 remains, runtime-scoped.)
2. **HQL enum literals** → wrong PG type name (see convention #4).
3. **`YearMonth.equals(LocalDate)` is always false** — compare `YearMonth.from(localDate).equals(ym)`. Bit the double-confirm detection once.
4. **`SMALLINT` columns need `Short` fields** under `validate` (an `int` field validates against INTEGER and fails). See `RecurringEntryEntity.dayOfMonth`.
5. **Registration transaction** creates user + self Person (`is_self=true`) + seeded default categories — the partial unique index `uq_people_one_self_per_user` enforces exactly one self row.
6. **JWT secret < 32 bytes** → `WeakKeyException` at startup. Fail-fast by design; generate 64+ chars.
7. **"Using generated security password"** in the log is harmless noise — there is intentionally no `UserDetailsService`; auth is the JWT filter.
8. **`spring-boot-devtools`** is on the classpath for dev but excluded from the fat jar — don't rely on it in packaged runs.

---

## 7. Cookbook — Common Tasks

### Add a column
1. New migration `V(n)__describe_change.sql` (`ALTER TABLE ...`). Never touch `V1`.
2. Entity field with the correct mapping (BigDecimal + precision/scale, enum + NAMED_ENUM, `Short` for SMALLINT, `LocalDate` for DATE).
3. Extend request/response DTOs + service mapping.
4. `mvnw test` — `validate` mode fails fast if entity and column disagree.

### Add an endpoint
1. DTO record(s) in `dto/` with Jakarta Validation annotations (shape rules).
2. Service method: `@Transactional` (or `readOnly = true`), first line resolves ownership, semantic rules throw the `ApiException` family.
3. Controller method in the matching controller; `@ResponseStatus` for 201/204.
4. Service unit test (see below). Only touch `GlobalExceptionHandler` if you introduced a genuinely new error class.

### Add a report section
1. Extend the report record (nested records live inside the report file).
2. Compute in the report service from an already-fetched date range — prefer in-memory aggregation over new SQL; use `ReportMath` helpers for percentages, tie-breaks, zero-safety.
3. User-facing sentences → `keyInsights` (neutral wording, §21/§31: never "overspent", projections labeled).

### Add a validation rule
Shape → DTO annotation. Semantics (ownership, scope, cross-field) → service, throwing `InvalidRequestException` (400).

### Write the matching unit test
- Pure math (`SplitAlgorithms`, `ReportMath`): direct JUnit + AssertJ, no mocks.
- Services: `@ExtendWith(MockitoExtension.class)`, `@Mock` repositories, `@InjectMocks` service. Stub with **exact** argument values the service will pass (case-sensitive strings, argument order — mismatches are the #1 flaky-test cause). Verify interactions when the behavior *is* the interaction (seeding, guards, delegation).
- Money assertions: `isEqualByComparingTo`; BigDecimal **collections**: `extracting(BigDecimal::toPlainString).containsExactly(...)` (avoids scale-sensitivity false failures).
- Always cover: zero-denominator paths, guard exceptions (right type **and** message fragment), and one exact-numbers happy path.

### Live smoke test (ephemeral, not committed)
Throwaway `postgres:18` container + packaged jar + a PowerShell `Invoke-RestMethod` script run **atomically** (boot → poll → exercise → `finally` cleanup). Print actual vs expected on every check; never `| Out-Null` a seed POST — assert it.

---

## 8. Config & Secrets

- `application.properties` (committed): **placeholders only** — `${DB_URL}`, `${DB_USER}`, `${DB_PASSWORD}`, `${JWT_SECRET}`, `${CORS_ORIGINS}`, `${JWT_EXPIRATION_MS:86400000}`, profile default `local`.
- `application-local.properties` (git-ignored, auto-loaded): real values. Environment variables of the same names override it.
- **Never** commit real credentials or JWT secrets. `.gitignore` blocks `.env*`, `application-local.properties`, `target/`, `.idea/`.
- Required to boot: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (≥ 64 chars). The database itself must pre-exist (`CREATE DATABASE expense_tracker;`) — Flyway creates tables, not the DB.

---

## 9. Pointers

- `docs/FRONTEND_HANDOFF.md` — exhaustive API contract (don't re-derive shapes from DTOs when this has them).
- `README.md` — setup, stack, API surface summary.
- `docs/ROADMAP.md` — planned features; check before proposing something that's already scoped.
- Commit style: short imperative (`add x`, `implement y`, `fix z`).
