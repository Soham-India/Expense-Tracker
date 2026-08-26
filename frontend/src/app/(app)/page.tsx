"use client";

import Link from "next/link";
import {
  ArrowUpIcon,
  ChartIcon,
  CompareIcon,
  InfoIcon,
  PlusIcon,
  SwapIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGetDashboardQuery } from "@/features/dashboard/dashboardApi";
import { getApiError } from "@/lib/apiError";
import { currentMonthStr, formatMonthLabel } from "@/lib/dates";
import { formatMoney, formatMoneySigned } from "@/lib/money";
import { cn } from "@/lib/cn";
import { useAppDispatch } from "@/store/hooks";
import { openQuickAdd, openStartMonth } from "@/store/slices/uiSlice";
import type { DashboardResponse } from "@/types/api";

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const month = currentMonthStr();
  const { data, isLoading, isError, error } = useGetDashboardQuery(month);

  return (
    <>
      <PageHeader
        title={formatMonthLabel(data?.month ?? month)}
        subtitle="A snapshot of your three systems - reports live under each system's own page."
        actions={
          <>
            <Button
              onClick={() => dispatch(openQuickAdd({ domain: "ideal" }))}
              className="max-sm:w-full"
            >
              <PlusIcon className="size-4" /> Quick add
            </Button>
            <Link
              href="/compare"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <CompareIcon className="size-4" /> Compare
            </Link>
            <Link
              href="/reports/ideal"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <ChartIcon className="size-4" /> Reports
            </Link>
          </>
        }
      />

      {isLoading ? <DashboardSkeleton /> : null}

      {isError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {getApiError(error).message}
        </div>
      ) : null}

      {data ? (
        <>
          <HintBanner hints={data.hints} />

          <div className="grid gap-4 sm:grid-cols-3">
            <IdealCard data={data} />
            <ActualCard data={data} />
            <SplitsCard data={data} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <RecentSection
              title="Recent Ideal"
              icon={<TargetIcon className="size-4 text-ideal-600 dark:text-ideal-400" />}
              emptyText="No Ideal entries yet - plan your month."
              onOpen={() => dispatch(openQuickAdd({ domain: "ideal" }))}
              openLabel="Add Ideal entry"
            >
              {data.recents.ideal.map((t) => (
                <RecentRow
                  key={t.id}
                  onClick={() =>
                    dispatch(
                      openQuickAdd({
                        domain: "ideal",
                        prefill: {
                          ideal: {
                            type: t.type,
                            amount: t.amount,
                            categoryId: t.categoryId ?? undefined,
                            subcategoryId: t.subcategoryId ?? undefined,
                            description: t.description ?? undefined,
                            date: t.date,
                            notes: t.notes ?? undefined,
                          },
                        },
                      }),
                    )
                  }
                >
                  <span className="flex-1 truncate">
                    {t.description ?? t.categoryName ?? "Ideal entry"}
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      t.type === "INCOMING"
                        ? "text-ideal-700 dark:text-ideal-300"
                        : "text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {t.type === "INCOMING"
                      ? formatMoneySigned(t.amount)
                      : `-${formatMoney(t.amount)}`}
                  </span>
                </RecentRow>
              ))}
            </RecentSection>

            <RecentSection
              title="Recent Actual"
              icon={<ArrowUpIcon className="size-4 text-actual-600 dark:text-actual-400" />}
              emptyText="No transactions yet - accounts are optional."
              onOpen={() => dispatch(openQuickAdd({ domain: "actual" }))}
              openLabel="Record transaction"
            >
              {data.recents.actual.map((t) => (
                <RecentRow
                  key={t.id}
                  onClick={() =>
                    dispatch(
                      openQuickAdd({
                        domain: "actual",
                        prefill: {
                          actual: {
                            type: t.type,
                            amount: t.amount,
                            categoryId: t.categoryId ?? undefined,
                            subcategoryId: t.subcategoryId ?? undefined,
                            accountId: t.accountId ?? undefined,
                            transferToAccountId:
                              t.transferToAccountId ?? undefined,
                            paymentMethod: t.paymentMethod ?? undefined,
                            description: t.description ?? undefined,
                            date: t.date,
                            notes: t.notes ?? undefined,
                          },
                        },
                      }),
                    )
                  }
                >
                  {t.type === "TRANSFER" ? (
                    <SwapIcon className="size-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  ) : null}
                  <span className="flex-1 truncate">
                    {t.description ??
                      t.categoryName ??
                      (t.type === "TRANSFER"
                        ? `${t.accountName ?? "Account"} → ${t.transferToAccountName ?? "Account"}`
                        : "Transaction")}
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      t.type === "INCOMING"
                        ? "text-actual-700 dark:text-actual-300"
                        : "text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {t.type === "INCOMING"
                      ? formatMoneySigned(t.amount)
                      : `-${formatMoney(t.amount)}`}
                  </span>
                </RecentRow>
              ))}
            </RecentSection>

            <RecentSection
              title="Recent Splits"
              icon={<UsersIcon className="size-4 text-splits-600 dark:text-splits-400" />}
              emptyText="No split expenses yet."
              onOpen={() => dispatch(openQuickAdd({ domain: "splits" }))}
              openLabel="Add split expense"
            >
              {data.recents.splits.map((t) => (
                <RecentRow
                  key={t.id}
                  onClick={() =>
                    dispatch(
                      openQuickAdd({
                        domain: "splits",
                        prefill: {
                          splits: {
                            groupId: t.groupId ?? undefined,
                            createdByPersonId: t.createdByPersonId,
                            description: t.description ?? undefined,
                            totalAmount: t.totalAmount,
                            date: t.date,
                            participants: t.participants.map((p) => ({
                              personId: p.personId,
                              paidAmount: p.paidAmount,
                            })),
                          },
                        },
                      }),
                    )
                  }
                >
                  <span className="flex-1 truncate">
                    {t.description ?? t.groupName ?? "Split expense"}
                  </span>
                  <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                    {formatMoney(t.totalAmount)}
                  </span>
                </RecentRow>
              ))}
            </RecentSection>
          </div>
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function CardShell({
  href,
  label,
  icon,
  accentChip,
  children,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  accentChip: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]",
            accentChip,
          )}
        >
          {icon}
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200">
          {label}
        </span>
      </div>
      <dl className="mt-4 space-y-2">{children}</dl>
    </Link>
  );
}

