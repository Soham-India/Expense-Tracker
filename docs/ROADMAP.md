# Product Roadmap

Post-v1 upgrade backlog for the Expense Tracker, prioritized for the project's two goals: **portfolio showcase** and **daily personal tool**.

- **Status legend:** `proposed` → not started · `planned` → next up · `done` → shipped
- **Current state:** backend v1 complete and verified (schema, auth, categories, Ideal, Actual, Splits, 6 report engines, dashboard, comparison, recurring — see `README.md`); frontend in progress.
- **Effort:** S ≈ hours · M ≈ a few days · L ≈ a week+.

---

## 1. Automation & Capture

The single biggest real-world lever: manual entry is why finance apps get abandoned.

| Item | Description | Impact | Effort | Status |
|---|---|---|---|---|
| CSV / statement import | Upload bank statements, map columns, preview, duplicate detection, then batch-create Actual transactions. | High (personal tool safety net) | M | proposed |
| UPI SMS/notification parser (Android) | Parse bank SMS / notification alerts into *draft* Actual transactions awaiting confirmation — never auto-post (§41). | Highest retention lever | L | proposed |
| Account Aggregator (Sahamati) integration | RBI AA framework for consented bank-data sync. | High; strong resume signal | L | proposed |
| Receipt OCR | Snap a bill → draft entry (amount, date, merchant guess). | Medium | M | proposed |

## 2. Splits Deepening

| Item | Description | Impact | Effort | Status |
|---|---|---|---|---|
| Debt simplification for groups | Minimize the number of transfers across a group's balances (greedy/flow matching on the existing pairwise debt matrix). Classic algorithm — great portfolio material. | High | M | proposed |
| Shareable read-only settlement link / QR | Generate a per-person link showing "you owe ₹X" + settle instructions. Keeps §41 privacy (they never see the ledger) while capturing Splitwise's core payoff. | High | M | proposed |
| Recurring splits | Monthly shared expenses (flatmate rent) prepared via the existing prepare/confirm workflow. | Medium | S | proposed |

## 3. Ideal Deepening

| Item | Description | Impact | Effort | Status |
|---|---|---|---|---|
| Category-level envelopes | Ideal budget per category (not just monthly total) → "Food: 68% of envelope used" insights and per-envelope burn rate. Deepens the product's best idea. | High | M | proposed |
| Savings goals / sinking funds | "₹50k trip by December" with progress tracking against Ideal incoming. | Medium | M | proposed |
| Copy-last-month planning | One-click clone of a previous month's Ideal plan into a new month (trivial over the existing month + transaction APIs). | Medium (daily convenience) | S | proposed |

## 4. Analytics & Views

| Item | Description | Impact | Effort | Status |
|---|---|---|---|---|
| Calendar heat-map | GitHub-style spending calendar per month. | Medium (visual portfolio shine) | S | proposed |
| Tags + saved searches | User-defined tags on transactions; save filter combinations. | Medium | M | proposed |
| Net-worth tracking | Account balances over time + manual assets/liabilities snapshots; trend line. | Medium | M | proposed |
| Custom dashboard widgets | User picks which cards/sections appear and in what order. | Low–Medium | M | proposed |

## 5. 🤖 AI Insights

All AI output is **analysis only** — see guardrails below.

| Item | Description | Impact | Effort | Status |
|---|---|---|---|---|
| AI monthly narratives | LLM generates a written financial review over the existing 6 report engines' structured output (they already emit `keyInsights` seeds — the LLM turns data into prose + advice). | High (portfolio demo moment) | M | proposed |
| Natural-language queries | "How much did I spend on food last month?" → intent-mapped to the existing report/comparison/summary endpoints; answers cite the underlying numbers. | High (flashy demo) | M | proposed |
| Anomaly detection | Rule-based thresholds first (category spend vs 3-month average), LLM commentary layered later. | Medium | M | proposed |
| Smart categorization suggestions | Suggest a category/subcategory for a new entry from the user's own history (embeddings or LLM few-shot). | Medium (entry speed) | M | proposed |
| Subscription & recurring-charge detection | Detect repeating charges from entry patterns and offer to create a Recurring template (user confirms — §10 flow). | Medium | S | proposed |

**AI guardrails (binding for every item above):**

1. AI never mutates financial records and never auto-posts (§31, §41).
2. All AI output is labeled as analysis/projection, visually distinct from recorded values.
3. No financial data leaves the stack to a third-party LLM without explicit user consent (opt-in, per feature).
4. Numbers shown must always come from the deterministic report engines — the LLM narrates, it does not compute.

## 6. Platform & UX

| Item | Description | Impact | Effort | Status |
|---|---|---|---|---|
| Command palette + keyboard shortcuts | Ctrl+K quick add / jump-to; keyboard-first entry flows. | High (daily joy + portfolio polish) | M | proposed |
| PWA | Installable app, offline-tolerant entry queue on mobile. | High (personal tool) | M | proposed |
| Telegram / WhatsApp bot entry | "spent 200 lunch" from a chat app → draft entry. | Medium | M | proposed |
| CSV / PDF export | Export any list or report; safety net for a finance tool (§40). | Medium | S | proposed |

## 7. Engineering & Platform

| Item | Description | Impact | Effort | Status |
|---|---|---|---|---|
| GitHub Actions CI | Build + `mvnw test` on every push; badge in README. | High signal, tiny cost | S | proposed |
| Docker + deployment | Vercel (frontend) + Render (backend) + Neon (PostgreSQL) per PRD §37; HTTPS, env-based secrets, Flyway on deploy. | High — the linkable demo | M | proposed |
| Seeded demo account | Read-mostly demo data so reviewers can explore instantly. | High (portfolio) | S | proposed |
| Refresh tokens + 2FA | Token rotation, TOTP second factor. | Medium | M | proposed |
| Rate limiting + audit log | Per-IP/user rate limits; audit trail for sensitive actions. | Medium | M | proposed |
| Weekly email digest | Three-system snapshot (Budget Remaining, Net Cash Flow, You Owe) every Monday. | Medium | S | proposed |

---

## Priority Order (portfolio + personal tool)

1. **GitHub Actions CI + Docker deploy + demo account** — portfolio multiplier, smallest effort.
2. **Command palette + PWA** — daily-driver quality.
3. **CSV import/export** — personal-tool safety net, real feature.
4. **Category envelopes** — deepens the product's core idea.
5. **Debt simplification + shareable settlement links** — completes the Splits story.
6. **AI insights: monthly narratives + NL queries** — the demo moment; anomaly detection after.
7. **Automation swings** — UPI parsing, AA integration, OCR — do when inspired; biggest real-world payoff, biggest effort.

## Non-Goals (deliberate)

- **Shared multi-user ledgers** — §41 keeps each account's People/Groups private. True shared state would require amending a core design decision; treat as a product pivot, not a feature.
- **Ideal ↔ Actual reconciliation** — independence is the product's identity; never auto-validate one against the other.
- **Auto-posting anything** — every automation (imports, parsing, AI, subscriptions) produces *drafts* awaiting explicit confirmation.
