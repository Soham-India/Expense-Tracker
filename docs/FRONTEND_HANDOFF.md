# Frontend Handoff — Expense Tracker

**Audience:** the agent/developer building the Next.js frontend.
**Status of backend:** complete, committed, verified (71 unit tests + live E2E on every endpoint family). Nothing on the backend needs to change for the frontend to start.
**Last updated:** 2026-08-25 (backend commit `32c5a1b` + docs).

---

## 1. Product Context

A personal finance platform with **three deliberately independent systems**. The UI must keep them visually and conceptually distinct (different colors/sections), and must never imply one corrects another.

| System | Meaning | Primary screens |
|---|---|---|
| 🎯 **Ideal** | The user's *chosen* planning values | Month setup, incoming/outgoing entries, budget summary |
| 💳 **Actual** | Real money movement | Accounts, transactions, transfers, cash flow |
| 🤝 **Splits** | Obligations between people | People, groups, shared expenses, settlements, balances |

**Golden rules the UI must encode:**

- "Budget Remaining" is an Ideal planning value, **never** presented as a bank balance.
- A negative Budget Remaining displays as **Over Budget**, not a loss.
- A settlement **never** creates an Actual transaction unless the user explicitly links one (the API only links when you pass `actualTransactionId`).
- Ideal-vs-Actual comparison wording is **neutral** — the API supplies the note strings; render them as-is. Never write "you overspent" anywhere.
- Dashboard is a snapshot, not a report. Reports live under each system's own Reports page.
- Recurring templates never auto-post: the flow is **prepare (preview) → user confirms → real entry created**.

## 2. Backend Runtime Facts

- **Base URL:** `http://localhost:8080` — all routes under `/api/**`.
- **Stack:** Spring Boot 4.1 / Java 21 / PostgreSQL. Flyway owns the schema (applies on first boot).
- **Boot it:**
  ```powershell
  cd Backend/expence-tracker/expence-tracker
  # one-time: copy src/main/resources/application.properties.example
  #           to src/main/resources/application-local.properties and fill in
  #           DB_URL / DB_USER / DB_PASSWORD / JWT_SECRET / CORS_ORIGINS
  .\mvnw.cmd spring-boot:run
  ```
- **CORS:** `/api/**` allows the origins in `CORS_ORIGINS` (default `http://localhost:3000`), methods GET/POST/PUT/PATCH/DELETE/OPTIONS, headers `*`, **no credentials** (auth is a header, not cookies). Run the frontend dev server on an allowed origin.
- **Auth:** JWT Bearer. Send `Authorization: Bearer <token>` on every call except register/login. **No refresh token** — on 401 after expiry, redirect to login. `expiresInMs` comes with each login/register response.
- **Error envelope (every failure):**
  ```json
  { "status": 409, "message": "An account with this email already exists",
    "timestamp": "2026-08-25T07:54:07Z", "fieldErrors": null }
  ```
  `fieldErrors` is a `{field: message}` map, populated only for 400 validation failures (`message` = "Validation failed").
- **Status codes:** 200 OK · 201 created · 204 delete/reorder (empty body) · 400 validation/bad shape · 401 missing/expired/garbage token · 404 not found or not owned · 405 wrong verb · 409 duplicate/conflict/in-use · 500 unexpected (message is generic by design).

### Data format conventions

- **Dates:** `yyyy-MM-dd` strings (e.g. `"2026-08-12"`). **Months:** `yyyy-MM` strings.
- **Timestamps:** ISO-8601 with offset (e.g. `"2026-08-24T23:54:20.0121647+05:30"`).
- **Money:** JSON numbers with up to 2 decimals (e.g. `300` or `13330.00`). They are decimals semantically — parse with a decimal library (`decimal.js`/`big.js`) for any math or exact display; never raw float arithmetic.
- **IDs:** UUIDv4 strings. **No pagination anywhere** — list endpoints return full arrays; do client-side filtering/paging for now.
- **Enums as strings:** `INCOMING`, `OUTGOING`, `TRANSFER`, `IDEAL`, `ACTUAL`, `BOTH`, `EQUAL`, `EXACT`, `PERCENTAGE`, `SHARE`, `BANK`, `CASH`, `UPI`, `CARD`, `OTHER`, `NETBANKING`, `ACTIVE`, `ARCHIVED`.

