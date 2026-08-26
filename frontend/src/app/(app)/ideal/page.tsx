"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { TargetIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import {
  useDeleteIdealTransactionMutation,
  useGetIdealMonthsQuery,
  useGetIdealSummaryQuery,
  useGetIdealTransactionsQuery,
  useUpdateIdealMonthMutation,
} from "@/features/ideal/idealApi";
import { IdealEntryForm } from "@/features/ideal/IdealEntryForm";
import { getApiError } from "@/lib/apiError";
import {
  currentMonthStr,
  formatDateLabel,
  type MonthString,
} from "@/lib/dates";
import { formatMoney, formatMoneySigned, money } from "@/lib/money";
import { cn } from "@/lib/cn";
import { useAppDispatch } from "@/store/hooks";
import { openStartMonth } from "@/store/slices/uiSlice";
import type {
  IdealMonthResponse,
  IdealTransactionResponse,
  TransactionType,
} from "@/types/api";

type TypeFilter = "ALL" | TransactionType;

const filterChips: Array<{ id: TypeFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "INCOMING", label: "Incoming" },
  { id: "OUTGOING", label: "Outgoing" },
];

export default function IdealPage() {
  const dispatch = useAppDispatch();
  const [selected, setSelected] = useState<MonthString | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<IdealTransactionResponse | null>(null);
  const [deleting, setDeleting] = useState<IdealTransactionResponse | null>(null);
  const [editingStarting, setEditingStarting] = useState(false);

  const { data: months = [], isLoading: monthsLoading } =
    useGetIdealMonthsQuery();
  const currentMonth = currentMonthStr();

  // Auto-select: current month when started, else the newest month.
  const selectedMonth =
    selected ?? months.find((m) => m.month === currentMonth)?.month ?? months[0]?.month ?? null;

  const { data: summary, isLoading: summaryLoading } = useGetIdealSummaryQuery(
    selectedMonth!,
    { skip: !selectedMonth },
  );
  const { data: transactions = [], isLoading: txnsLoading } =
    useGetIdealTransactionsQuery(
      { month: selectedMonth!, type: filter === "ALL" ? undefined : filter },
      { skip: !selectedMonth },
    );
  const [deleteTxn, { isLoading: deletingTxn }] =
    useDeleteIdealTransactionMutation();

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  );

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteTxn(deleting.id).unwrap();
      toast.success("Entry deleted");
      setDeleting(null);
    } catch (err) {
      const info = getApiError(err);
      toast.error(info.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Ideal"
        subtitle="Your chosen planning values - never a bank balance."
        icon={<TargetIcon />}
        accent="ideal"
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!selectedMonth}
            className="max-sm:w-full"
          >
            Add entry
          </Button>
        }
      />

      {monthsLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {months.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.month)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                m.month === selectedMonth
                  ? "border-ideal-500 bg-ideal-50 dark:bg-ideal-500/10 text-ideal-700 dark:text-ideal-300"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
              )}
            >
              {formatMonthChip(m.month)}
              {m.month === currentMonth ? (
                <span className="ml-1.5 text-xs opacity-60">current</span>
              ) : null}
            </button>
          ))}
          <button
            onClick={() => dispatch(openStartMonth())}
            className="rounded-full border border-dashed border-ideal-400 px-3.5 py-1.5 text-sm font-medium text-ideal-600 dark:text-ideal-400 hover:bg-ideal-50 dark:hover:bg-ideal-500/10 cursor-pointer"
          >
            + Start a month
          </button>
        </div>
      )}

      {!monthsLoading && months.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ideal-300 dark:border-ideal-500/40 bg-ideal-50/50 dark:bg-ideal-500/10 p-8 text-center">
          <TargetIcon className="mx-auto size-8 text-ideal-400" />
          <h2 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            No Ideal month started
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Start a month with your planned incoming, then add incoming and
            outgoing entries to track your budget.
          </p>
          <Button
            onClick={() => dispatch(openStartMonth())}
            className="mt-4"
          >
            Start your month
          </Button>
        </div>
      ) : null}

      {selectedMonth && summary ? (
        <SummaryCard
          summary={summary}
          onEditStarting={() => setEditingStarting(true)}
        />
      ) : null}
      {selectedMonth && summaryLoading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ) : null}

      {selectedMonth ? (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Entries</h2>
            <div className="flex gap-1.5">
              {filterChips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    filter === c.id
                      ? "border-ideal-500 bg-ideal-50 dark:bg-ideal-500/10 text-ideal-700 dark:text-ideal-300"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {txnsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : sortedTransactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {filter === "ALL"
                ? "No entries for this month yet - add your first one."
                : `No ${filter.toLowerCase()} entries this month.`}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              {sortedTransactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {t.description ?? t.categoryName ?? "Ideal entry"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {formatDateLabel(t.date)}
                      {t.categoryName ? ` · ${t.categoryName}` : ""}
                      {t.subcategoryName ? ` / ${t.subcategoryName}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      t.type === "INCOMING"
                        ? "text-ideal-700 dark:text-ideal-300"
                        : "text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {t.type === "INCOMING"
                      ? formatMoneySigned(t.amount)
                      : `-${formatMoney(t.amount)}`}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(t)}
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
      ) : null}

      {/* Create */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Ideal entry"
        subtitle={selectedMonth ? `Lands in ${selectedMonth} (by date)` : undefined}
      >
        <IdealEntryForm
          prefill={{ date: dateInMonth(selectedMonth) }}
          onSuccess={() => setCreateOpen(false)}
          onMonthMissing={() => {
            setCreateOpen(false);
            dispatch(openStartMonth());
          }}
        />
      </Modal>

      {/* Edit */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Ideal entry"
      >
        {editing ? (
          <IdealEntryForm
            key={editing.id}
            transaction={editing}
            onSuccess={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletingTxn}
        title="Delete entry?"
        message={`"${deleting?.description ?? deleting?.categoryName ?? "This entry"}" will be removed from ${deleting?.date ?? "the month"}. This cannot be undone.`}
      />

      {/* Edit starting incoming */}
      {selectedMonth ? (
        <EditStartingIncomingDialog
          key={selectedMonth}
          month={months.find((m) => m.month === selectedMonth)!}
          open={editingStarting}
          onClose={() => setEditingStarting(false)}
        />
      ) : null}
    </>
  );
}

function formatMonthChip(month: MonthString): string {
  const [y, m] = month.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en", {
    month: "short",
    year: "numeric",
  });
}

function dateInMonth(month: MonthString | null): string | undefined {
  if (!month) return undefined;
  const [y, m] = month.split("-").map(Number);
  const now = new Date();
  if (y === now.getFullYear() && m === now.getMonth() + 1) {
    return `${month}-${String(now.getDate()).padStart(2, "0")}`;
  }
  const days = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(15, days)).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({
  summary,
  onEditStarting,
}: {
  summary: NonNullable<ReturnType<typeof useGetIdealSummaryQuery>["data"]>;
  onEditStarting: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Budget Remaining
          </p>
          {summary.overBudget ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                Over Budget {formatMoney(summary.overBudgetAmount)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                Planned spending exceeded incoming - not a loss, a planning gap.
              </p>
            </>
          ) : (
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatMoney(summary.budgetRemaining)}
            </p>
          )}
        </div>
        <span className="rounded-full bg-ideal-50 dark:bg-ideal-500/10 px-2.5 py-1 text-xs font-medium text-ideal-700 dark:text-ideal-300">
          {summary.overBudget ? "Over budget" : "Planning value"}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 sm:grid-cols-4">
        <div>
          <div className="flex items-center justify-between gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Starting incoming
            </dt>
            <button
              onClick={onEditStarting}
              aria-label="Edit starting incoming"
              className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer text-xs"
            >
              ✎
            </button>
          </div>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(summary.startingIncoming)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Additional incoming
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(summary.additionalIncoming)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Total outgoing
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(summary.totalOutgoing)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Utilization
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {summary.utilizationPercent === null
              ? "N/A"
              : `${summary.utilizationPercent.toFixed(1)}%`}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
        Total incoming {formatMoney(summary.totalIncoming)} · A planning value,
        never a bank balance.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit starting incoming
// ---------------------------------------------------------------------------

const startingSchema = z.object({
  startingIncoming: z
    .string()
    .min(1, "Starting incoming is required")
    .regex(/^\d{1,13}(\.\d{1,2})?$/, "Use digits with up to 2 decimals"),
});

type StartingValues = z.infer<typeof startingSchema>;

function EditStartingIncomingDialog({
  month,
  open,
  onClose,
}: {
  month: IdealMonthResponse;
  open: boolean;
  onClose: () => void;
}) {
  const [updateMonth, { isLoading }] = useUpdateIdealMonthMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StartingValues>({
    resolver: zodResolver(startingSchema),
    defaultValues: { startingIncoming: String(month.startingIncoming) },
  });

  async function onSubmit(values: StartingValues) {
    try {
      await updateMonth({
        id: month.id,
        body: { startingIncoming: money(values.startingIncoming).toNumber() },
      }).unwrap();
      toast.success("Starting incoming updated");
      onClose();
    } catch (err) {
      const info = getApiError(err);
      if (info.fieldErrors) {
        for (const [field, message] of Object.entries(info.fieldErrors)) {
          setError(field as keyof StartingValues, { message });
        }
      }
      toast.error(info.message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit starting incoming"
      subtitle="Additional incoming entries never change this value."
      width="sm:max-w-sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Starting incoming"
          inputMode="decimal"
          required
          error={errors.startingIncoming?.message}
          {...register("startingIncoming")}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
