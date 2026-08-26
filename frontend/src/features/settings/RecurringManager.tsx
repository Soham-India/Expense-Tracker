"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { useGetAccountsQuery } from "@/features/actual/actualApi";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import {
  useConfirmRecurringMutation,
  useCreateRecurringMutation,
  useDeleteRecurringMutation,
  useGetRecurringQuery,
  usePrepareRecurringQuery,
  useUpdateRecurringMutation,
} from "@/features/recurring/recurringApi";
import { getApiError } from "@/lib/apiError";
import { currentMonthStr } from "@/lib/dates";
import { formatMoney, money } from "@/lib/money";
import { amountSchema, blankToUndefined } from "@/lib/validation";
import { cn } from "@/lib/cn";
import type { RecurringDomain, RecurringEntryResponse } from "@/types/api";

const templateSchema = z.object({
  domain: z.enum(["IDEAL", "ACTUAL"]),
  type: z.enum(["INCOMING", "OUTGOING"]),
  amount: amountSchema,
  description: z.string().min(1, "Description is required").max(255, "Max 255 characters"),
  dayOfMonth: z
    .string()
    .regex(/^(?:[1-9]|[12]\d|3[01])$/, "Day of month 1-31"),
  categoryId: z.string(),
  subcategoryId: z.string(),
  accountId: z.string(),
  isActive: z.boolean(),
});

type Values = z.infer<typeof templateSchema>;

