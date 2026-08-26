import {
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from "date-fns";

export type DateString = string; // yyyy-MM-dd
export type MonthString = string; // yyyy-MM

export function todayStr(): DateString {
  return format(new Date(), "yyyy-MM-dd");
}

export function currentMonthStr(): MonthString {
  return format(new Date(), "yyyy-MM");
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isValid(parseISO(value));
}

export function isValidMonthString(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  return isValid(parseISO(`${value}-01`));
}

/** "2026-08-12" -> "12 Aug 2026" */
export function formatDateLabel(value: DateString): string {
  const d = parseISO(value);
  return isValid(d) ? format(d, "dd MMM yyyy") : value;
}

/** "2026-08" -> "August 2026" */
export function formatMonthLabel(value: MonthString): string {
  const d = parseISO(`${value}-01`);
  return isValid(d) ? format(d, "MMMM yyyy") : value;
}

/** Monday-start week containing the given date, as yyyy-MM-dd. */
export function weekStartOf(date: Date): DateString {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function monthBounds(month: MonthString): {
  start: DateString;
  end: DateString;
} {
  const base = parseISO(`${month}-01`);
  return {
    start: format(base, "yyyy-MM-dd"),
    end: format(endOfMonth(base), "yyyy-MM-dd"),
  };
}