## 3. API Contract (exhaustive)

### 3.1 Auth

| Method & path | Body → Response |
|---|---|
| `POST /api/auth/register` | `{email, password (8–72 chars), displayName (2–120)}` → **201** `AuthResponse` |
| `POST /api/auth/login` | `{email, password}` → **200** `AuthResponse` |
| `GET /api/auth/me` | → **200** `UserResponse` |

```ts
AuthResponse  = { token: string, tokenType: "Bearer", expiresInMs: number,
                  user: UserResponse }
UserResponse  = { id: string, email: string, displayName: string, createdAt: string }
```
Errors: 400 field validation · 401 bad credentials (`"Invalid email or password"`) · 409 duplicate email.
**Registering also seeds** 6 default categories (Food/Travel/Shopping/Bills/Entertainment/Other — Food has subcategories Lunch/Dinner/Coffee/Delivery) and the user's **self Person** record.

### 3.2 Categories & Subcategories

| Method & path | Body → Response |
|---|---|
| `GET /api/categories` | → `CategoryResponse[]` (sorted sortOrder, then name) |
| `POST /api/categories` | `{name ≤80, scope: "IDEAL"\|"ACTUAL"\|"BOTH"}` → **201** |
| `PUT /api/categories/{id}` | `{name, scope, hidden}` → 200 |
| `PUT /api/categories/reorder` | `{categoryIds: string[]}` → **204** (assigns sortOrder by array index) |
| `DELETE /api/categories/{id}` | → **204**; **409** if referenced by transactions/subcategories (hide instead) |
| `POST /api/categories/{id}/subcategories` | `{name ≤80}` → **201** |
| `PUT /api/subcategories/{id}` | `{name, hidden}` → 200 |
| `DELETE /api/subcategories/{id}` | → **204**; **409** if used |

```ts
CategoryResponse = { id, name, scope, hidden, sortOrder,
                     subcategories: { id, name, hidden, sortOrder }[] }
```
Duplicate names (case-insensitive) → 409. `scope` gates where a category may be used: `IDEAL`-scoped categories are rejected by **Actual** transactions, `ACTUAL`-scoped categories are rejected by **Ideal** transactions, and `BOTH` works everywhere (server enforces this; surface the 400 message).

### 3.3 🎯 Ideal

| Method & path | Body → Response |
|---|---|
| `POST /api/ideal/months` | `{month: "yyyy-MM", startingIncoming ≥ 0}` → **201** `{id, month, startingIncoming}` |
| `GET /api/ideal/months` | → `IdealMonthResponse[]` (newest first) |
| `PUT /api/ideal/months/{id}` | `{startingIncoming}` → 200 |
| `POST /api/ideal/transactions` | `IdealTransactionRequest` → **201** `IdealTransactionResponse` |
| `GET /api/ideal/transactions?month=&type=` | → `IdealTransactionResponse[]` |
| `PUT /api/ideal/transactions/{id}` | same body → 200 (date may move it across months; target month must exist) |
| `DELETE /api/ideal/transactions/{id}` | → **204** |
| `GET /api/ideal/summary?month=` | → `IdealSummaryResponse` |

```ts
IdealTransactionRequest = { type: "INCOMING"|"OUTGOING", amount: number,   // > 0
                            categoryId?: string, subcategoryId?: string,   // scope-checked
                            description?: string ≤255, date: "yyyy-MM-dd", notes?: string ≤2000 }
IdealTransactionResponse = IdealTransactionRequest-fields + { id, categoryName, subcategoryName, createdAt }
IdealSummaryResponse = { month, monthStarted: boolean,
                         startingIncoming, additionalIncoming, totalIncoming, totalOutgoing,
                         budgetRemaining, overBudget: boolean, overBudgetAmount,
                         utilizationPercent: number | null }   // null ⇒ render "N/A" (zero incoming)
```
Rules: a transaction **requires its month to exist** → otherwise **404** `"No Ideal month started for yyyy-MM. Start the month first"` (drive the empty state from this + dashboard `hints`). Additional incoming never mutates `startingIncoming` (edit it via `PUT /months/{id}`).

