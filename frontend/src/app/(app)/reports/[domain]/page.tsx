"use client";

import { use, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChartIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CHART_COLORS,
  ChartFrame,
  MoneyBarChart,
  MoneyLineChart,
  PercentBars,
  Stat,
} from "@/components/charts/Charts";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useGetActualMonthlyQuery,
  useGetActualWeeklyQuery,
  useGetIdealMonthlyQuery,
  useGetIdealWeeklyQuery,
  useGetSplitsMonthlyQuery,
  useGetSplitsWeeklyQuery,
  isReportDomain,
  reportDomains,
} from "@/features/reports/reportsApi";
import { getApiError } from "@/lib/apiError";
import { currentMonthStr, todayStr } from "@/lib/dates";
import { formatMoney, formatMoneySigned, formatPercent } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { ReportDomain } from "@/types/api";

type Period = "weekly" | "monthly";

const domainMeta: Record<
  ReportDomain,
  { label: string; color: string; accent: "ideal" | "actual" | "splits" }
> = {
  ideal: { label: "Ideal", color: "text-ideal-700 dark:text-ideal-300", accent: "ideal" },
  actual: { label: "Actual", color: "text-actual-700 dark:text-actual-300", accent: "actual" },
  splits: { label: "Splits", color: "text-splits-700 dark:text-splits-300", accent: "splits" },
};

