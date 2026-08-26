import { TargetIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/cn";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-ideal-600 text-white shadow-sm [&_svg]:size-6">
            <TargetIcon />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Expense Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ideal · Actual · Splits — kept deliberately independent
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900",
          )}
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-0.5 mb-5 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
          {children}
        </div>
        {footer && (
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