### 3.4 💳 Actual

**Accounts**

| Method & path | Body → Response |
|---|---|
| `POST /api/actual/accounts` | `{name ≤80, accountType, startingBalance? ≥ 0}` → **201** `AccountResponse` |
| `GET /api/actual/accounts?includeArchived=` | → `AccountsResponse` |
| `GET /api/actual/accounts/{id}` | → `AccountResponse` |
| `PUT /api/actual/accounts/{id}` | `{name, accountType, startingBalance, archived}` → 200 |
| `DELETE /api/actual/accounts/{id}` | → **204**; **409** if it has transactions (archive instead) |

```ts
accountType: "BANK"|"CASH"|"UPI"|"CARD"|"OTHER"
AccountResponse = { id, name, accountType, startingBalance: number|null,
                    archived, totalInflow, totalOutflow, currentBalance: number|null }
AccountsResponse = { accounts: AccountResponse[], allStartingBalancesConfigured: boolean }
```
`currentBalance` is **null** when `startingBalance` was never set — render "balance not configured", and when `allStartingBalancesConfigured === false` treat all balance figures as partial data (§6.6).

**Transactions**

| Method & path | Body → Response |
|---|---|
| `POST /api/actual/transactions` | `ActualTransactionRequest` → **201** `ActualTransactionResponse` |
| `GET /api/actual/transactions?month=&type=&accountId=` | → `ActualTransactionResponse[]` |
| `PUT /api/actual/transactions/{id}` | same body → 200 |
| `DELETE /api/actual/transactions/{id}` | → **204** |

```ts
type: "INCOMING"|"OUTGOING"|"TRANSFER"
paymentMethod?: "UPI"|"CASH"|"CARD"|"NETBANKING"|"OTHER"
ActualTransactionRequest = { type, amount > 0, categoryId?, subcategoryId?, accountId?,
                             transferToAccountId?, paymentMethod?, description?, date, notes? }
ActualTransactionResponse = request fields + { id, categoryName, subcategoryName,
                             accountName, transferToAccountName, createdAt }
```
**Transfer rules (server-enforced, surface the messages):** `TRANSFER` requires `accountId` + `transferToAccountId`, they must differ, and must **not** include `categoryId`/`subcategoryId` (400: *"Transfers are not income or expense"*). Non-transfers must not send `transferToAccountId` (400). Accounts are optional for income/expense. Transfers never appear in income/expense totals.

### 3.5 🤝 Splits

**People**

| Method & path | Body → Response |
|---|---|
| `POST /api/splits/people` | `{name ≤120, contactInfo?}` → **201** `PersonResponse` |
| `GET /api/splits/people?includeArchived=` | → `PersonResponse[]` |
| `PUT /api/splits/people/{id}` | `{name, contactInfo, archived}` → 200 |
| `DELETE /api/splits/people/{id}` | → **204**; **409** if referenced; **400** for own self record |

```ts
PersonResponse = { id, name, contactInfo, self: boolean, archived }
```
The **self person** (`self === true`) exists from registration — its `id` is the `createdByPersonId` for split expenses and a side of settlements. Fetch it via `GET /api/splits/people` and cache it.

**Groups**

| Method & path | Body → Response |
|---|---|
| `POST /api/splits/groups` | `{name ≤120, description?, memberPersonIds?: string[]}` → **201** `GroupResponse` |
| `GET /api/splits/groups` | → `GroupResponse[]` |
| `GET /api/splits/groups/{id}` | → `GroupResponse` |
| `PUT /api/splits/groups/{id}` | `{name, description, status: "ACTIVE"|"ARCHIVED"}` → 200 |
| `POST /api/splits/groups/{id}/members` | `{personId}` → 200 `GroupResponse`; **409** duplicate |
| `DELETE /api/splits/groups/{id}/members/{personId}` | → **204** |
| `DELETE /api/splits/groups/{id}` | → **204**; **409** if it has expenses |

