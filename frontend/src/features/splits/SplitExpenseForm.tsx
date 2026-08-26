"use client";

import { useEffect, useMemo } from "react";
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
} from "@/features/splits/splitsApi";
import { getApiError } from "@/lib/apiError";
import { todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { amountSchema, blankToUndefined, dateSchema } from "@/lib/validation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeQuickAdd } from "@/store/slices/uiSlice";
import { cn } from "@/lib/cn";

const schema = z
  .object({
    description: z.string().max(255, "Max 255 characters"),
    totalAmount: amountSchema,
    date: dateSchema,
    groupId: z.string(),
    participants: z
      .array(z.string())
      .min(1, "Pick at least one participant"),
    payerId: z.string().min(1, "Pick who fronted the money"),
  })
  .refine((v) => v.participants.includes(v.payerId), {
    message: "The payer must be a participant",
    path: ["payerId"],
  });

type Values = z.infer<typeof schema>;

/**
 * Simplified EQUAL split for Quick Add: one person fronts the total,
 * the server divides it equally (largest-remainder cents). The full
 * EXACT/PERCENTAGE/SHARE editor lives on the Splits page (Checkpoint 5).
 */
export function SplitExpenseForm() {
  const dispatch = useAppDispatch();
  const prefill = useAppSelector((s) => s.ui.quickAdd.prefill?.splits);
  const { data: people = [], isLoading: peopleLoading } = useGetPeopleQuery();
  const { data: groups = [] } = useGetGroupsQuery();
  const [addExpense, { isLoading }] = useAddSplitExpenseMutation();

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
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: prefill?.description ?? "",
      totalAmount: prefill?.totalAmount != null ? String(prefill.totalAmount) : "",
      date: prefill?.date ?? todayStr(),
      groupId: prefill?.groupId ?? "",
      participants: prefill?.participants?.map((p) => p.personId) ?? [],
      payerId: "",
    },
  });

  // Default participants/payer resolve after people load (self first).
  useEffect(() => {
    if (peopleLoading || !self) return;
    const current = new Set(watch("participants"));
    if (current.size === 0) {
      const defaults = prefill?.participants?.map((p) => p.personId) ?? [self.id];
      setValue("participants", defaults);
      const fronted = prefill?.participants?.find(
        (p) => (p.paidAmount ?? 0) > 0,
      );
      setValue("payerId", fronted?.personId ?? self.id);
    } else if (!watch("payerId")) {
      const fronted = prefill?.participants?.find(
        (p) => (p.paidAmount ?? 0) > 0,
      );
      setValue("payerId", fronted?.personId ?? self.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleLoading, self]);

  const participants = watch("participants");
  const payerId = watch("payerId");

  const checked = activePeople.filter((p) => participants.includes(p.id));

  function toggleParticipant(id: string) {
    const next = participants.includes(id)
      ? participants.filter((p) => p !== id)
      : [...participants, id];
    setValue("participants", next);
    if (!next.includes(payerId)) {
      setValue("payerId", self && next.includes(self.id) ? self.id : (next[0] ?? ""));
    }
  }

  async function onSubmit(values: Values) {
    if (!self) return;
    const total = money(values.totalAmount);
    try {
      await addExpense({
        groupId: blankToUndefined(values.groupId),
        createdByPersonId: self.id,
        description: blankToUndefined(values.description),
        totalAmount: total.toNumber(),
        splitMethod: "EQUAL",
        date: values.date,
        participants: values.participants.map((personId) => ({
          personId,
          paidAmount:
            personId === values.payerId ? total.toNumber() : 0,
        })),
      }).unwrap();
      toast.success("Split expense added");
      dispatch(closeQuickAdd());
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

  if (peopleLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
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
        placeholder="e.g. Dinner, cab fare"
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

      <Select label="Group (optional)" error={errors.groupId?.message} {...register("groupId")}>
        <option value="">No group</option>
        {activeGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Participants <span className="text-red-500">*</span>
        </legend>
        {errors.participants ? (
          <p className="mb-1 text-xs text-red-600 dark:text-red-400">
            {errors.participants.message}
          </p>
        ) : null}
        <div className="grid gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 p-2">
          {activePeople.map((p) => {
            const checkedNow = participants.includes(p.id);
            return (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <input
                  type="checkbox"
                  checked={checkedNow}
                  onChange={() => toggleParticipant(p.id)}
                  className="size-4 accent-splits-600"
                />
                <span className="text-slate-800 dark:text-slate-100">
                  {p.name}
                  {p.self ? (
                    <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">(you)</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Select
        label="Fronted by (paid the full amount)"
        error={errors.payerId?.message}
        {...register("payerId")}
      >
        {checked.map((p) => (
          <option key={p.id} value={p.id}>
            {p.self ? "You" : p.name}
          </option>
        ))}
      </Select>
      <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
        Split equally; everyone else owes the payer their share.
      </p>

      <Button
        type="submit"
        loading={isLoading}
        disabled={checked.length === 0}
        className={cn("w-full")}
      >
        Add split expense
      </Button>
    </form>
  );
}
