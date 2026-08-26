"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import {
  useAddActualTransactionMutation,
  useGetAccountsQuery,
  useUpdateActualTransactionMutation,
} from "@/features/actual/actualApi";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import { getApiError } from "@/lib/apiError";
import { todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { amountSchema, blankToUndefined, dateSchema } from "@/lib/validation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeQuickAdd } from "@/store/slices/uiSlice";
import type {
  ActualTransactionRequest,
  ActualTransactionResponse,
  ActualTransactionType,
  PaymentMethod,
} from "@/types/api";
import { cn } from "@/lib/cn";

const schema = z
  .object({
    type: z.enum(["INCOMING", "OUTGOING", "TRANSFER"]),
    amount: amountSchema,
    categoryId: z.string(),
    subcategoryId: z.string(),
    accountId: z.string(),
    transferToAccountId: z.string(),
    paymentMethod: z.string(),
    description: z.string().max(255, "Max 255 characters"),
    date: dateSchema,
    notes: z.string().max(2000, "Max 2000 characters"),
  })
  .refine(
    (v) =>
      v.type !== "TRANSFER" ||
      (v.accountId !== "" &&
        v.transferToAccountId !== "" &&
        v.accountId !== v.transferToAccountId),
    {
      message: "Pick two different accounts for a transfer",
      path: ["transferToAccountId"],
    },
  );

type Values = z.infer<typeof schema>;

const typeOptions: Array<{ value: ActualTransactionType; label: string }> = [
  { value: "INCOMING", label: "In" },
  { value: "OUTGOING", label: "Out" },
  { value: "TRANSFER", label: "Transfer" },
];

const paymentMethods: PaymentMethod[] = ["UPI", "CASH", "CARD", "NETBANKING", "OTHER"];

export interface ActualTransactionFormProps {
  /** Standalone usage (e.g. /actual page): explicit prefill instead of the Quick Add slice. */
  prefill?: Partial<ActualTransactionRequest>;
  /** When set the form PUTs instead of POSTs and initializes from this transaction. */
  transaction?: ActualTransactionResponse;
  submitLabel?: string;
  /** Defaults keep the Quick Add behavior: close the modal. */
  onSuccess?: () => void;
}

export function ActualTransactionForm({
  prefill: prefillProp,
  transaction,
  submitLabel,
  onSuccess,
}: ActualTransactionFormProps) {
  const dispatch = useAppDispatch();
  const quickAddPrefill = useAppSelector((s) => s.ui.quickAdd.prefill?.actual);
  const prefill = transaction ?? prefillProp ?? quickAddPrefill;
  const { data: accountsData } = useGetAccountsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const [addTxn, { isLoading: adding }] = useAddActualTransactionMutation();
  const [updateTxn, { isLoading: updating }] =
    useUpdateActualTransactionMutation();
  const isLoading = adding || updating;

  const accounts = (accountsData?.accounts ?? []).filter((a) => !a.archived);

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
      accountId: prefill?.accountId ?? "",
      transferToAccountId: prefill?.transferToAccountId ?? "",
      paymentMethod: prefill?.paymentMethod ?? "",
      description: prefill?.description ?? "",
      date: prefill?.date ?? todayStr(),
      notes: prefill?.notes ?? "",
    },
  });

  const type = watch("type");
  const categoryId = watch("categoryId");
  const isTransfer = type === "TRANSFER";

  // Scope gate (§3.2): ACTUAL-scoped and BOTH categories are usable here.
  const usableCategories = categories.filter(
    (c) => !c.hidden && (c.scope === "BOTH" || c.scope === "ACTUAL"),
  );
  const usableSubcategories = (
    usableCategories.find((c) => c.id === categoryId)?.subcategories ?? []
  ).filter((s) => !s.hidden);

  function handleSuccess() {
    if (onSuccess) {
      onSuccess();
      return;
    }
    dispatch(closeQuickAdd());
  }

  async function onSubmit(values: Values) {
    const subcategoryId = usableSubcategories.some(
      (s) => s.id === values.subcategoryId,
    )
      ? values.subcategoryId
      : undefined;
    const body: ActualTransactionRequest = {
      type: values.type,
      amount: money(values.amount).toNumber(),
      // Transfers must not carry category fields (server 400s otherwise).
      categoryId: !isTransfer ? blankToUndefined(values.categoryId) : undefined,
      subcategoryId: !isTransfer ? subcategoryId : undefined,
      accountId: blankToUndefined(values.accountId),
      transferToAccountId: isTransfer
        ? values.transferToAccountId
        : undefined,
      paymentMethod: !isTransfer
        ? (blankToUndefined(values.paymentMethod) as PaymentMethod | undefined)
        : undefined,
      description: blankToUndefined(values.description),
      date: values.date,
      notes: blankToUndefined(values.notes),
    };
    try {
      if (transaction) {
        await updateTxn({ id: transaction.id, body }).unwrap();
        toast.success("Transaction updated");
      } else {
        await addTxn(body).unwrap();
        toast.success(
          values.type === "TRANSFER"
            ? "Transfer recorded"
            : values.type === "INCOMING"
              ? "Income recorded"
              : "Expense recorded",
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
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type">
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
                ? "border-actual-500 bg-actual-50 dark:bg-actual-500/10 text-actual-700 dark:text-actual-300"
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

      {isTransfer ? (
        <p className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          Transfers are not income or expense - money moving between your own
          accounts. They never appear in Money In / Money Out.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={isTransfer ? "From account" : "Account"}
          error={errors.accountId?.message}
          {...register("accountId")}
        >
          <option value="">None</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        {isTransfer ? (
          <Select
            label="To account"
            error={errors.transferToAccountId?.message}
            {...register("transferToAccountId")}
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        ) : (
          <Select label="Payment method" error={errors.paymentMethod?.message} {...register("paymentMethod")}>
            <option value="">None</option>
            {paymentMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!isTransfer ? (
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
      ) : null}

      <Input
        label="Description"
        placeholder="e.g. Salary, rent"
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
        {submitLabel ?? (transaction ? "Save changes" : "Record transaction")}
      </Button>
    </form>
  );
}