```ts
GroupResponse = { id, name, description, status, members: { personId, personName, self }[] }
```

**Split expenses**

| Method & path | Body → Response |
|---|---|
| `POST /api/splits/expenses` | `SplitExpenseRequest` → **201** `SplitExpenseResponse` |
| `GET /api/splits/expenses?month=&groupId=` | → `SplitExpenseResponse[]` |
| `GET /api/splits/expenses/{id}` | → `SplitExpenseResponse` |
| `PUT /api/splits/expenses/{id}` | full replace (re-splits) → 200 |
| `DELETE /api/splits/expenses/{id}` | → **204** |

```ts
SplitExpenseRequest = { groupId?: string, createdByPersonId: string,   // required
                        description?: string, totalAmount: number,      // > 0
                        splitMethod?: "EQUAL"|"EXACT"|"PERCENTAGE"|"SHARE",  // default EQUAL
                        date: "yyyy-MM-dd",
                        participants: { personId: string,              // unique, no duplicates
                                        paidAmount?: number ≥ 0,       // default 0
                                        shareValue?: number }[] }      // required for EXACT/PERCENTAGE/SHARE
SplitExpenseResponse = { id, groupId, groupName, createdByPersonId, createdByPersonName,
                         totalAmount, splitMethod, description, date,
                         participants: { personId, personName, shareAmount, paidAmount,
                                         splitPercentage: number|null, splitUnits: number|null }[] }
```
**The server computes canonical `shareAmount`s — never trust client math.** Constraints: `EXACT` ΣshareValue must equal `totalAmount` (400); `PERCENTAGE` ΣshareValue must equal exactly 100 (400); `SHARE` Σunits > 0. Equal amounts split with largest-remainder cent distribution. Duplicate `personId` in participants → 400; archived people → 400. Editing an expense fully replaces participants (safe: balances are derived at read time).

**Settlements**

| Method & path | Body → Response |
|---|---|
| `POST /api/splits/settlements` | `SettlementRequest` → **201** `SettlementResponse` |
| `GET /api/splits/settlements?month=` | → `SettlementResponse[]` |

```ts
SettlementRequest  = { fromPersonId, toPersonId,        // must differ (400)
                       amount > 0, date, note?, actualTransactionId? }  // explicit link ONLY
SettlementResponse = { id, fromPersonId, fromPersonName, toPersonId, toPersonName,
                       amount, date, note, actualTransactionId: string|null, createdAt }
```
Recorded **as stated** — no outstanding-balance validation; overpaying flips the pair's direction. Creating a settlement does **not** create an Actual transaction.

**Balances**

| Method & path | Response |
|---|---|
| `GET /api/splits/balances` | `BalancesResponse` (current state, all history) |

```ts
BalancesResponse = { youOwe, owedToYou, netBalance,                     // net = owedToYou − youOwe
                     people: { personId, personName, self: false,
                               amount }[],   // amount > 0 ⇒ user owes them; < 0 ⇒ they owe user
                     pairs: { fromPersonId, fromPersonName,             // debtor
                              toPersonId, toPersonName, amount }[] }    // creditor — every nonzero pair
```

### 3.6 Reports — `GET /api/reports/{domain}/{weekly|monthly}`

`ref` formats: weekly `yyyy-MM-dd` (any date inside the wanted Monday–Sunday week; default today) · monthly `yyyy-MM` (a full date is also accepted; its month is used; default current month).

**🎯 Ideal Weekly** — `ideal/weekly`
```ts
{ weekStart, weekEnd, idealIncoming, idealOutgoing,
  monthBudgetUsedPercent, monthBudgetRemaining,          // month-level context for this week
  categoryBreakdown: { name, amount, percentOfWeek }[],  // amount desc
  dailySpending: { date, amount }[],                     // all 7 days, zeros included
  highestSpendingDay: { date, amount } | null,
  lowestSpendingDay:  { date, amount } | null,           // null when the week had no spending
  highestCategory: string | null, lowestCategory: string | null, mostFrequentCategory: string | null }
```

