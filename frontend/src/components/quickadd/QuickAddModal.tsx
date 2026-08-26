"use client";

import { Modal } from "@/components/ui/Modal";
import { TargetIcon, UsersIcon, WalletIcon } from "@/components/icons";
import { ActualTransactionForm } from "@/features/actual/ActualTransactionForm";
import { IdealEntryForm } from "@/features/ideal/IdealEntryForm";
import { SplitExpenseForm } from "@/features/splits/SplitExpenseForm";
import { cn } from "@/lib/cn";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeQuickAdd,
  setQuickAddDomain,
  type QuickAddDomain,
} from "@/store/slices/uiSlice";

const domainTabs: Array<{
  id: QuickAddDomain;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: string;
}> = [
  { id: "ideal", label: "Ideal", icon: TargetIcon, active: "text-ideal-700 dark:text-ideal-300 border-ideal-500 bg-ideal-50 dark:bg-ideal-500/10" },
  { id: "actual", label: "Actual", icon: WalletIcon, active: "text-actual-700 dark:text-actual-300 border-actual-500 bg-actual-50 dark:bg-actual-500/10" },
  { id: "splits", label: "Split", icon: UsersIcon, active: "text-splits-700 dark:text-splits-300 border-splits-500 bg-splits-50 dark:bg-splits-500/10" },
];

const subtitles: Record<QuickAddDomain, string> = {
  ideal: "A planning entry - your chosen values, never a bank balance.",
  actual: "Real money movement - income, expense or transfer.",
  splits: "An obligation between people - split equally, settle later.",
};

/** Global entry point: bottom-nav +, dashboard actions and recents all open this. */
export function QuickAddModal() {
  const dispatch = useAppDispatch();
  const { open, domain } = useAppSelector((s) => s.ui.quickAdd);

  return (
    <Modal
      open={open}
      onClose={() => dispatch(closeQuickAdd())}
      title="Quick add"
      subtitle={subtitles[domain]}
      width="sm:max-w-xl"
    >
      <div className="mb-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Domain">
        {domainTabs.map((tab) => {
          const active = domain === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => dispatch(setQuickAddDomain(tab.id))}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                active
                  ? tab.active
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {domain === "ideal" ? <IdealEntryForm /> : null}
      {domain === "actual" ? <ActualTransactionForm /> : null}
      {domain === "splits" ? <SplitExpenseForm /> : null}
    </Modal>
  );
}
