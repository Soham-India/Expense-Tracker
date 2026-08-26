import { z } from "zod";
import { isValidDateString } from "@/lib/dates";
import { money } from "@/lib/money";

/**
 * Money arrives at the API as a JSON number with up to 2 decimals.
 * Forms keep amounts as strings (no float input quirks) and convert
 * through decimal.js on submit.
 */
export const amountSchema = z
  .string()
  .min(1, "Amount is required")
  .regex(/^\d{1,13}(\.\d{1,2})?$/, "Use digits with up to 2 decimals")
  .refine((v) => money(v).greaterThan(0), "Must be greater than 0");

export const dateSchema = z
  .string()
  .min(1, "Date is required")
  .refine(isValidDateString, "Use format yyyy-MM-dd");

/** "" -> undefined so optional IDs/notes are omitted from request bodies. */
export function blankToUndefined(v: string | undefined): string | undefined {
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}
