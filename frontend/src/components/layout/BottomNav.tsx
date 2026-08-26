"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { PlusIcon, TargetIcon, UsersIcon, WalletIcon } from "@/components/icons";
import { isNavItemActive, primaryNav, type NavItem } from "@/components/layout/navConfig";
import { useAppDispatch } from "@/store/hooks";
import { closeQuickAdd, openQuickAdd, type QuickAddDomain } from "@/store/slices/uiSlice";

const activeClasses: Record<string, string> = {
  neutral: "text-slate-900 dark:text-slate-100",
  ideal: "text-ideal-600 dark:text-ideal-400",
  actual: "text-actual-600 dark:text-actual-400",
  splits: "text-splits-600 dark:text-splits-400",
};

function BottomLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
        active
          ? activeClasses[item.accent ?? "neutral"]
          : "text-slate-400 dark:text-slate-500",
      )}
    >
      <Icon className="size-[22px]" />
      {item.label}
    </Link>
  );
}

/** Domain-choice sheet behind the center + button (PRD §13). */
function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const options: Array<{
    domain: QuickAddDomain;
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    chip: string;
  }> = [
    {
      domain: "ideal",
      label: "Ideal entry",
      hint: "Plan incoming / outgoing",
      icon: TargetIcon,
      chip: "bg-ideal-100 text-ideal-700",
    },
    {
      domain: "actual",
      label: "Actual transaction",
      hint: "Income, expense or transfer",
      icon: WalletIcon,
      chip: "bg-actual-100 text-actual-700",
    },
    {
      domain: "splits",
      label: "Split expense",
      hint: "Share with people",
      icon: UsersIcon,
      chip: "bg-splits-100 text-splits-700",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-4 bottom-24 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:left-1/2 sm:right-auto sm:w-96 sm:-translate-x-1/2 dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-label="Quick add"
      >
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quick add
          </p>
        </div>
        <div className="grid gap-1.5">
          {options.map((o) => (
            <button
              key={o.domain}
              onClick={() => {
                onClose();
                dispatch(openQuickAdd({ domain: o.domain }));
              }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-800"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl [&_svg]:size-5",
                  o.chip,
                )}
              >
                <o.icon />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  {o.label}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {o.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function BottomNav() {
  const [quickOpen, setQuickOpen] = useState(false);
  // The sheet dispatches into the global Quick Add modal; keep the slice in
  // sync on close so a stale prefill never lingers.
  const dispatch = useAppDispatch();
  const [home, ideal, actual, splits] = primaryNav;

  function closeSheet() {
    setQuickOpen(false);
    dispatch(closeQuickAdd());
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          <BottomLink item={home} />
          <BottomLink item={ideal} />
          <div className="relative flex justify-center">
            <button
              onClick={() => setQuickOpen(true)}
              className="absolute -top-6 flex size-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-4 ring-white transition-transform active:scale-95 cursor-pointer dark:ring-slate-900"
              aria-label="Quick add"
            >
              <PlusIcon className="size-6" />
            </button>
          </div>
          <BottomLink item={actual} />
          <BottomLink item={splits} />
        </div>
      </nav>
      <AnimatePresence>
        {quickOpen && <QuickAddSheet onClose={closeSheet} />}
      </AnimatePresence>
    </>
  );
}
