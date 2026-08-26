import { cn } from "@/lib/cn";

type Accent = "neutral" | "ideal" | "actual" | "splits";

const accentDot: Record<Accent, string> = {
  neutral: "bg-slate-400",
  ideal: "bg-ideal-500",
  actual: "bg-actual-500",
  splits: "bg-splits-500",
};

/**
 * Temporary stand-in for pages built in later checkpoints.
 * Each one disappears as its checkpoint lands.
 */
export function Placeholder({
  phase,
  title,
  points,
  accent = "neutral",
}: {
  phase: string;
  title: string;
  points: string[];
  accent?: Accent;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 sm:p-8 dark:border-slate-700 dark:bg-slate-900">
      <p
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          accent === "ideal" &&
            "bg-ideal-50 text-ideal-700 dark:bg-ideal-500/10 dark:text-ideal-300",
          accent === "actual" &&
            "bg-actual-50 text-actual-700 dark:bg-actual-500/10 dark:text-actual-300",
          accent === "splits" &&
            "bg-splits-50 text-splits-700 dark:bg-splits-500/10 dark:text-splits-300",
          accent === "neutral" &&
            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        )}
      >
        <span className={cn("size-1.5 rounded-full", accentDot[accent])} />
        Arrives in {phase}
      </p>
      <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {points.map((p) => (
          <li
            key={p}
            className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400"
          >
            <span
              className={cn("mt-[7px] size-1 shrink-0 rounded-full", accentDot[accent])}
            />
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}
