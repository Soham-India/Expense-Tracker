"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import {
  useCreateAccountMutation,
  useUpdateAccountMutation,
} from "@/features/actual/actualApi";
import { getApiError } from "@/lib/apiError";
import { money } from "@/lib/money";
import type { AccountResponse, AccountType } from "@/types/api";

const accountTypes: AccountType[] = ["BANK", "CASH", "UPI", "CARD", "OTHER"];

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Max 80 characters"),
  accountType: z.enum(["BANK", "CASH", "UPI", "CARD", "OTHER"]),
  startingBalance: z
    .string()
    .regex(/^\d{0,13}(\.\d{1,2})?$/, "Use digits with up to 2 decimals"),
  archived: z.boolean(),
});

type Values = z.infer<typeof createSchema>;

export interface AccountFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set the dialog PUTs (edit/archive) instead of POSTs. */
  account?: AccountResponse;
}

export function AccountFormDialog({ open, onClose, account }: AccountFormDialogProps) {
  const [createAccount, { isLoading: creating }] = useCreateAccountMutation();
  const [updateAccount, { isLoading: updating }] = useUpdateAccountMutation();
  const isLoading = creating || updating;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: account?.name ?? "",
      accountType: account?.accountType ?? "BANK",
      startingBalance:
        account?.startingBalance != null ? String(account.startingBalance) : "",
      archived: account?.archived ?? false,
    },
  });

  async function onSubmit(values: Values) {
    const startingBalance = values.startingBalance
      ? money(values.startingBalance).toNumber()
      : null;
    try {
      if (account) {
        await updateAccount({
          id: account.id,
          body: {
            name: values.name,
            accountType: values.accountType,
            startingBalance,
            archived: values.archived,
          },
        }).unwrap();
        toast.success("Account updated");
      } else {
        await createAccount({
          name: values.name,
          accountType: values.accountType,
          startingBalance:
            values.startingBalance !== ""
              ? money(values.startingBalance).toNumber()
              : undefined,
        }).unwrap();
        toast.success("Account created");
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
      title={account ? "Edit account" : "Add account"}
      subtitle="Accounts are optional - transactions work without them."
      width="sm:max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Name"
          required
          maxLength={80}
          placeholder="e.g. HDFC Savings"
          autoFocus
          error={errors.name?.message}
          {...register("name")}
        />
        <Select
          label="Account type"
          error={errors.accountType?.message}
          {...register("accountType")}
        >
          {accountTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          label="Starting balance (optional)"
          inputMode="decimal"
          placeholder="e.g. 10000"
          hint="Current balance stays hidden until this is set."
          error={errors.startingBalance?.message}
          {...register("startingBalance")}
        />
        {account ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-actual-600"
              {...register("archived")}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Archived
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                (hidden from the bar; history kept)
              </span>
            </span>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {account ? "Save" : "Create account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
