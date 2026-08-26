"use client";

import { useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { CompareIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGetComparisonQuery } from "@/features/reports/reportsApi";
import { getApiError } from "@/lib/apiError";
import { currentMonthStr } from "@/lib/dates";
import { formatMoney, formatMoneySigned, formatPercent } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Ideal-vs-Actual comparison. The `note` strings come from the API and are
 * rendered verbatim - the UI never writes "you overspent" (golden rule §1).
 */
export default function ComparePage() {
  const [month, setMonth] = useState(currentMonthStr());
  const { data, isLoading, isError, error } = useGetComparisonQuery({ ref: month });

  function shiftMonth(delta: number) {
    const base = parseISO(`${month}-01`);
    setMonth(format(delta > 0 ? addMonths(base, 1) : subMonths(base, 1), "yyyy-MM"));
  }

  return (
    <>
      <PageHeader
        title="Compare"
        subtitle="Ideal next to Actual - neutral wording, no verdicts."
        icon={<CompareIcon />}
      />

      <div className="mb-4 flex items-center gap-1">
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

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : isError || !data ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {getApiError(error).message}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
                <th className="px-4 py-3 font-medium uppercase tracking-wide">Metric</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                  <span className="text-ideal-600 dark:text-ideal-400">Ideal</span>
                </th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide">
                  <span className="text-actual-600 dark:text-actual-400">Actual</span>
                </th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide">Difference</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide">%</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.rows.map((row) => (
                <tr key={row.metric}>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.metric}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ideal-700 dark:text-ideal-300">
                    {formatMoney(row.ideal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-actual-700 dark:text-actual-300">
                    {formatMoney(row.actual)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right tabular-nums",
                      row.difference < 0 ? "text-slate-700 dark:text-slate-300" : "text-slate-800 dark:text-slate-100",
                    )}
                  >
                    {formatMoneySigned(row.difference)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {formatPercent(row.differencePercent)}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {row.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
