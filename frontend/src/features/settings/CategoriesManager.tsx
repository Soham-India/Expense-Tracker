"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import {
  useCreateCategoryMutation,
  useCreateSubcategoryMutation,
  useDeleteCategoryMutation,
  useDeleteSubcategoryMutation,
  useGetCategoriesQuery,
  useReorderCategoriesMutation,
  useUpdateCategoryMutation,
  useUpdateSubcategoryMutation,
} from "@/features/categories/categoriesApi";
import { getApiError } from "@/lib/apiError";
import { cn } from "@/lib/cn";
import type { CategoryResponse, CategoryScope } from "@/types/api";

const scopeChip: Record<CategoryScope, string> = {
  IDEAL: "bg-ideal-50 dark:bg-ideal-500/10 text-ideal-700 dark:text-ideal-300",
  ACTUAL: "bg-actual-50 dark:bg-actual-500/10 text-actual-700 dark:text-actual-300",
  BOTH: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Max 80 characters"),
  scope: z.enum(["IDEAL", "ACTUAL", "BOTH"]),
  hidden: z.boolean(),
});

type CategoryValues = z.infer<typeof categorySchema>;

export function CategoriesManager() {
  const { data: categories = [], isLoading } = useGetCategoriesQuery();
  const [reorder, { isLoading: reordering }] = useReorderCategoriesMutation();
  const [deleteCategory, { isLoading: deletingCat }] =
    useDeleteCategoryMutation();
  const [deleteSubcategory, { isLoading: deletingSubLoading }] =
    useDeleteSubcategoryMutation();

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryResponse | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryResponse | null>(null);
  const [deletingSub, setDeletingSub] = useState<{
    categoryId: string;
    subId: string;
    name: string;
  } | null>(null);
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});

  const [createSub, { isLoading: creatingSub }] = useCreateSubcategoryMutation();
  const [updateSub] = useUpdateSubcategoryMutation();

  function move(id: string, delta: -1 | 1) {
    const ids = categories.map((c) => c.id);
    const idx = ids.indexOf(id);
    const target = idx + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorder({ categoryIds: ids })
      .unwrap()
      .catch((err) => toast.error(getApiError(err).message));
  }

  async function confirmDeleteCategory() {
    if (!deletingCategory) return;
    try {
      await deleteCategory(deletingCategory.id).unwrap();
      toast.success("Category deleted");
      setDeletingCategory(null);
    } catch (err) {
      // 409: in use - hide instead (server message explains).
      toast.error(getApiError(err).message);
      setDeletingCategory(null);
    }
  }

  async function confirmDeleteSub() {
    if (!deletingSub) return;
    try {
      await deleteSubcategory(deletingSub.subId).unwrap();
      toast.success("Subcategory deleted");
      setDeletingSub(null);
    } catch (err) {
      toast.error(getApiError(err).message);
      setDeletingSub(null);
    }
  }

  async function addSub(categoryId: string) {
    const name = (subDrafts[categoryId] ?? "").trim();
    if (!name) return;
    try {
      await createSub({ categoryId, body: { name } }).unwrap();
      setSubDrafts((d) => ({ ...d, [categoryId]: "" }));
      toast.success("Subcategory added");
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  async function toggleSubHidden(cat: CategoryResponse, subId: string, hidden: boolean) {
    const sub = cat.subcategories.find((s) => s.id === subId);
    if (!sub) return;
    try {
      await updateSub({ id: subId, body: { name: sub.name, hidden } }).unwrap();
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  }

  return (
    <section aria-label="Categories">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Categories</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Scope gates where a category may be used. In-use categories cannot
            be deleted - hide them instead.
          </p>
        </div>
        <Button size="sm" onClick={() => setCatDialogOpen(true)}>
          Add category
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <ul className="space-y-2">
          {categories.map((c, idx) => (
            <li
              key={c.id}
              className={cn(
                "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5",
                c.hidden && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    onClick={() => move(c.id, -1)}
                    disabled={idx === 0 || reordering}
                    aria-label={`Move ${c.name} up`}
                    className="text-[10px] leading-none text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 cursor-pointer"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(c.id, 1)}
                    disabled={idx === categories.length - 1 || reordering}
                    aria-label={`Move ${c.name} down`}
                    className="mt-0.5 text-[10px] leading-none text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 cursor-pointer"
                  >
                    ▼
                  </button>
                </div>
                <span className="font-medium text-slate-800 dark:text-slate-100">{c.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    scopeChip[c.scope],
                  )}
                >
                  {c.scope}
                </span>
                {c.hidden ? (
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    hidden
                  </span>
                ) : null}
                <span className="ml-auto flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditingCategory(c)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingCategory(c)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
                  >
                    Delete
                  </button>
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-50 dark:border-slate-800 pt-2.5">
                {c.subcategories.map((s) => (
                  <span
                    key={s.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full bg-slate-50 dark:bg-slate-950 py-0.5 pl-2.5 pr-1 text-xs text-slate-600 dark:text-slate-400",
                      s.hidden && "line-through opacity-60",
                    )}
                  >
                    {s.name}
                    <button
                      onClick={() => toggleSubHidden(c, s.id, !s.hidden)}
                      aria-label={s.hidden ? `Unhide ${s.name}` : `Hide ${s.name}`}
                      className="rounded-full px-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                      title={s.hidden ? "Unhide" : "Hide"}
                    >
                      {s.hidden ? "◦" : "•"}
                    </button>
                    <button
                      onClick={() =>
                        setDeletingSub({
                          categoryId: c.id,
                          subId: s.id,
                          name: s.name,
                        })
                      }
                      aria-label={`Delete ${s.name}`}
                      className="rounded-full px-1 text-slate-400 dark:text-slate-500 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <input
                    value={subDrafts[c.id] ?? ""}
                    onChange={(e) =>
                      setSubDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSub(c.id);
                      }
                    }}
                    maxLength={80}
                    placeholder="Add subcategory…"
                    className="w-36 rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-xs placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={creatingSub}
                    disabled={!(subDrafts[c.id] ?? "").trim()}
                    onClick={() => addSub(c.id)}
                  >
                    +
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CategoryDialog
        open={catDialogOpen}
        onClose={() => setCatDialogOpen(false)}
      />
      <CategoryDialog
        key={editingCategory?.id ?? "none"}
        open={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        category={editingCategory ?? undefined}
      />

      <ConfirmDialog
        open={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={confirmDeleteCategory}
        loading={deletingCat}
        title="Delete category?"
        message={`"${deletingCategory?.name}" will be removed. Categories used by transactions or subcategories cannot be deleted - hide them instead.`}
      />
      <ConfirmDialog
        open={!!deletingSub}
        onClose={() => setDeletingSub(null)}
        onConfirm={confirmDeleteSub}
        loading={deletingSubLoading}
        title="Delete subcategory?"
        message={`"${deletingSub?.name}" will be removed. In-use subcategories cannot be deleted.`}
      />
    </section>
  );
}

function CategoryDialog({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category?: CategoryResponse;
}) {
  const [createCategory, { isLoading: creating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation();
  const isLoading = creating || updating;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      scope: category?.scope ?? "BOTH",
      hidden: category?.hidden ?? false,
    },
  });

  async function onSubmit(values: CategoryValues) {
    try {
      if (category) {
        await updateCategory({
          id: category.id,
          body: {
            name: values.name,
            scope: values.scope,
            hidden: values.hidden,
          },
        }).unwrap();
        toast.success("Category updated");
      } else {
        await createCategory({
          name: values.name,
          scope: values.scope,
        }).unwrap();
        toast.success("Category created");
      }
      onClose();
    } catch (err) {
      const info = getApiError(err);
      if (info.fieldErrors) {
        for (const [field, message] of Object.entries(info.fieldErrors)) {
          setError(field as keyof CategoryValues, { message });
        }
      }
      // 409 duplicate name (case-insensitive)
      toast.error(info.message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? "Edit category" : "Add category"}
      width="sm:max-w-md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Name"
          required
          maxLength={80}
          placeholder="e.g. Food"
          autoFocus
          error={errors.name?.message}
          {...register("name")}
        />
        <Select label="Scope" {...register("scope")}>
          <option value="BOTH">Both (Ideal + Actual)</option>
          <option value="IDEAL">Ideal only</option>
          <option value="ACTUAL">Actual only</option>
        </Select>
        {category ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-slate-700"
              {...register("hidden")}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Hidden
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                (kept for history; excluded from pickers)
              </span>
            </span>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {category ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
