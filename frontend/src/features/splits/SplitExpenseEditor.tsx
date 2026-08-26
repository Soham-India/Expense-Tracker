"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import {
  useAddSplitExpenseMutation,
  useGetGroupsQuery,
  useGetPeopleQuery,
  useUpdateSplitExpenseMutation,
} from "@/features/splits/splitsApi";
import { getApiError } from "@/lib/apiError";
import { todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { amountSchema, blankToUndefined, dateSchema } from "@/lib/validation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeQuickAdd } from "@/store/slices/uiSlice";
import type {
  SplitExpenseResponse,
  SplitMethod,
  SplitParticipantInput,
} from "@/types/api";
import { cn } from "@/lib/cn";

const methodOptions: Array<{ id: SplitMethod; label: string; shareLabel: string }> = [
  { id: "EQUAL", label: "Equal", shareLabel: "Equal" },
  { id: "EXACT", label: "Exact", shareLabel: "Exact ₹" },
  { id: "PERCENTAGE", label: "Percent", shareLabel: "Percent %" },
  { id: "SHARE", label: "Shares", shareLabel: "Units" },
];

interface RowValues {
  personId: string;
  checked: boolean;
  paid: string;
  share: string;
}

const formSchema = z
  .object({
    description: z.string().max(255, "Max 255 characters"),
    totalAmount: amountSchema,
    date: dateSchema,
    groupId: z.string(),
    splitMethod: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARE"]),
    rows: z.array(
      z.object({
        personId: z.string(),
        checked: z.boolean(),
        paid: z.string().regex(/^\d{0,13}(\.\d{1,2})?$/, "Use digits"),
        share: z.string().regex(/^\d{0,13}(\.\d{1,4})?$/, "Use digits"),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const checked = v.rows.filter((r) => r.checked);
    if (checked.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Pick at least one participant",
        path: ["rows"],
      });
      return;
    }
    if (v.splitMethod === "EQUAL") return;
    const total = money(v.totalAmount);
    const sum = checked.reduce(
      (acc, r) => acc.plus(r.share === "" ? 0 : money(r.share)),
      money(0),
    );
    if (v.splitMethod === "EXACT" && !sum.equals(total)) {
      ctx.addIssue({
        code: "custom",
        message: `Exact shares must sum to the total (${total.toFixed(2)}), currently ${sum.toFixed(2)}`,
        path: ["rows"],
      });
    }
    if (v.splitMethod === "PERCENTAGE" && !sum.equals(100)) {
      ctx.addIssue({
        code: "custom",
        message: `Percentages must sum to exactly 100, currently ${sum.toFixed(2)}`,
        path: ["rows"],
      });
    }
    if (v.splitMethod === "SHARE" && sum.lessThanOrEqualTo(0)) {
      ctx.addIssue({
        code: "custom",
        message: "Total share units must be greater than 0",
        path: ["rows"],
      });
    }
  });

type Values = z.infer<typeof formSchema>;

export interface SplitExpenseEditorProps {
  /** Edit mode: PUT (full replace, re-splits) instead of POST. */
  expense?: SplitExpenseResponse;
  prefill?: Partial<Record<"date" | "groupId" | "description", string>> & {
    totalAmount?: number;
  };
  submitLabel?: string;
  /** Defaults keep the Quick Add behavior: close the modal. */
  onSuccess?: () => void;
}

/**
 * Full split editor: all four methods with per-participant paid amounts.
 * The server computes canonical shareAmounts - client math is validation only.
 */
export function SplitExpenseEditor({
  expense,
  prefill,
  submitLabel,
  onSuccess,
}: SplitExpenseEditorProps) {
  const dispatch = useAppDispatch();
  const quickAddPrefill = useAppSelector((s) => s.ui.quickAdd.prefill?.splits);
  const { data: people = [], isLoading: peopleLoading } = useGetPeopleQuery();
  const { data: groups = [] } = useGetGroupsQuery();
  const [addExpense, { isLoading: adding }] = useAddSplitExpenseMutation();
  const [updateExpense, { isLoading: updating }] =
    useUpdateSplitExpenseMutation();
  const isLoading = adding || updating;

  const activePeople = useMemo(
    () =>
      [...people.filter((p) => !p.archived)].sort(
        (a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name),
      ),
    [people],
  );
  const self = people.find((p) => p.self && !p.archived);
  const activeGroups = groups.filter((g) => g.status === "ACTIVE");

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description:
        expense?.description ?? prefill?.description ?? quickAddPrefill?.description ?? "",
      totalAmount:
        expense?.totalAmount != null
          ? String(expense.totalAmount)
          : prefill?.totalAmount != null
            ? String(prefill.totalAmount)
            : quickAddPrefill?.totalAmount != null
              ? String(quickAddPrefill.totalAmount)
              : "",
      date: expense?.date ?? prefill?.date ?? quickAddPrefill?.date ?? todayStr(),
      groupId: expense?.groupId ?? prefill?.groupId ?? quickAddPrefill?.groupId ?? "",
      splitMethod: expense?.splitMethod ?? "EQUAL",
      rows: [],
    },
  });

  // Rows depend on the async people list - build them once when it arrives.
  const [rowsReady, setRowsReady] = useState(false);
  useEffect(() => {
    if (peopleLoading || rowsReady || activePeople.length === 0) return;
    const respById = new Map(
      expense?.participants.map((p) => [p.personId, p]) ?? [],
    );
    const inputById = new Map(
      (quickAddPrefill?.participants ?? []).map((p) => [p.personId, p]),
    );
    reset({
      description: watch("description"),
      totalAmount: watch("totalAmount"),
      date: watch("date"),
      groupId: watch("groupId"),
      splitMethod: watch("splitMethod"),
      rows: activePeople.map((p) => {
        const resp = respById.get(p.id);
        const inp = inputById.get(p.id);
        const share = resp
          ? expense?.splitMethod === "PERCENTAGE"
            ? resp.splitPercentage
            : expense?.splitMethod === "SHARE"
              ? resp.splitUnits
              : expense?.splitMethod === "EXACT"
                ? resp.shareAmount
                : null
          : null;
        const paid = resp?.paidAmount ?? inp?.paidAmount;
        return {
          personId: p.id,
          checked: resp != null || inp != null || (!expense && p.self),
          paid: paid != null ? String(paid) : "",
          share: share != null ? String(share) : "",
        };
      }),
    });
    setRowsReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleLoading, rowsReady, activePeople, expense]);

  const rows = watch("rows");
  const method = watch("splitMethod");
  const activeMethod = methodOptions.find((m) => m.id === method)!;
  const checkedRows = rows.filter((r) => r.checked);
  const shareSum = checkedRows.reduce(
    (acc, r) => acc.plus(r.share === "" ? 0 : money(r.share)),
    money(0),
  );

  function setRow(personId: string, patch: Partial<RowValues>) {
    setValue(
      "rows",
      rows.map((r) => (r.personId === personId ? { ...r, ...patch } : r)),
    );
  }

  function handleSuccess() {
    if (onSuccess) {
      onSuccess();
      return;
    }
    dispatch(closeQuickAdd());
  }

  async function onSubmit(values: Values) {
    if (!self) return;
    const participants: SplitParticipantInput[] = values.rows
      .filter((r) => r.checked)
      .map((r) => ({
        personId: r.personId,
        paidAmount: r.paid === "" ? 0 : money(r.paid).toNumber(),
        shareValue:
          values.splitMethod !== "EQUAL" && r.share !== ""
            ? money(r.share).toNumber()
            : undefined,
      }));
    const body = {
      groupId: blankToUndefined(values.groupId),
      createdByPersonId: expense?.createdByPersonId ?? self.id,
      description: blankToUndefined(values.description),
      totalAmount: money(values.totalAmount).toNumber(),
      splitMethod: values.splitMethod,
      date: values.date,
      participants,
    };
    try {
      if (expense) {
        await updateExpense({ id: expense.id, body }).unwrap();
        toast.success("Split expense updated");
      } else {
        await addExpense(body).unwrap();
        toast.success("Split expense added");
      }
      handleSuccess();
    } catch (err) {
      const info = getApiError(err);
      if (info.fieldErrors) {
        for (const [field, message] of Object.entries(info.fieldErrors)) {
          setError(field as keyof Values, { message });
        }
      }
      toast.error(info.message);
    }
  }

  if (peopleLoading || !rowsReady) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!self) {
    return (
      <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
        Your self record is missing - reload the page or log in again.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        label="Description"
        placeholder="e.g. Flatmate groceries"
        maxLength={255}
        autoFocus
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Total amount"
          inputMode="decimal"
          placeholder="0.00"
          required
          error={errors.totalAmount?.message}
          {...register("totalAmount")}
        />
        <Input
          label="Date"
          type="date"
          required
          error={errors.date?.message}
          {...register("date")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Group (optional)" {...register("groupId")}>
          <option value="">No group</option>
          {activeGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select label="Split method" {...register("splitMethod")}>
          {methodOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Participants <span className="text-red-500">*</span>
        </legend>
        {typeof errors.rows?.message === "string" ? (
          <p className="mb-1 text-xs text-red-600 dark:text-red-400">{errors.rows.message}</p>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-[auto_1fr_5.5rem_5.5rem] items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <span className="w-4" />
            <span>Person</span>
            <span>Paid ₹</span>
            <span>{activeMethod.shareLabel}</span>
          </div>
          {rows.map((row, idx) => {
            const person = activePeople.find((p) => p.id === row.personId);
            if (!person) return null;
            return (
              <div
                key={row.personId}
                className="grid grid-cols-[auto_1fr_5.5rem_5.5rem] items-center gap-2 border-b border-slate-50 dark:border-slate-800 px-3 py-1.5 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) => setRow(row.personId, { checked: e.target.checked })}
                  className="size-4 accent-splits-600"
                  aria-label={`Include ${person.name}`}
                />
                <span className="truncate text-sm text-slate-800 dark:text-slate-100">
                  {person.name}
                  {person.self ? (
                    <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">(you)</span>
                  ) : null}
                </span>
                <input
                  {...register(`rows.${idx}.paid` as const)}
                  inputMode="decimal"
                  placeholder="0"
                  className={cn(fieldBox, !row.checked && "opacity-40")}
                  aria-label={`Amount ${person.name} paid`}
                />
                {method === "EQUAL" ? (
                  <span className="text-center text-xs text-slate-300 dark:text-slate-600">—</span>
                ) : (
                  <input
                    {...register(`rows.${idx}.share` as const)}
                    inputMode="decimal"
                    placeholder={method === "PERCENTAGE" ? "0%" : "0"}
                    className={cn(fieldBox, !row.checked && "opacity-40")}
                    aria-label={`${activeMethod.shareLabel} for ${person.name}`}
                  />
                )}
              </div>
            );
          })}
        </div>
        {method !== "EQUAL" ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Current sum: {shareSum.toFixed(2)}
            {method === "EXACT" ? ` / ${watch("totalAmount") || "?"}` : ""}
            {method === "PERCENTAGE" ? " / 100" : ""}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Split equally; the server distributes the remainder to the cent.
          </p>
        )}
      </fieldset>

      <Button type="submit" loading={isLoading} className="w-full">
        {submitLabel ?? (expense ? "Save changes" : "Add split expense")}
      </Button>
    </form>
  );
}

const fieldBox =
  "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-right text-sm tabular-nums placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-splits-200 dark:focus:ring-splits-500/25 focus:border-splits-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/50";
