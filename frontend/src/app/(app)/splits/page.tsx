"use client";

import { useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { PlusIcon, UsersIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import {
  useAddGroupMemberMutation,
  useDeleteGroupMutation,
  useDeleteSplitExpenseMutation,
  useGetBalancesQuery,
  useGetGroupsQuery,
  useGetPeopleQuery,
  useGetSettlementsQuery,
  useGetSplitExpensesQuery,
  useRemoveGroupMemberMutation,
} from "@/features/splits/splitsApi";
import { SplitExpenseEditor } from "@/features/splits/SplitExpenseEditor";
import { SettlementFormDialog } from "@/features/splits/SettlementFormDialog";
import { GroupFormDialog } from "@/features/splits/GroupFormDialog";
import { getApiError } from "@/lib/apiError";
import { currentMonthStr } from "@/lib/dates";
import { formatMoney, formatMoneySigned } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { GroupResponse, SplitExpenseResponse } from "@/types/api";

type Tab = "expenses" | "balances" | "groups" | "settlements";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "expenses", label: "Expenses" },
  { id: "balances", label: "Balances" },
  { id: "groups", label: "Groups" },
  { id: "settlements", label: "Settlements" },
];

export default function SplitsPage() {
  const [tab, setTab] = useState<Tab>("expenses");
  const [month, setMonth] = useState(currentMonthStr());
  const [groupFilter, setGroupFilter] = useState("");
  const [expenseCreateOpen, setExpenseCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SplitExpenseResponse | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<SplitExpenseResponse | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementDefaults, setSettlementDefaults] = useState<{
    from?: string;
    to?: string;
  }>({});
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupResponse | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<GroupResponse | null>(null);

  function shiftMonth(delta: number) {
    const base = parseISO(`${month}-01`);
    setMonth(format(delta > 0 ? addMonths(base, 1) : subMonths(base, 1), "yyyy-MM"));
  }

  function openSettlement(from?: string, to?: string) {
    setSettlementDefaults({ from, to });
    setSettlementOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Splits"
        subtitle="Obligations between people - recorded as stated, settled explicitly."
        icon={<UsersIcon />}
        accent="splits"
        actions={
          <>
            <Button onClick={() => setExpenseCreateOpen(true)} className="max-sm:w-full">
              <PlusIcon className="size-4" /> Expense
            </Button>
            <Button variant="secondary" onClick={() => openSettlement()} className="max-sm:w-full">
              Settlement
            </Button>
            <Button variant="secondary" onClick={() => setGroupCreateOpen(true)} className="max-sm:w-full">
              New group
            </Button>
          </>
        }
      />

      <div className="flex gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              tab === t.id
                ? "bg-splits-50 dark:bg-splits-500/10 text-splits-700 dark:text-splits-300"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "expenses" ? (
          <ExpensesTab
            month={month}
            onShiftMonth={shiftMonth}
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            onEdit={setEditingExpense}
            onDelete={setDeletingExpense}
          />
        ) : null}
        {tab === "balances" ? (
          <BalancesTab onSettle={openSettlement} />
        ) : null}
        {tab === "groups" ? (
          <GroupsTab
            onEdit={setEditingGroup}
            onDelete={setDeletingGroup}
            onViewExpenses={(groupId) => {
              setGroupFilter(groupId);
              setTab("expenses");
            }}
          />
        ) : null}
        {tab === "settlements" ? (
          <SettlementsTab
            month={month}
            onShiftMonth={shiftMonth}
            onRecord={() => openSettlement()}
          />
        ) : null}
      </div>

      {/* Expense create/edit */}
      <Modal
        open={expenseCreateOpen}
        onClose={() => setExpenseCreateOpen(false)}
        title="Add split expense"
        subtitle="The server computes every share - recorded as stated."
        width="sm:max-w-2xl"
      >
        <SplitExpenseEditor
          prefill={{ date: `${month}-15` }}
          onSuccess={() => setExpenseCreateOpen(false)}
        />
      </Modal>
      <Modal
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title="Edit split expense"
        subtitle="Editing replaces all participants and re-splits."
        width="sm:max-w-2xl"
      >
        {editingExpense ? (
          <SplitExpenseEditor
            key={editingExpense.id}
            expense={editingExpense}
            onSuccess={() => setEditingExpense(null)}
          />
        ) : null}
      </Modal>

      {/* Delete expense */}
      <DeleteExpenseDialog
        expense={deletingExpense}
        onClose={() => setDeletingExpense(null)}
      />

      {/* Settlement */}
      <SettlementFormDialog
        open={settlementOpen}
        onClose={() => setSettlementOpen(false)}
        defaultFromPersonId={settlementDefaults.from}
        defaultToPersonId={settlementDefaults.to}
      />

      {/* Group create/edit/delete */}
      <GroupFormDialog
        open={groupCreateOpen}
        onClose={() => setGroupCreateOpen(false)}
      />
      <GroupFormDialog
        key={editingGroup?.id ?? "none"}
        open={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        group={editingGroup ?? undefined}
      />
      <DeleteGroupDialog
        group={deletingGroup}
        onClose={() => setDeletingGroup(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Expenses tab
// ---------------------------------------------------------------------------

function ExpensesTab({
  month,
  onShiftMonth,
  groupFilter,
  onGroupFilterChange,
  onEdit,
  onDelete,
}: {
  month: string;
  onShiftMonth: (delta: number) => void;
  groupFilter: string;
  onGroupFilterChange: (v: string) => void;
  onEdit: (e: SplitExpenseResponse) => void;
  onDelete: (e: SplitExpenseResponse) => void;
}) {
  const { data: groups = [] } = useGetGroupsQuery();
  const { data: expenses = [], isLoading } = useGetSplitExpensesQuery({
    month,
    groupId: groupFilter || undefined,
  });

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onShiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
            {format(parseISO(`${month}-01`), "MMMM yyyy")}
          </span>
          <button
            onClick={() => onShiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            ›
          </button>
        </div>
        <select
          value={groupFilter}
          onChange={(e) => onGroupFilterChange(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
          aria-label="Filter by group"
        >
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No split expenses for this period.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {[...expenses]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {e.description ?? e.groupName ?? "Split expense"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {e.date}
                      {e.groupName ? ` · ${e.groupName}` : ""} · {e.splitMethod.toLowerCase()} ·{" "}
                      paid by {e.createdByPersonName}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(e.totalAmount)}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => onEdit(e)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(e)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {e.participants.map((p) => (
                    <span key={p.personId}>
                      {p.personName}:{" "}
                      <span className="tabular-nums">
                        share {formatMoney(p.shareAmount)}
                        {p.paidAmount > 0 ? ` · paid ${formatMoney(p.paidAmount)}` : ""}
                      </span>
                    </span>
                  ))}
                </p>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Balances tab
// ---------------------------------------------------------------------------

function BalancesTab({
  onSettle,
}: {
  onSettle: (from?: string, to?: string) => void;
}) {
  const { data: balances, isLoading } = useGetBalancesQuery();
  const { data: people = [] } = useGetPeopleQuery();
  const self = people.find((p) => p.self);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (!balances) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="You Owe" value={formatMoney(balances.youOwe)} tone="owe" />
        <StatCard label="Owed To You" value={formatMoney(balances.owedToYou)} tone="owed" />
        <StatCard
          label="Net"
          value={formatMoneySigned(balances.netBalance)}
          tone={balances.netBalance < 0 ? "owe" : "owed"}
          caption="owed to you minus you owe"
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Per person</h2>
        {balances.people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No balances with anyone - all square.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {balances.people.map((p) => (
              <li key={p.personId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                  {p.personName}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    p.amount > 0 ? "text-red-600 dark:text-red-400" : "text-actual-700 dark:text-actual-300",
                  )}
                >
                  {p.amount > 0
                    ? `you owe ${formatMoney(p.amount)}`
                    : `owes you ${formatMoney(-p.amount)}`}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    p.amount > 0
                      ? onSettle(self?.id, p.personId)
                      : onSettle(p.personId, self?.id)
                  }
                >
                  Settle
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {balances.pairs.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            All directions
          </h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {balances.pairs.map((p, i) => (
              <li key={`${p.fromPersonId}-${p.toPersonId}-${i}`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-100">{p.fromPersonName}</span>
                <span aria-hidden>→</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{p.toPersonName}</span>
                <span className="ml-auto font-semibold tabular-nums">
                  {formatMoney(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone: "owe" | "owed";
  caption?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          tone === "owe" ? "text-red-600 dark:text-red-400" : "text-actual-700 dark:text-actual-300",
        )}
      >
        {value}
      </p>
      {caption ? <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{caption}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Groups tab
// ---------------------------------------------------------------------------

function GroupsTab({
  onEdit,
  onDelete,
  onViewExpenses,
}: {
  onEdit: (g: GroupResponse) => void;
  onDelete: (g: GroupResponse) => void;
  onViewExpenses: (groupId: string) => void;
}) {
  const { data: groups = [], isLoading } = useGetGroupsQuery();
  const { data: people = [] } = useGetPeopleQuery();
  const [addMember, { isLoading: adding }] = useAddGroupMemberMutation();
  const [removeMember] = useRemoveGroupMemberMutation();
  const [memberPick, setMemberPick] = useState<Record<string, string>>({});

  const activePeople = people.filter((p) => !p.archived);

  async function onAdd(g: GroupResponse) {
    const personId = memberPick[g.id];
    if (!personId) return;
    try {
      await addMember({ groupId: g.id, body: { personId } }).unwrap();
      setMemberPick((m) => ({ ...m, [g.id]: "" }));
      toast.success("Member added");
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  async function onRemove(g: GroupResponse, personId: string) {
    try {
      await removeMember({ groupId: g.id, personId }).unwrap();
      toast.success("Member removed");
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No groups yet - create one to organize shared expenses (optional).
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((g) => {
        const candidates = activePeople.filter(
          (p) => !g.members.some((m) => m.personId === p.id),
        );
        return (
          <div
            key={g.id}
            className={cn(
              "rounded-2xl border bg-white dark:bg-slate-900 p-4",
              g.status === "ARCHIVED"
                ? "border-slate-200 dark:border-slate-800 opacity-70"
                : "border-slate-200 dark:border-slate-800",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {g.name}
                </p>
                {g.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {g.description}
                  </p>
                ) : null}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  g.status === "ACTIVE"
                    ? "bg-splits-50 dark:bg-splits-500/10 text-splits-700 dark:text-splits-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                )}
              >
                {g.status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.members.length === 0 ? (
                <span className="text-xs text-slate-400 dark:text-slate-500">No members yet</span>
              ) : (
                g.members.map((m) => (
                  <span
                    key={m.personId}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 py-0.5 pl-2.5 pr-1 text-xs text-slate-700 dark:text-slate-300"
                  >
                    {m.personName}
                    {m.self ? " (you)" : ""}
                    <button
                      onClick={() => onRemove(g, m.personId)}
                      aria-label={`Remove ${m.personName}`}
                      className="rounded-full px-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            {g.status === "ACTIVE" && candidates.length > 0 ? (
              <div className="mt-3 flex gap-2">
                <select
                  value={memberPick[g.id] ?? ""}
                  onChange={(e) =>
                    setMemberPick((m) => ({ ...m, [g.id]: e.target.value }))
                  }
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                  aria-label={`Add member to ${g.name}`}
                >
                  <option value="">Add member…</option>
                  {candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.self ? "You" : p.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={adding}
                  disabled={!memberPick[g.id]}
                  onClick={() => onAdd(g)}
                >
                  Add
                </Button>
              </div>
            ) : null}

            <div className="mt-3 flex gap-3 border-t border-slate-100 dark:border-slate-800 pt-2.5 text-xs">
              <button
                onClick={() => onEdit(g)}
                className="font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(g)}
                className="font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={() => onViewExpenses(g.id)}
                className="ml-auto font-medium text-splits-700 dark:text-splits-300 hover:underline cursor-pointer"
              >
                View expenses
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settlements tab
// ---------------------------------------------------------------------------

function SettlementsTab({
  month,
  onShiftMonth,
  onRecord,
}: {
  month: string;
  onShiftMonth: (delta: number) => void;
  onRecord: () => void;
}) {
  const { data: settlements = [], isLoading } = useGetSettlementsQuery({ month });

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onShiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
            {format(parseISO(`${month}-01`), "MMMM yyyy")}
          </span>
          <button
            onClick={() => onShiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            ›
          </button>
        </div>
        <Button size="sm" variant="secondary" onClick={onRecord}>
          <PlusIcon className="size-3.5" /> Record settlement
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : settlements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No settlements this month.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {[...settlements]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span aria-hidden className="text-slate-400 dark:text-slate-500">⇄</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-slate-800 dark:text-slate-100">
                    <span className="font-medium">{s.fromPersonName}</span>
                    <span className="text-slate-400 dark:text-slate-500"> paid </span>
                    <span className="font-medium">{s.toPersonName}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {s.date}
                    {s.note ? ` · ${s.note}` : ""}
                    {s.actualTransactionId ? " · linked to Actual" : ""}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatMoney(s.amount)}
                </span>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Delete dialogs
// ---------------------------------------------------------------------------

function DeleteExpenseDialog({
  expense,
  onClose,
}: {
  expense: SplitExpenseResponse | null;
  onClose: () => void;
}) {
  const [deleteExpense, { isLoading }] = useDeleteSplitExpenseMutation();
  async function onConfirm() {
    if (!expense) return;
    try {
      await deleteExpense(expense.id).unwrap();
      toast.success("Split expense deleted");
      onClose();
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }
  return (
    <ConfirmDialog
      open={!!expense}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={isLoading}
      title="Delete split expense?"
      message={`"${expense?.description ?? "This expense"}" (${formatMoney(expense?.totalAmount ?? 0)}) and all its shares will be removed. This cannot be undone.`}
    />
  );
}

function DeleteGroupDialog({
  group,
  onClose,
}: {
  group: GroupResponse | null;
  onClose: () => void;
}) {
  const [deleteGroup, { isLoading }] = useDeleteGroupMutation();
  async function onConfirm() {
    if (!group) return;
    try {
      await deleteGroup(group.id).unwrap();
      toast.success("Group deleted");
      onClose();
    } catch (err) {
      // 409 when the group has expenses - server message explains.
      toast.error(getApiError(err).message);
      onClose();
    }
  }
  return (
    <ConfirmDialog
      open={!!group}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={isLoading}
      title="Delete group?"
      message={`"${group?.name}" will be removed. Groups with expenses cannot be deleted - archive instead.`}
    />
  );
}
