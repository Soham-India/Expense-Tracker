import { cn } from "@/lib/cn";

type Accent = "neutral" | "ideal" | "actual" | "splits";

const accentChip: Record<Accent, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ideal: "bg-ideal-100 text-ideal-700 dark:bg-ideal-500/15 dark:text-ideal-300",
  actual:
    "bg-actual-100 text-actual-700 dark:bg-actual-500/15 dark:text-actual-300",
  splits:
    "bg-splits-100 text-splits-700 dark:bg-splits-500/15 dark:text-splits-300",
};

export function PageHeader({
  title,
  subtitle,
  icon,
  accent = "neutral",
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: Accent;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl text-xl [&_svg]:size-5",
              accentChip[accent],
            )}
          >
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
