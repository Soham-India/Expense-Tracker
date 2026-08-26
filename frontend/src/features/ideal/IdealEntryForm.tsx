"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import {
  useAddIdealTransactionMutation,
  useUpdateIdealTransactionMutation,
} from "@/features/ideal/idealApi";
import { getApiError } from "@/lib/apiError";
import { todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { amountSchema, blankToUndefined, dateSchema } from "@/lib/validation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeQuickAdd, openStartMonth } from "@/store/slices/uiSlice";
import type {
  IdealTransactionRequest,
  IdealTransactionResponse,
  TransactionType,
} from "@/types/api";
import { cn } from "@/lib/cn";

const schema = z.object({
  type: z.enum(["INCOMING", "OUTGOING"]),
  amount: amountSchema,
  categoryId: z.string(),
  subcategoryId: z.string(),
  description: z.string().max(255, "Max 255 characters"),
  date: dateSchema,
  notes: z.string().max(2000, "Max 2000 characters"),
});

type Values = z.infer<typeof schema>;

const typeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: "INCOMING", label: "Incoming" },
  { value: "OUTGOING", label: "Outgoing" },
];

export interface IdealEntryFormProps {
  /** Standalone usage (e.g. /ideal page): explicit prefill instead of the Quick Add slice. */
  prefill?: Partial<IdealTransactionRequest>;
  /** When set the form PUTs instead of POSTs and initializes from this entry. */
  transaction?: IdealTransactionResponse;
  submitLabel?: string;
  /** Defaults keep the Quick Add behavior: close the modal / open month setup. */
  onSuccess?: () => void;
  onMonthMissing?: () => void;
}

export function IdealEntryForm({
  prefill: prefillProp,
  transaction,
  submitLabel,
  onSuccess,
  onMonthMissing,
}: IdealEntryFormProps) {
  const dispatch = useAppDispatch();
  const quickAddPrefill = useAppSelector((s) => s.ui.quickAdd.prefill?.ideal);
  const prefill = transaction ?? prefillProp ?? quickAddPrefill;
  const { data: categories = [] } = useGetCategoriesQuery();
  const [addEntry, { isLoading: adding }] = useAddIdealTransactionMutation();
  const [updateEntry, { isLoading: updating }] =
    useUpdateIdealTransactionMutation();
  const isLoading = adding || updating;

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
      type: prefill?.type ?? "OUTGOING",
      amount: prefill?.amount != null ? String(prefill.amount) : "",
      categoryId: prefill?.categoryId ?? "",
      subcategoryId: prefill?.subcategoryId ?? "",
      description: prefill?.description ?? "",
      date: prefill?.date ?? todayStr(),
      notes: prefill?.notes ?? "",
    },
  });

  const type = watch("type");
  const categoryId = watch("categoryId");

  // Scope gate (§3.2): IDEAL-scoped and BOTH categories are usable here.
  const usableCategories = categories.filter(
    (c) => !c.hidden && (c.scope === "BOTH" || c.scope === "IDEAL"),
  );
  const subcategories =
    usableCategories.find((c) => c.id === categoryId)?.subcategories ?? [];
  const usableSubcategories = subcategories.filter((s) => !s.hidden);

  function handleSuccess() {
    if (onSuccess) {
      onSuccess();
      return;
    }
    dispatch(closeQuickAdd());
  }

  function handleMonthMissing() {
    if (onMonthMissing) {
      onMonthMissing();
      return;
    }
    dispatch(closeQuickAdd());
    dispatch(openStartMonth());
  }

  async function onSubmit(values: Values) {
    const subcategoryId = usableSubcategories.some(
      (s) => s.id === values.subcategoryId,
    )
      ? values.subcategoryId
      : undefined;
    const body: IdealTransactionRequest = {
      type: values.type,
      amount: money(values.amount).toNumber(),
      categoryId: blankToUndefined(values.categoryId),
      subcategoryId,
      description: blankToUndefined(values.description),
      date: values.date,
      notes: blankToUndefined(values.notes),
    };
    try {
      if (transaction) {
        await updateEntry({ id: transaction.id, body }).unwrap();
        toast.success("Ideal entry updated");
      } else {
        await addEntry(body).unwrap();
        toast.success(
          values.type === "INCOMING"
            ? "Ideal incoming added"
            : "Ideal outgoing added",
        );
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
      // "No Ideal month started for yyyy-MM" - route straight to month setup.
      if (info.status === 404) {
        handleMonthMissing();
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={type === opt.value}
            onClick={() => setValue("type", opt.value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
              type === opt.value
                ? "border-ideal-500 bg-ideal-50 dark:bg-ideal-500/10 text-ideal-700 dark:text-ideal-300"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Input
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        autoFocus
        error={errors.amount?.message}
        {...register("amount")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Category" error={errors.categoryId?.message} {...register("categoryId")}>
          <option value="">None</option>
          {usableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          label="Subcategory"
          error={errors.subcategoryId?.message}
          disabled={!categoryId}
          {...register("subcategoryId")}
        >
          <option value="">None</option>
          {usableSubcategories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Description"
        placeholder="e.g. Groceries"
        maxLength={255}
        error={errors.description?.message}
        {...register("description")}
      />

      <Input
        label="Date"
        type="date"
        required
        error={errors.date?.message}
        {...register("date")}
      />

      <Textarea
        label="Notes"
        maxLength={2000}
        error={errors.notes?.message}
        {...register("notes")}
      />

      <Button type="submit" loading={isLoading} className="w-full">
        {submitLabel ?? (transaction ? "Save changes" : "Add Ideal entry")}
      </Button>
    </form>
  );
}