**🎯 Ideal Monthly** — `ideal/monthly` (the "financial review")
```ts
{ month,
  overview: { totalIncoming, totalOutgoing, budgetRemaining, overBudget, utilizationPercent },
  incomingAnalysis: { startingIncoming, additionalIncoming, totalIncoming, incomingCount,
                      largestIncoming, largestIncomingDescription },
  overBudgetAnalysis: { overBudget, overBudgetAmount, crossedOn: date|null },
  dailySpending: { date, amount }[],
  weeklySpending: { weekStart, amount }[],               // Monday-start buckets clipped to month
  categoryBreakdown: { name, amount, percentOfMonth, txnCount }[],
  subcategoryBreakdown: { categoryName, subcategoryName, amount }[],
  spendingFrequency: { name, txnCount, total }[],
  highestSpendingDay, lowestSpendingDay,
  burnRate: { usedPercent, elapsedPercent, verdict },    // verdict: "ahead of the month" | "behind the month" | "roughly on track" | "not enough data"
  projection: { projectedMonthEndOutgoing, isFullMonthActual },  // label as projection unless isFullMonthActual
  previousMonthComparison: { previousMonth, previousIncoming, previousOutgoing,
                             outgoingDelta, outgoingDeltaPercent: number|null },
  categoryTrends: { category, months: { month, outgoing }[] }[],   // last 6 months, zero-filled
  keyInsights: string[] }                                // render as a list, verbatim
```

**💳 Actual Weekly** — `actual/weekly` (never contains Ideal figures)
```ts
{ weekStart, weekEnd, moneyIn, moneyOut, netCashFlow,
  incomeBreakdown: { name, amount, txnCount }[],
  expenseBreakdown: { name, amount, txnCount }[],
  paymentMethodBreakdown: { method, amount, txnCount }[],
  dailyCashFlow: { date, inflow, outflow, net }[] }      // transfers excluded from flows
```

**💳 Actual Monthly** — `actual/monthly`
```ts
{ month,
  cashFlowOverview: { moneyIn, moneyOut, netCashFlow, txnCount },
  incomeAnalysis:  SideAnalysis, expenseAnalysis: SideAnalysis,
  categoryBreakdown: { name, amount, txnCount, percentOfSide }[],   // outgoing
  accountAnalysis: { accountId, name, accountType, totalInflow, totalOutflow,
                     netMovement, startingBalance: number|null, currentBalance: number|null }[],
  allStartingBalancesConfigured: boolean,               // false ⇒ show "partial data" notice
  paymentMethodAnalysis: { method, amount, txnCount }[],
  transactionCount: { total, incoming, outgoing, transfers },
  dailyCashFlow: { date, inflow, outflow, net }[],
  largestTransactions: { id, type, amount, description, date }[],   // top 5
  previousMonthComparison: { previousMonth, previousIn, previousOut,
                             inDelta: null, outDelta: null },      // deltas reserved; compute client-side if needed
  categoryTrends: { category, months: { month, outgoing }[] }[],
  cashFlowTrends: { month, in, out, net }[],            // 6 months
  keyInsights: string[] }
SideAnalysis = { total, txnCount, largest, largestDescription,
                 byCategory: { name, amount, txnCount, percentOfSide }[] }
```

**🤝 Split Weekly** — `splits/weekly`
```ts
{ weekStart, weekEnd, newSplitExpenseCount, newSplitExpenseTotal,
  settlementCount, settlementsPaidByMe, settlementsReceivedByMe,
  currentYouOwe, currentOwedToYou, currentNetBalance,
  peopleOverview: { personId, name, netWithMe }[] }
```

