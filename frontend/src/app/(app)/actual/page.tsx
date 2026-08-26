"use client";

import { useState } from "react";
import {
  addMonths,
  format,
  parseISO,
  subMonths,
} from "date-fns";
import {
  ArrowUpIcon,
  PlusIcon,
  SwapIcon,
  WalletIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import {
  useDeleteAccountMutation,
  useDeleteActualTransactionMutation,
  useGetAccountsQuery,
  useGetActualTransactionsQuery,
} from "@/features/actual/actualApi";
import { AccountFormDialog } from "@/features/actual/AccountFormDialog";
import { ActualTransactionForm } from "@/features/actual/ActualTransactionForm";
import { getApiError } from "@/lib/apiError";
import { currentMonthStr, todayStr } from "@/lib/dates";
import { formatBalanceOrNull, formatMoney, formatMoneySigned } from "@/lib/money";
import { cn } from "@/lib/cn";
import type {
  AccountResponse,
  ActualTransactionResponse,
  ActualTransactionType,
} from "@/types/api";

type TypeFilter = "ALL" | ActualTransactionType;

const typeChips: Array<{ id: TypeFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "INCOMING", label: "In" },
  { id: "OUTGOING", label: "Out" },
  { id: "TRANSFER", label: "Transfers" },
];

const typeBadge: Record<ActualTransactionType, string> = {
  INCOMING: "bg-actual-50 dark:bg-actual-500/10 text-actual-700 dark:text-actual-300",
  OUTGOING: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  TRANSFER: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export default function ActualPage() {
  const [month, setMonth] = useState(currentMonthStr());
  const [filter, setFilter] = useState<TypeFilter>("ALL");
  const [accountFilter, setAccountFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [txnCreateOpen, setTxnCreateOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<ActualTransactionResponse | null>(null);
  const [deletingTxn, setDeletingTxn] = useState<ActualTransactionResponse | null>(null);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountResponse | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountResponse | null>(null);

  const { data: accountsData, isLoading: accountsLoading } =
    useGetAccountsQuery(showArchived);
  const accounts = accountsData?.accounts ?? [];
  const visibleAccounts = showArchived
    ? accounts
    : accounts.filter((a) => !a.archived);

  const { data: transactions = [], isLoading: txnsLoading } =
    useGetActualTransactionsQuery({
      month,
      type: filter === "ALL" ? undefined : filter,
      accountId: accountFilter || undefined,
    });
  const [deleteTxn, { isLoading: deletingTxnLoading }] =
    useDeleteActualTransactionMutation();
  const [deleteAcc, { isLoading: deletingAccLoading }] =
    useDeleteAccountMutation();

  function shiftMonth(delta: number) {
    const base = parseISO(`${month}-01`);
    const next = delta > 0 ? addMonths(base, 1) : subMonths(base, 1);
    setMonth(format(next, "yyyy-MM"));
  }

  async function confirmDeleteTxn() {
    if (!deletingTxn) return;
    try {
      await deleteTxn(deletingTxn.id).unwrap();
      toast.success("Transaction deleted");
      setDeletingTxn(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  async function confirmDeleteAccount() {
    if (!deletingAccount) return;
    try {
      await deleteAcc(deletingAccount.id).unwrap();
      toast.success("Account deleted");
      setDeletingAccount(null);
    } catch (err) {
      // 409 = account has transactions; server says archive instead.
      toast.error(getApiError(err).message);
      setDeletingAccount(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Actual"
        subtitle="Real money movement - income, expenses and transfers."
        icon={<WalletIcon />}
        accent="actual"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setAccountDialogOpen(true)}
              className="max-sm:w-full"
            >
              <PlusIcon className="size-4" /> Account
            </Button>
            <Button
              onClick={() => setTxnCreateOpen(true)}
              className="max-sm:w-full"
            >
              <PlusIcon className="size-4" /> Transaction
            </Button>
          </>
        }
      />

      {/* Accounts bar */}
      <section aria-label="Accounts">
        {accountsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            <Skeleton className="h-20 w-52 rounded-xl" />
            <Skeleton className="h-20 w-52 rounded-xl" />
          </div>
        ) : visibleAccounts.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            <span>
              No accounts yet - they are optional, but balances need one.
            </span>
            <Button size="sm" variant="secondary" onClick={() => setAccountDialogOpen(true)}>
              Add account
            </Button>
          </div>
        ) : (
          <>
            {accountsData && !accountsData.allStartingBalancesConfigured ? (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <SwapIcon className="size-3.5" />
                Some accounts have no starting balance - balance figures are
                partial data.
              </p>
            ) : null}
            <div className="flex gap-3 overflow-x-auto pb-1">
              {visibleAccounts.map((a) => {
                const bal = formatBalanceOrNull(a.currentBalance);
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "min-w-52 shrink-0 rounded-xl border bg-white dark:bg-slate-900 p-3.5",
                      a.archived
                        ? "border-slate-200 dark:border-slate-800 opacity-60"
                        : "border-slate-200 dark:border-slate-800",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {a.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {a.accountType}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {a.archived ? "Archived" : "Balance"}
                      </span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          bal.configured ? "text-slate-900 dark:text-slate-100" : "text-xs font-normal text-slate-400 dark:text-slate-500",
                        )}
                      >
                        {bal.text}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-2 text-xs">
                      <button
                        onClick={() => setEditingAccount(a)}
                        className="font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                      >
                        Edit
                      </button>
                      {!a.archived ? (
                        <button
                          onClick={() => setDeletingAccount(a)}
                          className="font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                className="size-3.5 accent-actual-600"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </>
        )}
      </section>

      {/* Filters */}
      <section className="mt-6" aria-label="Filters">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
            >
              ‹
            </button>
            <span className="min-w-36 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
              {format(parseISO(`${month}-01`), "MMMM yyyy")}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
            >
              ›
            </button>
          </div>

          <div className="flex gap-1.5">
            {typeChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  filter === c.id
                    ? "border-actual-500 bg-actual-50 dark:bg-actual-500/10 text-actual-700 dark:text-actual-300"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
            aria-label="Filter by account"
          >
            <option value="">All accounts</option>
            {accounts
              .filter((a) => !a.archived || a.id === accountFilter)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
      </section>

      {/* Transactions */}
      <section className="mt-3" aria-label="Transactions">
        {txnsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No transactions match these filters - record your first one.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {[...transactions]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {t.type === "TRANSFER" ? (
                    <SwapIcon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  ) : (
                    <ArrowUpIcon
                      className={cn(
                        "size-4 shrink-0",
                        t.type === "INCOMING"
                          ? "text-actual-600 dark:text-actual-400"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {t.description ?? t.categoryName ?? labelFor(t)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {t.date}
                      {t.accountName
                        ? t.type === "TRANSFER"
                          ? ` · ${t.accountName} → ${t.transferToAccountName ?? "?"}`
                          : ` · ${t.accountName}`
                        : ""}
                      {t.categoryName ? ` · ${t.categoryName}` : ""}
                      {t.paymentMethod ? ` · ${t.paymentMethod}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      typeBadge[t.type],
                    )}
                  >
                    {t.type}
                  </span>
                  <span
                    className={cn(
                      "w-28 text-right font-semibold tabular-nums",
                      t.type === "INCOMING"
                        ? "text-actual-700 dark:text-actual-300"
                        : t.type === "OUTGOING"
                          ? "text-slate-700 dark:text-slate-300"
                          : "text-sky-700 dark:text-sky-300",
                    )}
                  >
                    {t.type === "INCOMING"
                      ? formatMoneySigned(t.amount)
                      : t.type === "OUTGOING"
                        ? `-${formatMoney(t.amount)}`
                        : formatMoney(t.amount)}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditingTxn(t)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingTxn(t)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Transaction create/edit */}
      <Modal
        open={txnCreateOpen}
        onClose={() => setTxnCreateOpen(false)}
        title="Record transaction"
        subtitle="Income, expense or transfer - transfers never count as in/out."
      >
        <ActualTransactionForm
          prefill={{ date: month === currentMonthStr() ? todayStr() : `${month}-15` }}
          onSuccess={() => setTxnCreateOpen(false)}
        />
      </Modal>
      <Modal
        open={!!editingTxn}
        onClose={() => setEditingTxn(null)}
        title="Edit transaction"
      >
        {editingTxn ? (
          <ActualTransactionForm
            key={editingTxn.id}
            transaction={editingTxn}
            onSuccess={() => setEditingTxn(null)}
          />
        ) : null}
      </Modal>

      {/* Account create/edit */}
      <AccountFormDialog
        open={accountDialogOpen}
        onClose={() => setAccountDialogOpen(false)}
      />
      <AccountFormDialog
        key={editingAccount?.id ?? "none"}
        open={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        account={editingAccount ?? undefined}
      />

      {/* Delete confirms */}
      <ConfirmDialog
        open={!!deletingTxn}
        onClose={() => setDeletingTxn(null)}
        onConfirm={confirmDeleteTxn}
        loading={deletingTxnLoading}
        title="Delete transaction?"
        message={`"${deletingTxn?.description ?? "This transaction"}" (${formatMoney(deletingTxn?.amount ?? 0)}) will be removed. This cannot be undone.`}
      />
      <ConfirmDialog
        open={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        onConfirm={confirmDeleteAccount}
        loading={deletingAccLoading}
        title="Delete account?"
        message={`"${deletingAccount?.name}" will be removed. Accounts with transactions cannot be deleted - archive them instead.`}
      />
    </>
  );
}

function labelFor(t: ActualTransactionResponse): string {
  if (t.type === "TRANSFER") return "Transfer";
  return t.type === "INCOMING" ? "Income" : "Expense";
}
