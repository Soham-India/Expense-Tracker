"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import { useMounted } from "@/lib/useMounted";
import { cn } from "@/lib/cn";
import { useTheme, type Theme } from "./ThemeProvider";

const ORDER: Theme[] = ["light", "dark", "system"];

const LABELS: Record<Theme, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "Follow system theme",
};

/** Cycles light -> dark -> system. Shows the current choice. */
export function ThemeToggle({ className }: { className?: string }) {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  const current: Theme = mounted ? theme : "system";
  const Icon =
    current === "dark" ? MoonIcon : current === "light" ? SunIcon : MonitorIcon;

  return (
    <button
      onClick={() =>
        setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])
      }
      disabled={!mounted}
      title={LABELS[current]}
      aria-label={`Theme: ${LABELS[current]}. Click to change.`}
      className={cn(
        "rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700",
        "dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300",
        "disabled:opacity-0 cursor-pointer disabled:cursor-default",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
