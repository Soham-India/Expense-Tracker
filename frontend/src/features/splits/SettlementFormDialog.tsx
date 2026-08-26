"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import {
  useCreateSettlementMutation,
  useGetPeopleQuery,
} from "@/features/splits/splitsApi";
import { useGetActualTransactionsQuery } from "@/features/actual/actualApi";
import { getApiError } from "@/lib/apiError";
import { todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { amountSchema, blankToUndefined, dateSchema } from "@/lib/validation";
import type { MonthString } from "@/lib/dates";

const schema = z
  .object({
    fromPersonId: z.string().min(1, "Pick who paid"),
    toPersonId: z.string().min(1, "Pick who received"),
    amount: amountSchema,
    date: dateSchema,
    note: z.string().max(500, "Max 500 characters"),
    actualTransactionId: z.string(),
  })
  .refine((v) => v.fromPersonId !== v.toPersonId, {
    message: "From and to must be different people",
    path: ["toPersonId"],
  });

type Values = z.infer<typeof schema>;

export interface SettlementFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Default the payer/payee direction, e.g. from a balance row. */
  defaultFromPersonId?: string;
  defaultToPersonId?: string;
}

export function SettlementFormDialog({
  open,
  onClose,
  defaultFromPersonId,
  defaultToPersonId,
}: SettlementFormDialogProps) {
  const { data: people = [] } = useGetPeopleQuery();
  const [createSettlement, { isLoading }] = useCreateSettlementMutation();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromPersonId: defaultFromPersonId ?? "",
      toPersonId: defaultToPersonId ?? "",
      amount: "",
      date: todayStr(),
      note: "",
      actualTransactionId: "",
    },
  });

  // Linking an Actual transaction is explicit and optional (§3.5).
  const date = watch("date");
  const linkMonth: MonthString | undefined = useMemo(
    () => (open && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : undefined),
    [open, date],
  );
  const { data: monthTxns = [] } = useGetActualTransactionsQuery(
    { month: linkMonth },
    { skip: !open || !linkMonth },
  );

  const activePeople = people.filter((p) => !p.archived);

  async function onSubmit(values: Values) {
    try {
      await createSettlement({
        fromPersonId: values.fromPersonId,
        toPersonId: values.toPersonId,
        amount: money(values.amount).toNumber(),
        date: values.date,
        note: blankToUndefined(values.note),
        actualTransactionId: blankToUndefined(values.actualTransactionId),
      }).unwrap();
      toast.success("Settlement recorded");
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
      title="Record settlement"
      subtitle="Recorded as stated - it never creates an Actual transaction unless you link one."
      width="sm:max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="From (paid)" error={errors.fromPersonId?.message} {...register("fromPersonId")}>
            <option value="">Select</option>
            {activePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.self ? "You" : p.name}
              </option>
            ))}
          </Select>
          <Select label="To (received)" error={errors.toPersonId?.message} {...register("toPersonId")}>
            <option value="">Select</option>
            {activePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.self ? "You" : p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            required
            error={errors.amount?.message}
            {...register("amount")}
          />
          <Input
            label="Date"
            type="date"
            required
            error={errors.date?.message}
            {...register("date")}
          />
        </div>
        <Textarea
          label="Note (optional)"
          maxLength={500}
          error={errors.note?.message}
          {...register("note")}
        />
        <Select
          label="Link an Actual transaction (optional)"
          hint="Only when the money movement is already recorded in Actual."
          error={errors.actualTransactionId?.message}
          {...register("actualTransactionId")}
        >
          <option value="">Not linked</option>
          {monthTxns.map((t) => (
            <option key={t.id} value={t.id}>
              {t.date} · {t.description ?? t.type} · {t.amount}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            Record settlement
          </Button>
        </div>
      </form>
    </Modal>
  );
}
