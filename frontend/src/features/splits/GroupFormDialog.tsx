"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import {
  useCreateGroupMutation,
  useUpdateGroupMutation,
} from "@/features/splits/splitsApi";
import { getApiError } from "@/lib/apiError";
import type { GroupResponse } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Max 120 characters"),
  description: z.string().max(500, "Max 500 characters"),
  archived: z.boolean(),
});

type Values = z.infer<typeof schema>;

export interface GroupFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Edit mode when set. */
  group?: GroupResponse;
}

export function GroupFormDialog({ open, onClose, group }: GroupFormDialogProps) {
  const [createGroup, { isLoading: creating }] = useCreateGroupMutation();
  const [updateGroup, { isLoading: updating }] = useUpdateGroupMutation();
  const isLoading = creating || updating;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: group?.name ?? "",
      description: group?.description ?? "",
      archived: group ? group.status === "ARCHIVED" : false,
    },
  });

  async function onSubmit(values: Values) {
    try {
      if (group) {
        await updateGroup({
          id: group.id,
          body: {
            name: values.name,
            description: values.description || null,
            status: values.archived ? "ARCHIVED" : "ACTIVE",
          },
        }).unwrap();
        toast.success("Group updated");
      } else {
        await createGroup({
          name: values.name,
          description: values.description || undefined,
        }).unwrap();
        toast.success("Group created - add members on its card");
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
      title={group ? "Edit group" : "New group"}
      width="sm:max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Name"
          required
          maxLength={120}
          placeholder="e.g. Goa Trip"
          autoFocus
          error={errors.name?.message}
          {...register("name")}
        />
        <Textarea
          label="Description (optional)"
          maxLength={500}
          error={errors.description?.message}
          {...register("description")}
        />
        {group ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-splits-600"
              {...register("archived")}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Archived
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                (kept for history; no new expenses)
              </span>
            </span>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {group ? "Save" : "Create group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