export function RecurringManager() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringEntryResponse | null>(null);
  const [deleting, setDeleting] = useState<RecurringEntryResponse | null>(null);
  const [prepareMonth, setPrepareMonth] = useState(currentMonthStr());

  const { data: templates = [], isLoading } = useGetRecurringQuery();
  const [updateRecurring] = useUpdateRecurringMutation();
  const [deleteRecurring, { isLoading: deletingLoading }] =
    useDeleteRecurringMutation();
  const [confirmRecurring, { isLoading: confirming }] =
    useConfirmRecurringMutation();
  const {
    data: prepare,
    isFetching: preparing,
    isError: prepareError,
    error: prepareErr,
  } = usePrepareRecurringQuery(prepareMonth);

  async function toggleActive(t: RecurringEntryResponse) {
    try {
      await updateRecurring({
        id: t.id,
        body: {
          domain: t.domain,
          type: t.type,
          amount: t.amount,
          categoryId: t.categoryId ?? undefined,
          subcategoryId: t.subcategoryId ?? undefined,
          accountId: t.accountId ?? undefined,
          description: t.description,
          dayOfMonth: t.dayOfMonth,
          isActive: !t.isActive,
        },
      }).unwrap();
      toast.success(t.isActive ? "Template paused" : "Template resumed");
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  async function confirm(t: RecurringEntryResponse) {
    try {
      await confirmRecurring({ id: t.id, month: prepareMonth }).unwrap();
      toast.success(`Posted to ${prepareMonth}`);
    } catch (err) {
      // 409 already confirmed · 404 month missing · 400 paused
      toast.error(getApiError(err).message);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteRecurring(deleting.id).unwrap();
      toast.success("Template deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  const prepareById = new Map(
    (prepare?.templates ?? []).map((t) => [t.templateId, t]),
  );

  return (
    <section aria-label="Recurring templates">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Recurring templates
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Never auto-posts - preview a month, then confirm each entry
            explicitly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            Prepare for
            <input
              type="month"
              value={prepareMonth}
              onChange={(e) => setPrepareMonth(e.target.value || currentMonthStr())}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
            />
          </label>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Add template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No templates yet - e.g. &quot;Rent, outgoing, 1st of every month&quot;.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {templates.map((t) => {
            const prep = prepareById.get(t.id);
            const blocked = !!prep?.blockReason || prep?.alreadyConfirmed;
            return (
              <li key={t.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      t.domain === "IDEAL"
                        ? "bg-ideal-50 dark:bg-ideal-500/10 text-ideal-700 dark:text-ideal-300"
                        : "bg-actual-50 dark:bg-actual-500/10 text-actual-700 dark:text-actual-300",
                    )}
                  >
                    {t.domain}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      t.type === "INCOMING"
                        ? "bg-actual-50 dark:bg-actual-500/10 text-actual-700 dark:text-actual-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                    )}
                  >
                    {t.type}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {t.description}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(t.amount)}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    day {t.dayOfMonth}
                    {t.categoryName ? ` · ${t.categoryName}` : ""}
                    {t.accountName ? ` · ${t.accountName}` : ""}
                    {t.lastConfirmedMonth
                      ? ` · last: ${format(parseISO(t.lastConfirmedMonth), "MMM yyyy")}`
                      : ""}
                  </span>
                  {!t.isActive ? (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      paused
                    </span>
                  ) : null}
                  <span className="ml-auto flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(t)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
                    >
                      Delete
                    </button>
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-50 dark:border-slate-800 pt-2 text-xs">
                  <button
                    onClick={() => toggleActive(t)}
                    className="font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    {t.isActive ? "Pause" : "Resume"}
                  </button>
                  {prep ? (
                    <>
                      <span className="text-slate-400 dark:text-slate-500">
                        {formatMonthLabelShort(prep.targetDate)}
                        {prep.alreadyConfirmed ? " · already confirmed" : ""}
                        {prep.blockReason ? ` · ${prep.blockReason}` : ""}
                      </span>
                      <Button
                        size="sm"
                        loading={confirming}
                        disabled={!t.isActive || blocked}
                        onClick={() => confirm(t)}
                      >
                        Confirm for {format(parseISO(`${prepareMonth}-01`), "MMM yyyy")}
                      </Button>
                    </>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">
                      {preparing
                        ? "Checking month…"
                        : prepareError
                          ? getApiError(prepareErr).message
                          : "Pick a month above to prepare"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TemplateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <TemplateDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onClose={() => setEditing(null)}
        template={editing ?? undefined}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletingLoading}
        title="Delete template?"
        message={`"${deleting?.description}" will stop recurring. Already-posted entries are kept.`}
      />
    </section>
  );
}

function formatMonthLabelShort(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM yyyy");
}

function TemplateDialog({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  template?: RecurringEntryResponse;
}) {
  const [createRecurring, { isLoading: creating }] = useCreateRecurringMutation();
  const [updateRecurring, { isLoading: updating }] = useUpdateRecurringMutation();
  const isLoading = creating || updating;

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accountsData } = useGetAccountsQuery();
  const accounts = (accountsData?.accounts ?? []).filter((a) => !a.archived);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      domain: template?.domain ?? "ACTUAL",
      type: template?.type ?? "OUTGOING",
      amount: template?.amount != null ? String(template.amount) : "",
      description: template?.description ?? "",
      dayOfMonth: template?.dayOfMonth != null ? String(template.dayOfMonth) : "",
      categoryId: template?.categoryId ?? "",
      subcategoryId: template?.subcategoryId ?? "",
      accountId: template?.accountId ?? "",
      isActive: template?.isActive ?? true,
    },
  });

  const domain = watch("domain");
  const categoryId = watch("categoryId");

  const usableCategories = categories.filter((c) => {
    if (c.hidden) return false;
    if (domain === "IDEAL") return c.scope === "IDEAL" || c.scope === "BOTH";
    return c.scope === "ACTUAL" || c.scope === "BOTH";
  });
  const usableSubcategories = (
    usableCategories.find((c) => c.id === categoryId)?.subcategories ?? []
  ).filter((s) => !s.hidden);

  async function onSubmit(values: Values) {
    const subcategoryId = usableSubcategories.some((s) => s.id === values.subcategoryId)
      ? values.subcategoryId
      : undefined;
    const body = {
      domain: values.domain,
      type: values.type,
      amount: money(values.amount).toNumber(),
      categoryId: blankToUndefined(values.categoryId),
      subcategoryId,
      accountId: values.domain === "ACTUAL" ? blankToUndefined(values.accountId) : undefined,
      description: values.description.trim(),
      dayOfMonth: Number(values.dayOfMonth),
      isActive: values.isActive,
    };
    try {
      if (template) {
        await updateRecurring({ id: template.id, body }).unwrap();
        toast.success("Template updated");
      } else {
        await createRecurring(body).unwrap();
        toast.success("Template created");
      }
      onClose();
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
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "Edit template" : "Add recurring template"}
      subtitle="Templates never post by themselves - confirm from the list each month."
      width="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-2">
          {(["IDEAL", "ACTUAL"] as RecurringDomain[]).map((d) => (
            <label
              key={d}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                domain === d
                  ? d === "IDEAL"
                    ? "border-ideal-500 bg-ideal-50 dark:bg-ideal-500/10 text-ideal-700 dark:text-ideal-300"
                    : "border-actual-500 bg-actual-50 dark:bg-actual-500/10 text-actual-700 dark:text-actual-300"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400",
              )}
            >
              <input
                type="radio"
                value={d}
                {...register("domain")}
                className="sr-only"
              />
              {d === "IDEAL" ? "Ideal" : "Actual"}
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Type" {...register("type")}>
            <option value="OUTGOING">Outgoing</option>
            <option value="INCOMING">Incoming</option>
          </Select>
          <Input
            label="Day of month (1-31)"
            inputMode="numeric"
            required
            hint="Clamped to month length (31 → Feb 28)."
            error={errors.dayOfMonth?.message}
            {...register("dayOfMonth")}
          />
        </div>

        <Input
          label="Amount"
          inputMode="decimal"
          required
          error={errors.amount?.message}
          {...register("amount")}
        />

        <Input
          label="Description"
          required
          maxLength={255}
          placeholder="e.g. House rent"
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" {...register("categoryId")}>
            <option value="">None</option>
            {usableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Subcategory"
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

        {domain === "ACTUAL" ? (
          <Select label="Account (optional)" {...register("accountId")}>
            <option value="">None</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-slate-700"
            {...register("isActive")}
          />
          <span className="text-slate-700 dark:text-slate-300">Active</span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {template ? "Save" : "Create template"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
