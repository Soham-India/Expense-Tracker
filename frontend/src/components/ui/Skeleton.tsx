import { cn } from "@/lib/cn";

/** Pulse placeholder block — loading states are skeletons, never blank screens. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800",
        className,
      )}
    />
  );
}
