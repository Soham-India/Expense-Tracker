"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { useStartIdealMonthMutation } from "@/features/ideal/idealApi";
import { getApiError } from "@/lib/apiError";
import { currentMonthStr, isValidMonthString } from "@/lib/dates";
import { money } from "@/lib/money";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeStartMonth } from "@/store/slices/uiSlice";

const schema = z.object({
  month: z
    .string()
    .min(1, "Month is required")
    .refine(isValidMonthString, "Use format yyyy-MM"),
  startingIncoming: z
    .string()
    .min(1, "Starting incoming is required")
    .regex(/^\d{1,13}(\.\d{1,2})?$/, "Use digits with up to 2 decimals"),
});

type Values = z.infer<typeof schema>;

/**
 * Ideal months must exist before Ideal entries can land in them (server 404s
 * otherwise). This dialog is the minimal CP2 version; the full Ideal page
 * (Checkpoint 3) owns month management.
 */
export function StartMonthDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.startMonthOpen);
  const [startMonth, { isLoading }] = useStartIdealMonthMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      month: currentMonthStr(),
      startingIncoming: "",
    },
  });

  async function onSubmit(values: Values) {
    try {
      const res = await startMonth({
        month: values.month,
        startingIncoming: money(values.startingIncoming).toNumber(),
      }).unwrap();
      toast.success(`Ideal month ${res.month} started`);
      dispatch(closeStartMonth());
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
      onClose={() => dispatch(closeStartMonth())}
      title="Start your Ideal month"
      subtitle="Your chosen planning values - never a bank balance."
      width="sm:max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Month"
          type="month"
          required
          error={errors.month?.message}
          {...register("month")}
        />
        <Input
          label="Starting incoming"
          inputMode="decimal"
          placeholder="e.g. 20000"
          required
          hint="Money you begin the month with - additional incoming is added separately."
          error={errors.startingIncoming?.message}
          {...register("startingIncoming")}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => dispatch(closeStartMonth())}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            Start month
          </Button>
        </div>
      </form>
    </Modal>
  );
}