function Row({
  label,
  value,
  valueClass,
  caption,
}: {
  label: string;
  value: string;
  valueClass?: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </dt>
        <dd
          className={cn(
            "font-semibold tabular-nums text-slate-900 dark:text-slate-100",
            valueClass,
          )}
        >
          {value}
        </dd>
      </div>
      {caption ? <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{caption}</p> : null}
    </div>
  );
}

function IdealCard({ data }: { data: DashboardResponse }) {
  const ideal = data.ideal;
  return (
    <CardShell
      href="/ideal"
      label="Ideal"
      icon={<TargetIcon />}
      accentChip="bg-ideal-50 dark:bg-ideal-500/10 text-ideal-600 dark:text-ideal-400"
    >
      {ideal.overBudget ? (
        <Row
          label="Budget Remaining"
          value={`Over Budget ${formatMoney(ideal.overBudgetAmount)}`}
          valueClass="text-red-600 dark:text-red-400"
          caption="A planning value - not a bank balance."
        />
      ) : (
        <Row
          label="Budget Remaining"
          value={formatMoney(ideal.budgetRemaining)}
          caption="A planning value - not a bank balance."
        />
      )}
      <Row label="Total Incoming" value={formatMoney(ideal.totalIncoming)} />
      <Row
        label="Utilization"
        value={
          ideal.utilizationPercent === null
            ? "N/A"
            : `${ideal.utilizationPercent.toFixed(1)}%`
        }
      />
    </CardShell>
  );
}

function ActualCard({ data }: { data: DashboardResponse }) {
  const actual = data.actual;
  return (
    <CardShell
      href="/actual"
      label="Actual"
      icon={<ArrowUpIcon />}
      accentChip="bg-actual-50 dark:bg-actual-500/10 text-actual-600 dark:text-actual-400"
    >
      <Row label="Money In" value={formatMoney(actual.moneyIn)} />
      <Row label="Money Out" value={formatMoney(actual.moneyOut)} />
      <Row
        label="Net Cash Flow"
        value={formatMoneySigned(actual.netCashFlow)}
        valueClass={actual.netCashFlow < 0 ? "text-red-600 dark:text-red-400" : undefined}
        caption={`${actual.txnCount} transaction${actual.txnCount === 1 ? "" : "s"}`}
      />
    </CardShell>
  );
}

function SplitsCard({ data }: { data: DashboardResponse }) {
  const splits = data.splits;
  return (
    <CardShell
      href="/splits"
      label="Splits"
      icon={<UsersIcon />}
      accentChip="bg-splits-50 dark:bg-splits-500/10 text-splits-600 dark:text-splits-400"
    >
      <Row label="You Owe" value={formatMoney(splits.youOwe)} />
      <Row label="Owed To You" value={formatMoney(splits.owedToYou)} />
      <Row
        label="Net"
        value={formatMoneySigned(splits.netBalance)}
        valueClass={splits.netBalance < 0 ? "text-red-600 dark:text-red-400" : undefined}
      />
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Hints (§35 empty states)
// ---------------------------------------------------------------------------

function HintBanner({ hints }: { hints: DashboardResponse["hints"] }) {
  const dispatch = useAppDispatch();
  if (!hints.needsIdealMonth && !hints.hasNoPeople && !hints.hasNoAccounts) {
    return null;
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm">
      {hints.needsIdealMonth ? (
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <TargetIcon className="size-4 text-ideal-600 dark:text-ideal-400" />
          Start your month to begin planning.
          <Button size="sm" onClick={() => dispatch(openStartMonth())}>
            Start your month
          </Button>
        </span>
      ) : null}
      {hints.hasNoPeople ? (
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <UsersIcon className="size-4 text-splits-600 dark:text-splits-400" />
          Add people to start splitting expenses.
          <Link
            href="/people"
            className="font-medium text-splits-700 dark:text-splits-300 hover:underline"
          >
            Add a person
          </Link>
        </span>
      ) : null}
      {hints.hasNoAccounts ? (
        <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <InfoIcon className="size-4 text-slate-400 dark:text-slate-500" />
          Accounts are optional - you can record transactions without them.
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recents
// ---------------------------------------------------------------------------

function RecentSection({
  title,
  icon,
  emptyText,
  openLabel,
  onOpen,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  emptyText: string;
  openLabel: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {icon}
          {title}
        </h2>
        <button
          onClick={onOpen}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
        >
          <PlusIcon className="size-3.5" />
          {openLabel}
        </button>
      </div>
      {hasItems ? (
        <div className="space-y-1">{children}</div>
      ) : (
        <p className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function RecentRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title="Reuse in Quick Add"
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div aria-busy>
      <div className="mb-4">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <Skeleton className="mb-3 h-4 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