**🤝 Split Monthly** — `splits/monthly`
```ts
{ month, moneyYouOwe, moneyOwedToYou, netBalance,
  moneyYouFronted, moneyFrontedForYou,                  // gross lifetime figures (before settlements)
  newSplitExpenses: { count, total },
  settlements: { count, paidByMe, receivedByMe },
  personBreakdown: { personId, name, netWithMe, sharedExpenseCount }[],
  groupBreakdown: { groupId, name, expenseCount, totalAmount, myShare, myPaid }[],
  outstandingBalances: { fromPersonId, fromPersonName, toPersonId, toPersonName, amount }[],
  settlementRatePercent: number | null,                 // null when nothing was ever owed/paid
  previousMonthComparison: { previousMonth, previousExpenseCount, previousExpenseTotal,
                             previousSettlementCount, previousSettlementTotal },
  debtTrends: { month, newDebtCreated, settledAmount }[],   // 6 months
  keyInsights: string[] }
```

### 3.7 Dashboard

| Method & path | Response |
|---|---|
| `GET /api/dashboard?month=` | `DashboardResponse` (month defaults to current) |

```ts
DashboardResponse = { month,
  ideal:  { monthStarted, totalIncoming, totalOutgoing, budgetRemaining,
            overBudget, overBudgetAmount, utilizationPercent: number|null },
  actual: { moneyIn, moneyOut, netCashFlow, txnCount },
  splits: { youOwe, owedToYou, netBalance },
  recents: { ideal: IdealTransactionResponse[],    // ≤5 each — one-tap reuse for Quick Add
             actual: ActualTransactionResponse[],  // (prefill amount/date; user edits before save)
             splits: SplitExpenseResponse[] },
  hints: { needsIdealMonth, hasNoAccounts, hasNoPeople } }  // drive §35 empty states from these
```

### 3.8 Comparison

| Method & path | Response |
|---|---|
| `GET /api/comparison?month=` | `ComparisonResponse` |

```ts
ComparisonResponse = { month,
  rows: { metric: "Incoming"|"Outgoing", ideal, actual,
          difference,                       // actual − ideal
          differencePercent: number|null,   // null when ideal is 0
          note }[] }                        // neutral sentence — render verbatim
```

### 3.9 Recurring

| Method & path | Body → Response |
|---|---|
| `POST /api/recurring` | `CreateRecurringRequest` → **201** `RecurringEntryResponse` |
| `GET /api/recurring?domain=&activeOnly=` | → `RecurringEntryResponse[]` |
| `GET /api/recurring/prepare?month=` | → `PrepareRecurringResponse` (read-only preview) |
| `PUT /api/recurring/{id}` | `UpdateRecurringRequest` → 200 |
| `POST /api/recurring/{id}/confirm` | `{month: "yyyy-MM"}` → 200 `RecurringEntryResponse` |
| `DELETE /api/recurring/{id}` | → **204** |

```ts
CreateRecurringRequest = { domain: "IDEAL"|"ACTUAL", type: "INCOMING"|"OUTGOING",  // TRANSFER rejected
                           amount > 0, categoryId?, subcategoryId?,
                           accountId?,                    // ACTUAL only (400 for IDEAL)
                           description ≤255 (required), dayOfMonth: 1–31 }
UpdateRecurringRequest = same fields + isActive: boolean
RecurringEntryResponse = { id, domain, type, amount, categoryId, categoryName,
                           subcategoryId, subcategoryName, accountId, accountName,
                           description, dayOfMonth, isActive,
                           lastConfirmedMonth: "yyyy-MM-dd"|null, createdAt }
PrepareRecurringResponse = { month, templates: { templateId, domain, type, description,
                             amount, dayOfMonth, targetDate,       // day clamped to month length (31 → Feb 28)
                             alreadyConfirmed, blockReason: string|null }[] }  // e.g. "Start the Ideal month first"
```
**Confirm state machine:** `200` creates the real entry via the domain services (all scope/month validations re-run) and stamps `lastConfirmedMonth` · **409** if already confirmed for that month · **404** if IDEAL and the month isn't started · **400** if template is paused. UI flow: list templates → `prepare` for target month → show preview (respect `blockReason`, disable confirm) → explicit Confirm button → success feedback.

