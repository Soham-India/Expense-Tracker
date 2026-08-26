"use client";

import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-700 focus-visible:outline-slate-900 disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 dark:focus-visible:outline-slate-100 dark:disabled:bg-slate-600 dark:disabled:text-slate-400",
  secondary:
    "bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 focus-visible:outline-slate-400 disabled:text-slate-400 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 dark:disabled:text-slate-600",
  danger:
    "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 disabled:bg-red-300 dark:disabled:bg-red-900 dark:disabled:text-red-200",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400 disabled:text-slate-300 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:disabled:text-slate-600",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1 rounded-md",
  md: "text-sm px-3.5 py-2 gap-1.5 rounded-lg",
  lg: "text-base px-5 py-2.5 gap-2 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer disabled:cursor-not-allowed select-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
