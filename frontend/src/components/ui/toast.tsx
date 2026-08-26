"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, InfoIcon } from "@/components/icons";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function dismissToast(id: number) {
  if (items.some((t) => t.id === id)) {
    items = items.filter((t) => t.id !== id);
    emit();
  }
}

function push(type: ToastType, message: string) {
  const item: ToastItem = { id: nextId++, type, message };
  items = [...items, item];
  emit();
  setTimeout(() => dismissToast(item.id), 5000);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return items;
}

const EMPTY: ToastItem[] = [];

function getServerSnapshot(): ToastItem[] {
  return EMPTY;
}

const typeStyles: Record<ToastType, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
  info: "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
};

const typeIcons: Record<ToastType, React.ReactNode> = {
  success: (
    <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
  ),
  error: (
    <AlertIcon className="size-4 shrink-0 text-red-600 dark:text-red-400" />
  ),
  info: (
    <InfoIcon className="size-4 shrink-0 text-slate-500 dark:text-slate-400" />
  ),
};

export function Toaster() {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end">
      <AnimatePresence>
        {current.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg",
              typeStyles[t.type],
            )}
            role="status"
          >
            {typeIcons[t.type]}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              className="ml-1 shrink-0 text-xs opacity-60 hover:opacity-100 cursor-pointer"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