## 4. Locked Frontend Stack & Suggested Structure

**Stack (decided in the project PRD — do not substitute):** Next.js (App Router) · React · TypeScript · Tailwind CSS · Redux Toolkit + RTK Query · React Hook Form · Zod · Recharts · date-fns · Framer Motion.

**Suggested routes** (maps to PRD §12 navigation):

```
/                    → Dashboard (snapshot + Quick Add + recents + hints)
/ideal               → month picker, budget summary, txn list, month setup dialog
/actual              → accounts bar, txn list, filters (month/type/account)
/splits              → tabs: Expenses | Balances | Groups | Settlements
/reports/[domain]    → weekly/monthly toggle + period picker + charts + insights
/people              → people & groups management
/settings            → categories/subcategories, recurring templates
+ QuickAdd           → global modal: "Ideal | Actual | Split" choice (PRD §13),
                       prefilled from dashboard recents
```

Mobile nav (PRD): `Home | Ideal | + | Actual | Splits`, with Reports/People/Settings behind a secondary menu.

**RTK Query suggestions:** one `apiSlice` with `fetchBaseQuery({ baseUrl: "/api" })` (proxy via `next.config` rewrites to `http://localhost:8080` to dodge CORS in dev, or run on the allowed origin); auth header injected in `baseQuery` wrapper; tag invalidation per domain (`Ideal`, `Actual`, `Splits`, `Categories`, `Recurring`) — e.g. confirming a recurring template invalidates both `Recurring` and the target domain's list.

## 5. UX Rules & Gotchas

- **Empty states (§35)** — drive from `dashboard.hints`: `needsIdealMonth` → "Start your month" CTA; `hasNoPeople` → "Add a person" before splits; `hasNoAccounts` → allow transaction entry anyway (accounts are optional). Reports with no history: explain comparisons appear once data exists.
- **Loading** = skeletons, never blank screens. **Destructive ops** (delete category/person/group/account/expense/template) = confirmation dialog; on **409** show the server message ("hide/archive instead").
- **Never float-math money.** Amounts arrive as JSON numbers; convert with `decimal.js` for arithmetic and format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` (the PRD uses ₹).
- **No pagination** on any endpoint — implement client-side filtering/sorting; month/type/account query params exist on the big lists, use them.
- **Tie-breaks are server-side** (alphabetical) — just render `highestSpendingDay` etc. as given.
- **Projections/insights are analysis, not records** — visually separate `projection` and `keyInsights` from recorded totals (PRD §31/§33).
- **Validation errors**: 400 responses carry `fieldErrors` maps — bind them to React Hook Form `setError`.
- **401 handling**: single global handler → clear token → login screen.
- Keep the three systems **visually distinct** everywhere (PRD §32): consistent accent color per system across nav, dashboard cards, quick-add, and reports.

## 6. Verification Checklist (frontend smoke test)

1. Boot backend (§2), start Next dev server on `http://localhost:3000`.
2. Register → land on dashboard: all three `hints` true, zeroed cards.
3. Start Ideal month (e.g. `2026-08`, 20000) → add incoming + a few outgoing → dashboard Ideal card live-updates; hint flips false.
4. Create account (with starting balance) → add income, an expense, and a transfer → verify transfer appears in neither income nor expense; balances update.
5. Add a person → create an EQUAL split expense you paid → balances show them owing you → record a settlement → balance clears → **verify no Actual transaction appeared**.
6. Open all six reports for the seeded month — numbers must match what you entered (spot-check Ideal monthly `overview` vs dashboard).
7. Comparison page: wording only from `note` fields; `differencePercent` shows "N/A" when ideal is 0.
8. Recurring: create template (day 31) → `prepare` for February shows `targetDate` 2026-02-28 → confirm → entry exists → confirm again → 409 toast.
9. Reload after token expiry → 401 → redirected to login.

**Repo conventions:** short imperative commit messages (`git log --oneline` for examples); never commit secrets (`.env*` and `application-local.properties` are already git-ignored); frontend lives in the empty `frontend/` folder at the repo root.