export default function ReportsPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain: raw } = use(params);
  const [period, setPeriod] = useState<Period>("monthly");
  const [weekRef, setWeekRef] = useState(todayStr());
  const [monthRef, setMonthRef] = useState(currentMonthStr());

  if (!isReportDomain(raw)) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Unknown report &quot;{raw}&quot;.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          {reportDomains.map((d) => (
            <Link
              key={d}
              href={`/reports/${d}`}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              {domainMeta[d].label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const domain = raw;
  const meta = domainMeta[domain];
  const ref = period === "weekly" ? weekRef : monthRef;

  return (
    <>
      <PageHeader
        title={`${meta.label} reports`}
        subtitle="Analysis of recorded data - insights are commentary, never new values."
        icon={<ChartIcon />}
        accent={meta.accent}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {reportDomains.map((d) => (
            <Link
              key={d}
              href={`/reports/${d}`}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                d === domain
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
              )}
            >
              {domainMeta[d].label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
            {(["weekly", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize cursor-pointer",
                  period === p
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          {period === "weekly" ? (
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Week of
              <input
                type="date"
                value={weekRef}
                onChange={(e) => setWeekRef(e.target.value || todayStr())}
                className={inputBox}
              />
            </label>
          ) : (
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Month
              <input
                type="month"
                value={monthRef}
                onChange={(e) => setMonthRef(e.target.value || currentMonthStr())}
                className={inputBox}
              />
            </label>
          )}
        </div>
      </div>

      <div className="mt-5">
        {domain === "ideal" && period === "weekly" ? <IdealWeekly ref={ref} /> : null}
        {domain === "ideal" && period === "monthly" ? <IdealMonthly ref={ref} /> : null}
        {domain === "actual" && period === "weekly" ? <ActualWeekly ref={ref} /> : null}
        {domain === "actual" && period === "monthly" ? <ActualMonthly ref={ref} /> : null}
        {domain === "splits" && period === "weekly" ? <SplitsWeekly ref={ref} /> : null}
        {domain === "splits" && period === "monthly" ? <SplitsMonthly ref={ref} /> : null}
      </div>
    </>
  );
}

const inputBox =
  "rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-300";

function Loading({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-2xl" />
      ))}
    </div>
  );
}

function ErrorPanel({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {getApiError(error).message}
    </div>
  );
}

function dayLabel(date: string): string {
  return format(parseISO(date), "EEE d");
}

function shortMonthLabel(ym: string): string {
  return format(parseISO(`${ym}-01`), "MMM");
}

/** Analysis panel - visually distinct from recorded values (PRD §31/§33). */
function AnalysisPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        {title} · analysis, not recorded values
      </p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function InsightList({ insights }: { insights: string[] }) {
  if (insights.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Insights appear once there is enough history.
      </p>
    );
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
      {insights.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}

function HighLow({
  highest,
  lowest,
  extra,
}: {
  highest: string | null;
  lowest: string | null;
  extra?: { label: string; value: string | null }[];
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {highest ? (
        <span className="rounded-full bg-red-50 dark:bg-red-500/10 px-2.5 py-1 text-red-700 dark:text-red-300">
          Highest: {highest}
        </span>
      ) : null}
      {lowest ? (
        <span className="rounded-full bg-actual-50 dark:bg-actual-500/10 px-2.5 py-1 text-actual-700 dark:text-actual-300">
          Lowest: {lowest}
        </span>
      ) : null}
      {extra?.map((e) =>
        e.value ? (
          <span
            key={e.label}
            className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-600 dark:text-slate-400"
          >
            {e.label}: {e.value}
          </span>
        ) : null,
      )}
      {!highest && !lowest ? (
        <span className="text-slate-400 dark:text-slate-500">No spending recorded in this period.</span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🎯 Ideal weekly
// ---------------------------------------------------------------------------

function IdealWeekly({ ref: refDate }: { ref: string }) {
  const { data, isLoading, isError, error } = useGetIdealWeeklyQuery({
    ref: refDate,
  });
  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorPanel error={error} />;

  const weekLabel = `${format(parseISO(data.weekStart), "d MMM")} – ${format(parseISO(data.weekEnd), "d MMM yyyy")}`;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">Week {weekLabel}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ideal Incoming" value={formatMoney(data.idealIncoming)} />
        <Stat label="Ideal Outgoing" value={formatMoney(data.idealOutgoing)} />
        <Stat
          label="Month Budget Used"
          value={formatPercent(data.monthBudgetUsedPercent)}
        />
        <Stat
          label="Month Budget Remaining"
          value={
            data.monthBudgetRemaining < 0
              ? `Over Budget ${formatMoney(-data.monthBudgetRemaining)}`
              : formatMoney(data.monthBudgetRemaining)
          }
          tone={data.monthBudgetRemaining < 0 ? "negative" : "default"}
          caption="A planning value - never a bank balance."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Daily spending" subtitle="Zeros included">
          <MoneyBarChart
            data={data.dailySpending.map((d) => ({
              day: dayLabel(d.date),
              amount: d.amount,
            }))}
            xKey="day"
            series={[{ key: "amount", name: "Spent", color: CHART_COLORS.ideal }]}
          />
        </ChartFrame>
        <ChartFrame title="By category" subtitle="Share of the week">
          <PercentBars
            items={data.categoryBreakdown.map((c) => ({
              name: c.name,
              amount: c.amount,
              percent: c.percentOfWeek,
            }))}
            color={CHART_COLORS.ideal}
          />
        </ChartFrame>
      </div>

      <HighLow
        highest={data.highestSpendingDay ? `${dayLabel(data.highestSpendingDay.date)} (${formatMoney(data.highestSpendingDay.amount)})` : null}
        lowest={data.lowestSpendingDay ? `${dayLabel(data.lowestSpendingDay.date)} (${formatMoney(data.lowestSpendingDay.amount)})` : null}
        extra={[
          { label: "Highest category", value: data.highestCategory },
          { label: "Lowest category", value: data.lowestCategory },
          { label: "Most frequent", value: data.mostFrequentCategory },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🎯 Ideal monthly
// ---------------------------------------------------------------------------

function IdealMonthly({ ref: month }: { ref: string }) {
  const { data, isLoading, isError, error } = useGetIdealMonthlyQuery({
    ref: month,
  });
  if (isLoading) return <Loading rows={3} />;
  if (isError || !data) return <ErrorPanel error={error} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">{format(parseISO(`${data.month}-01`), "MMMM yyyy")}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Incoming" value={formatMoney(data.overview.totalIncoming)} />
        <Stat label="Total Outgoing" value={formatMoney(data.overview.totalOutgoing)} />
        <Stat
          label="Budget Remaining"
          value={
            data.overview.overBudget
              ? `Over Budget ${formatMoney(data.overview.budgetRemaining)}`
              : formatMoney(data.overview.budgetRemaining)
          }
          tone={data.overview.overBudget ? "negative" : "default"}
          caption="Planning value - never a bank balance."
        />
        <Stat
          label="Utilization"
          value={formatPercent(data.overview.utilizationPercent)}
          tone={data.overview.utilizationPercent === null ? "muted" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame title="Daily spending" className="lg:col-span-2">
          <MoneyBarChart
            data={data.dailySpending.map((d) => ({
              day: dayLabel(d.date),
              amount: d.amount,
            }))}
            xKey="day"
            series={[{ key: "amount", name: "Spent", color: CHART_COLORS.ideal }]}
          />
        </ChartFrame>
        <div className="space-y-4">
          <ChartFrame title="Incoming analysis">
            <dl className="space-y-1.5 text-sm">
              <Row label="Starting incoming" value={formatMoney(data.incomingAnalysis.startingIncoming)} />
              <Row label="Additional incoming" value={formatMoney(data.incomingAnalysis.additionalIncoming)} />
              <Row label="Entries" value={String(data.incomingAnalysis.incomingCount)} />
              <Row
                label="Largest"
                value={formatMoney(data.incomingAnalysis.largestIncoming)}
                caption={data.incomingAnalysis.largestIncomingDescription ?? undefined}
              />
            </dl>
          </ChartFrame>
          <ChartFrame title="Over budget check" subtitle="Neutral by design">
            {data.overBudgetAnalysis.overBudget ? (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Crossed on {data.overBudgetAnalysis.crossedOn ?? "an unknown date"} ·
                over by {formatMoney(data.overBudgetAnalysis.overBudgetAmount)}
              </p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Not over budget this month.</p>
            )}
          </ChartFrame>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Weekly buckets" subtitle="Monday-start weeks">
          <MoneyBarChart
            data={data.weeklySpending.map((w) => ({
              week: format(parseISO(w.weekStart), "d MMM"),
              amount: w.amount,
            }))}
            xKey="week"
            series={[{ key: "amount", name: "Spent", color: CHART_COLORS.ideal }]}
          />
        </ChartFrame>
        <ChartFrame title="Category trends" subtitle="Last 6 months">
          <MoneyLineChart
            data={trendPivot(data.categoryTrends.map((t) => ({ category: t.category, months: t.months })))}
            xKey="month"
            series={data.categoryTrends.slice(0, 6).map((t, i) => ({
              key: t.category,
              name: t.category,
              color: Object.values(CHART_COLORS)[i % Object.keys(CHART_COLORS).length],
            }))}
          />
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="By category">
          <PercentBars
            items={data.categoryBreakdown.map((c) => ({
              name: c.name,
              amount: c.amount,
              percent: c.percentOfMonth,
              extra: `${c.txnCount} txn${c.txnCount === 1 ? "" : "s"}`,
            }))}
            color={CHART_COLORS.ideal}
          />
        </ChartFrame>
        <div className="space-y-4">
          <ChartFrame title="Subcategories">
            <PercentBars
              items={data.subcategoryBreakdown.map((s) => ({
                name: `${s.categoryName} / ${s.subcategoryName}`,
                amount: s.amount,
              }))}
              color={CHART_COLORS.ideal}
            />
          </ChartFrame>
          <ChartFrame title="Spending frequency">
            <PercentBars
              items={data.spendingFrequency.map((f) => ({
                name: f.name,
                amount: f.total,
                extra: `${f.txnCount}×`,
              }))}
              color={CHART_COLORS.slate}
            />
          </ChartFrame>
        </div>
      </div>

      <HighLow
        highest={data.highestSpendingDay ? `${dayLabel(data.highestSpendingDay.date)} (${formatMoney(data.highestSpendingDay.amount)})` : null}
        lowest={data.lowestSpendingDay ? `${dayLabel(data.lowestSpendingDay.date)} (${formatMoney(data.lowestSpendingDay.amount)})` : null}
      />

      <AnalysisPanel title="Burn rate & projection">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <p>
              Used {formatPercent(data.burnRate.usedPercent, 0)} of the month&apos;s
              money vs {formatPercent(data.burnRate.elapsedPercent, 0)} of days
              elapsed —{" "}
              <span className="font-semibold">{data.burnRate.verdict}</span>.
            </p>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {data.projection.isFullMonthActual
                ? "Month-end outgoing (full month)"
                : "Projected month-end outgoing"}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">
              {formatMoney(data.projection.projectedMonthEndOutgoing)}
            </p>
            {!data.projection.isFullMonthActual ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                A projection, not a recorded value.
              </p>
            ) : null}
          </div>
        </div>
      </AnalysisPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Previous month comparison" subtitle="Neutral numbers, no verdict">
          <dl className="space-y-1.5 text-sm">
            <Row label="Previous month" value={data.previousMonthComparison.previousMonth} />
            <Row label="Previous incoming" value={formatMoney(data.previousMonthComparison.previousIncoming)} />
            <Row label="Previous outgoing" value={formatMoney(data.previousMonthComparison.previousOutgoing)} />
            <Row
              label="Outgoing change"
              value={`${formatMoneySigned(data.previousMonthComparison.outgoingDelta)}${
                data.previousMonthComparison.outgoingDeltaPercent != null
                  ? ` (${data.previousMonthComparison.outgoingDeltaPercent.toFixed(1)}%)`
                  : ""
              }`}
            />
          </dl>
        </ChartFrame>
        <AnalysisPanel title="Key insights">
          <InsightList insights={data.keyInsights} />
        </AnalysisPanel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 💳 Actual weekly
// ---------------------------------------------------------------------------

function ActualWeekly({ ref: refDate }: { ref: string }) {
  const { data, isLoading, isError, error } = useGetActualWeeklyQuery({
    ref: refDate,
  });
  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorPanel error={error} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Week {format(parseISO(data.weekStart), "d MMM")} –{" "}
        {format(parseISO(data.weekEnd), "d MMM yyyy")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Money In" value={formatMoney(data.moneyIn)} tone="positive" />
        <Stat label="Money Out" value={formatMoney(data.moneyOut)} />
        <Stat
          label="Net Cash Flow"
          value={formatMoneySigned(data.netCashFlow)}
          tone={data.netCashFlow < 0 ? "negative" : "positive"}
        />
      </div>

      <ChartFrame title="Daily cash flow" subtitle="Transfers excluded from flows">
        <MoneyBarChart
          data={data.dailyCashFlow.map((d) => ({
            day: dayLabel(d.date),
            inflow: d.inflow,
            outflow: d.outflow,
          }))}
          xKey="day"
          series={[
            { key: "inflow", name: "In", color: CHART_COLORS.actual },
            { key: "outflow", name: "Out", color: CHART_COLORS.slate },
          ]}
        />
      </ChartFrame>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame title="Income by category">
          <PercentBars
            items={data.incomeBreakdown.map((c) => ({
              name: c.name,
              amount: c.amount,
              extra: `${c.txnCount}×`,
            }))}
            color={CHART_COLORS.actual}
          />
        </ChartFrame>
        <ChartFrame title="Expenses by category">
          <PercentBars
            items={data.expenseBreakdown.map((c) => ({
              name: c.name,
              amount: c.amount,
              extra: `${c.txnCount}×`,
            }))}
            color={CHART_COLORS.slate}
          />
        </ChartFrame>
        <ChartFrame title="By payment method">
          <PercentBars
            items={data.paymentMethodBreakdown.map((c) => ({
              name: c.method,
              amount: c.amount,
              extra: `${c.txnCount}×`,
            }))}
            color={CHART_COLORS.sky}
          />
        </ChartFrame>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 💳 Actual monthly
// ---------------------------------------------------------------------------

function ActualMonthly({ ref: month }: { ref: string }) {
  const { data, isLoading, isError, error } = useGetActualMonthlyQuery({
    ref: month,
  });
  if (isLoading) return <Loading rows={3} />;
  if (isError || !data) return <ErrorPanel error={error} />;

  const o = data.cashFlowOverview;
  const tc = data.transactionCount;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">{format(parseISO(`${data.month}-01`), "MMMM yyyy")}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Money In" value={formatMoney(o.moneyIn)} tone="positive" />
        <Stat label="Money Out" value={formatMoney(o.moneyOut)} />
        <Stat
          label="Net Cash Flow"
          value={formatMoneySigned(o.netCashFlow)}
          tone={o.netCashFlow < 0 ? "negative" : "positive"}
        />
        <Stat
          label="Transactions"
          value={String(tc.total)}
          caption={`${tc.incoming} in · ${tc.outgoing} out · ${tc.transfers} transfers`}
        />
      </div>

      {!data.allStartingBalancesConfigured ? (
        <p className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          Some accounts have no starting balance - account figures below are
          partial data.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Daily cash flow">
          <MoneyBarChart
            data={data.dailyCashFlow.map((d) => ({
              day: dayLabel(d.date),
              inflow: d.inflow,
              outflow: d.outflow,
            }))}
            xKey="day"
            series={[
              { key: "inflow", name: "In", color: CHART_COLORS.actual },
              { key: "outflow", name: "Out", color: CHART_COLORS.slate },
            ]}
          />
        </ChartFrame>
        <ChartFrame title="Cash flow trends" subtitle="Last 6 months">
          <MoneyLineChart
            data={data.cashFlowTrends.map((t) => ({
              month: shortMonthLabel(t.month),
              in: t.in,
              out: t.out,
              net: t.net,
            }))}
            xKey="month"
            series={[
              { key: "in", name: "In", color: CHART_COLORS.actual },
              { key: "out", name: "Out", color: CHART_COLORS.slate },
              { key: "net", name: "Net", color: CHART_COLORS.sky },
            ]}
          />
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Income analysis">
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
            Total {formatMoney(data.incomeAnalysis.total)} ·{" "}
            {data.incomeAnalysis.txnCount} entries · largest{" "}
            {formatMoney(data.incomeAnalysis.largest)}
            {data.incomeAnalysis.largestDescription
              ? ` (${data.incomeAnalysis.largestDescription})`
              : ""}
          </p>
          <PercentBars
            items={data.incomeAnalysis.byCategory.map((c) => ({
              name: c.name,
              amount: c.amount,
              percent: c.percentOfSide,
              extra: `${c.txnCount}×`,
            }))}
            color={CHART_COLORS.actual}
          />
        </ChartFrame>
        <ChartFrame title="Expense analysis">
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
            Total {formatMoney(data.expenseAnalysis.total)} ·{" "}
            {data.expenseAnalysis.txnCount} entries · largest{" "}
            {formatMoney(data.expenseAnalysis.largest)}
            {data.expenseAnalysis.largestDescription
              ? ` (${data.expenseAnalysis.largestDescription})`
              : ""}
          </p>
          <PercentBars
            items={data.expenseAnalysis.byCategory.map((c) => ({
              name: c.name,
              amount: c.amount,
              percent: c.percentOfSide,
              extra: `${c.txnCount}×`,
            }))}
            color={CHART_COLORS.slate}
          />
        </ChartFrame>
      </div>

      <ChartFrame title="Accounts">
        {data.accountAnalysis.length === 0 ? (
          <p className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            No accounts - transactions work without them.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500">
                  <th className="pb-2 pr-3 font-medium uppercase tracking-wide">Account</th>
                  <th className="pb-2 pr-3 text-right font-medium uppercase tracking-wide">Inflow</th>
                  <th className="pb-2 pr-3 text-right font-medium uppercase tracking-wide">Outflow</th>
                  <th className="pb-2 pr-3 text-right font-medium uppercase tracking-wide">Net movement</th>
                  <th className="pb-2 text-right font-medium uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.accountAnalysis.map((a) => (
                  <tr key={a.accountId}>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{a.name}</span>{" "}
                      <span className="text-slate-400 dark:text-slate-500">{a.accountType}</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-actual-700 dark:text-actual-300">
                      {formatMoney(a.totalInflow)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {formatMoney(a.totalOutflow)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-800 dark:text-slate-100">
                      {formatMoneySigned(a.netMovement)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        a.currentBalance === null
                          ? "text-xs normal-case text-slate-400 dark:text-slate-500"
                          : "text-slate-900 dark:text-slate-100",
                      )}
                    >
                      {a.currentBalance === null
                        ? "not configured"
                        : formatMoney(a.currentBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartFrame>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame title="By category" subtitle="Outgoing">
          <PercentBars
            items={data.categoryBreakdown.map((c) => ({
              name: c.name,
              amount: c.amount,
              percent: c.percentOfSide,
              extra: `${c.txnCount}×`,
            }))}
            color={CHART_COLORS.slate}
          />
        </ChartFrame>
        <ChartFrame title="By payment method">
          <PercentBars
            items={data.paymentMethodAnalysis.map((p) => ({
              name: p.method,
              amount: p.amount,
              extra: `${p.txnCount}×`,
            }))}
            color={CHART_COLORS.sky}
          />
        </ChartFrame>
        <ChartFrame title="Largest transactions" subtitle="Top 5">
          {data.largestTransactions.length === 0 ? (
            <p className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              Nothing recorded.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {data.largestTransactions.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-slate-600 dark:text-slate-400">
                    {t.date} · {t.description ?? t.type}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-800 dark:text-slate-100">
                    {formatMoney(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Category trends" subtitle="Outgoing, last 6 months">
          <MoneyLineChart
            data={trendPivot(data.categoryTrends.map((t) => ({ category: t.category, months: t.months })))}
            xKey="month"
            series={data.categoryTrends.slice(0, 6).map((t, i) => ({
              key: t.category,
              name: t.category,
              color: Object.values(CHART_COLORS)[i % Object.keys(CHART_COLORS).length],
            }))}
          />
        </ChartFrame>
        <div className="space-y-4">
          <ChartFrame title="Previous month" subtitle="Neutral numbers">
            <dl className="space-y-1.5 text-sm">
              <Row label="Previous month" value={data.previousMonthComparison.previousMonth} />
              <Row label="Money in" value={formatMoney(data.previousMonthComparison.previousIn)} />
              <Row label="Money out" value={formatMoney(data.previousMonthComparison.previousOut)} />
            </dl>
          </ChartFrame>
          <AnalysisPanel title="Key insights">
            <InsightList insights={data.keyInsights} />
          </AnalysisPanel>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🤝 Splits weekly
// ---------------------------------------------------------------------------

function SplitsWeekly({ ref: refDate }: { ref: string }) {
  const { data, isLoading, isError, error } = useGetSplitsWeeklyQuery({
    ref: refDate,
  });
  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorPanel error={error} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Week {format(parseISO(data.weekStart), "d MMM")} –{" "}
        {format(parseISO(data.weekEnd), "d MMM yyyy")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="New split expenses"
          value={String(data.newSplitExpenseCount)}
          caption={formatMoney(data.newSplitExpenseTotal)}
        />
        <Stat
          label="Settlements"
          value={String(data.settlementCount)}
          caption={`${data.settlementsPaidByMe} paid by me · ${data.settlementsReceivedByMe} received`}
        />
        <Stat
          label="Net balance"
          value={formatMoneySigned(data.currentNetBalance)}
          tone={data.currentNetBalance < 0 ? "negative" : "positive"}
          caption="you owe vs owed to you, all history"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="You Owe (current)" value={formatMoney(data.currentYouOwe)} tone={data.currentYouOwe > 0 ? "negative" : "muted"} />
        <Stat label="Owed To You (current)" value={formatMoney(data.currentOwedToYou)} tone={data.currentOwedToYou > 0 ? "positive" : "muted"} />
      </div>

      <ChartFrame title="People overview" subtitle="net with me (all history)">
        {data.peopleOverview.length === 0 ? (
          <p className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            No people yet - add someone to start splitting.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {data.peopleOverview.map((p) => (
              <li key={p.personId} className="flex items-center justify-between gap-2 py-2">
                <span className="text-slate-700 dark:text-slate-300">{p.name}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    p.netWithMe > 0 ? "text-actual-700 dark:text-actual-300" : p.netWithMe < 0 ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {formatMoneySigned(p.netWithMe)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartFrame>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🤝 Splits monthly
// ---------------------------------------------------------------------------

function SplitsMonthly({ ref: month }: { ref: string }) {
  const { data, isLoading, isError, error } = useGetSplitsMonthlyQuery({
    ref: month,
  });
  if (isLoading) return <Loading rows={2} />;
  if (isError || !data) return <ErrorPanel error={error} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">{format(parseISO(`${data.month}-01`), "MMMM yyyy")}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="You Owe" value={formatMoney(data.moneyYouOwe)} tone={data.moneyYouOwe > 0 ? "negative" : "muted"} />
        <Stat label="Owed To You" value={formatMoney(data.moneyOwedToYou)} tone={data.moneyOwedToYou > 0 ? "positive" : "muted"} />
        <Stat
          label="Net Balance"
          value={formatMoneySigned(data.netBalance)}
          tone={data.netBalance < 0 ? "negative" : "positive"}
        />
        <Stat
          label="You fronted (lifetime)"
          value={formatMoney(data.moneyYouFronted)}
          caption="gross, before settlements"
        />
        <Stat
          label="Fronted for you (lifetime)"
          value={formatMoney(data.moneyFrontedForYou)}
          caption="gross, before settlements"
        />
        <Stat
          label="Settlement rate"
          value={formatPercent(data.settlementRatePercent)}
          tone={data.settlementRatePercent === null ? "muted" : "default"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New split expenses" value={String(data.newSplitExpenses.count)} caption={formatMoney(data.newSplitExpenses.total)} />
        <Stat label="Settlements" value={String(data.settlements.count)} caption={`${formatMoney(data.settlements.paidByMe)} paid · ${formatMoney(data.settlements.receivedByMe)} received`} />
        <Stat label="Prev expenses" value={String(data.previousMonthComparison.previousExpenseCount)} caption={formatMoney(data.previousMonthComparison.previousExpenseTotal)} />
        <Stat label="Prev settlements" value={String(data.previousMonthComparison.previousSettlementCount)} caption={formatMoney(data.previousMonthComparison.previousSettlementTotal)} />
      </div>

      <ChartFrame title="Debt trends" subtitle="Last 6 months">
        <MoneyBarChart
          data={data.debtTrends.map((t) => ({
            month: shortMonthLabel(t.month),
            newDebtCreated: t.newDebtCreated,
            settledAmount: t.settledAmount,
          }))}
          xKey="month"
          series={[
            { key: "newDebtCreated", name: "New debt", color: CHART_COLORS.red },
            { key: "settledAmount", name: "Settled", color: CHART_COLORS.actual },
          ]}
        />
      </ChartFrame>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Per person">
          {data.personBreakdown.length === 0 ? (
            <p className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              No shared activity.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {data.personBreakdown.map((p) => (
                <li key={p.personId} className="flex items-baseline justify-between gap-2 py-2">
                  <span className="text-slate-700 dark:text-slate-300">
                    {p.name}{" "}
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      · {p.sharedExpenseCount} shared
                    </span>
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      p.netWithMe > 0 ? "text-actual-700 dark:text-actual-300" : p.netWithMe < 0 ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500",
                    )}
                  >
                    {formatMoneySigned(p.netWithMe)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartFrame>
        <ChartFrame title="Groups">
          {data.groupBreakdown.length === 0 ? (
            <p className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              No group activity.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {data.groupBreakdown.map((g) => (
                <li key={g.groupId} className="flex items-baseline justify-between gap-2 py-2">
                  <span className="text-slate-700 dark:text-slate-300">
                    {g.name}{" "}
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      · {g.expenseCount} expenses
                    </span>
                  </span>
                  <span className="text-right text-xs text-slate-500 dark:text-slate-400">
                    <span className="block font-medium tabular-nums text-slate-800 dark:text-slate-100">
                      {formatMoney(g.totalAmount)}
                    </span>
                    my share {formatMoney(g.myShare)} · paid {formatMoney(g.myPaid)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Outstanding balances" subtitle="Every nonzero direction">
          {data.outstandingBalances.length === 0 ? (
            <p className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              All square.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {data.outstandingBalances.map((b, i) => (
                <li key={`${b.fromPersonId}-${b.toPersonId}-${i}`} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{b.fromPersonName}</span> →{" "}
                    <span className="font-medium text-slate-800 dark:text-slate-100">{b.toPersonName}</span>
                  </span>
                  <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                    {formatMoney(b.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartFrame>
        <AnalysisPanel title="Key insights">
          <InsightList insights={data.keyInsights} />
        </AnalysisPanel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="text-right">
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</span>
        {caption ? (
          <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500">{caption}</span>
        ) : null}
      </dd>
    </div>
  );
}

/** {category, months:[{month,outgoing}]}[] → [{month, [cat]: value}] */
function trendPivot(
  trends: { category: string; months: { month: string; outgoing: number }[] }[],
): Array<Record<string, string | number>> {
  const byMonth = new Map<string, Record<string, string | number>>();
  for (const t of trends) {
    for (const m of t.months) {
      const row = byMonth.get(m.month) ?? { month: shortMonthLabel(m.month) };
      row[t.category] = m.outgoing;
      byMonth.set(m.month, row);
    }
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
}
