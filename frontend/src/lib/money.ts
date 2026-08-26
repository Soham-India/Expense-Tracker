import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = number | string | Decimal;

/**
 * All API money values arrive as JSON numbers but are decimals semantically.
 * Every piece of arithmetic goes through decimal.js - never raw float math.
 */
export function money(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(typeof value === "string" ? value.trim() : value);
}

export function sumMoney(values: Array<MoneyInput>): Decimal {
  return values.reduce<Decimal>(
    (acc, v) => acc.plus(money(v)),
    new Decimal(0),
  );
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,23,456.00 (Indian grouping) */
export function formatMoney(value: MoneyInput): string {
  try {
    return inr.format(money(value).toNumber());
  } catch {
    return "\u20B90.00";
  }
}

/** "+₹1,000.00" / "-₹1,000.00" - for flows and deltas */
export function formatMoneySigned(value: MoneyInput): string {
  const d = money(value);
  const prefix = d.isPositive() && !d.isZero() ? "+" : "";
  return `${prefix}${formatMoney(d)}`;
}

/** Percentages arrive as plain numbers (e.g. 42.5 meaning 42.5%). null => "N/A" */
export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined) return "N/A";
  return `${money(value).toFixed(digits)}%`;
}

/** Renders a possibly-null balance the way §6.6 demands. */
export function formatBalanceOrNull(
  value: number | null | undefined,
): { text: string; configured: boolean } {
  if (value === null || value === undefined) {
    return { text: "balance not configured", configured: false };
  }
  return { text: formatMoney(value), configured: true };
}
