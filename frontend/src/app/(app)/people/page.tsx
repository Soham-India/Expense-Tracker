"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusIcon, UsersIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import {
  useCreatePersonMutation,
  useDeletePersonMutation,
  useGetPeopleQuery,
  useUpdatePersonMutation,
} from "@/features/splits/splitsApi";
import { getApiError } from "@/lib/apiError";
import { cn } from "@/lib/cn";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PersonResponse } from "@/types/api";

const personSchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Max 120 characters"),
  contactInfo: z.string().max(200, "Max 200 characters"),
  archived: z.boolean(),
});

type Values = z.infer<typeof personSchema>;

export default function PeoplePage() {
  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PersonResponse | null>(null);
  const [deleting, setDeleting] = useState<PersonResponse | null>(null);

  const { data: people = [], isLoading } = useGetPeopleQuery(showArchived);
  const [deletePerson, { isLoading: deletingLoading }] =
    useDeletePersonMutation();

  const visible = [...people]
    .filter((p) => (showArchived ? true : !p.archived))
    .sort(
      (a, b) =>
        Number(b.self) - Number(a.self) || a.name.localeCompare(b.name),
    );

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deletePerson(deleting.id).unwrap();
      toast.success("Person deleted");
      setDeleting(null);
    } catch (err) {
      // 409 referenced / 400 self record - surface the server message.
      toast.error(getApiError(err).message);
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Who you share expenses with - your own record stays private to you."
        icon={<UsersIcon />}
        accent="splits"
        actions={
          <>
            <Button onClick={() => setAddOpen(true)} className="max-sm:w-full">
              <PlusIcon className="size-4" /> Add person
            </Button>
            <Link
              href="/splits"
              className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              Manage groups
            </Link>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No people yet - add someone to start splitting expenses.
          </p>
          <Button onClick={() => setAddOpen(true)} className="mt-4">
            Add a person
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {visible.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  p.self
                    ? "bg-splits-100 dark:bg-splits-500/15 text-splits-700 dark:text-splits-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                )}
              >
                {p.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {p.name}
                  {p.self ? (
                    <span className="ml-1.5 rounded-full bg-splits-50 dark:bg-splits-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-splits-700 dark:text-splits-300">
                      you
                    </span>
                  ) : null}
                  {p.archived ? (
                    <span className="ml-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      archived
                    </span>
                  ) : null}
                </p>
                {p.contactInfo ? (
                  <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                    {p.contactInfo}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setEditing(p)}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                Edit
              </button>
              {!p.self ? (
                <button
                  onClick={() => setDeleting(p)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
                >
                  Delete
                </button>
              ) : (
                <span className="px-2 py-1 text-xs text-slate-300 dark:text-slate-600">protected</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <input
          type="checkbox"
          className="size-3.5 accent-splits-600"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>

      <PersonDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <PersonDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onClose={() => setEditing(null)}
        person={editing ?? undefined}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletingLoading}
        title="Delete person?"
        message={`"${deleting?.name}" will be removed. People referenced by expenses or settlements cannot be deleted - archive them instead.`}
      />
    </>
  );
}

function PersonDialog({
  open,
  onClose,
  person,
}: {
  open: boolean;
  onClose: () => void;
  person?: PersonResponse;
}) {
  const [createPerson, { isLoading: creating }] = useCreatePersonMutation();
  const [updatePerson, { isLoading: updating }] = useUpdatePersonMutation();
  const isLoading = creating || updating;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: person?.name ?? "",
      contactInfo: person?.contactInfo ?? "",
      archived: person?.archived ?? false,
    },
  });

  async function onSubmit(values: Values) {
    const body = {
      name: values.name,
      contactInfo: values.contactInfo || null,
      archived: values.archived,
    };
    try {
      if (person) {
        await updatePerson({ id: person.id, body }).unwrap();
        toast.success("Person updated");
      } else {
        await createPerson({
          name: values.name,
          contactInfo: values.contactInfo || undefined,
        }).unwrap();
        toast.success("Person added");
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
      title={person ? "Edit person" : "Add person"}
      width="sm:max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Name"
          required
          maxLength={120}
          placeholder="e.g. Priya"
          autoFocus
          error={errors.name?.message}
          {...register("name")}
        />
        <Textarea
          label="Contact info (optional)"
          maxLength={200}
          placeholder="Phone, UPI id, notes"
          error={errors.contactInfo?.message}
          {...register("contactInfo")}
        />
        {person ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-splits-600"
              {...register("archived")}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Archived
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                (hidden from new splits; history kept)
              </span>
            </span>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {person ? "Save" : "Add person"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
