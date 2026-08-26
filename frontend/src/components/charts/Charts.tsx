"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneySigned } from "@/lib/money";
import { cn } from "@/lib/cn";

export const CHART_COLORS = {
  ideal: "#7c3aed",
  actual: "#059669",
  splits: "#d97706",
  slate: "#64748b",
  sky: "#0284c7",
  red: "#dc2626",
};

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

const axisStyle = {
  fontSize: 11,
  fill: "var(--chart-tick)",
};

const tooltipStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--chart-tooltip-border)",
  backgroundColor: "var(--chart-tooltip-bg)",
  color: "var(--chart-tooltip-text)",
  fontSize: 12,
};

function tooltipFormatter(value: unknown): string {
  const n = Array.isArray(value) ? value[0] : value;
  return typeof n === "number" ? formatMoney(n) : String(n ?? "");
}

/** Compact ₹ label for Y axis (e.g. ₹12k) */
function yTickFormatter(v: number): string {
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${v}`;
}

export function ChartFrame({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </h2>
      {subtitle ? (
        <p className="mb-2 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          {subtitle}
        </p>
      ) : (
        <div className="mb-1" />
      )}
      {children}
    </section>
  );
}

export function MoneyBarChart({
  data,
  xKey,
  series,
  height = 220,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: SeriesDef[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={yTickFormatter}
          />
          <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoneyLineChart({
  data,
  xKey,
  series,
  height = 220,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: SeriesDef[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={yTickFormatter}
          />
          <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal percent bars for category-style breakdowns (no Recharts needed). */
export function PercentBars({
  items,
  color,
}: {
  items: { name: string; amount: number; percent?: number | null; extra?: string }[];
  color: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400 dark:bg-slate-800/50 dark:text-slate-500">
        Nothing to break down yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.name}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">
              {it.name}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
              {formatMoney(it.amount)}
              {it.percent != null ? ` · ${it.percent.toFixed(1)}%` : ""}
              {it.extra ? ` · ${it.extra}` : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, it.percent ?? 0)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Stat card used across report pages. */
export function Stat({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
  caption?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          tone === "positive" && "text-actual-700 dark:text-actual-400",
          tone === "negative" && "text-red-600 dark:text-red-400",
          tone === "muted" && "text-slate-400 dark:text-slate-500",
          (!tone || tone === "default") &&
            "text-slate-900 dark:text-slate-100",
        )}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function signedMoney(value: number): string {
  return formatMoneySigned(value);
}
