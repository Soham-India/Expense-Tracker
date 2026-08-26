"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { XIcon } from "@/components/icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** max width utility class, e.g. "sm:max-w-md" */
  width?: string;
  children: React.ReactNode;
}

/**
 * Shared dialog shell: backdrop click + Escape to close, body scroll lock.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = "sm:max-w-lg",
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "max-h-[92dvh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900",
              width,
            )}
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
