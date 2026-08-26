"use client";

import type { Ref } from "react";
import { cn } from "@/lib/cn";

export interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function fieldClasses(hasError: boolean): string {
  return cn(
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-400",
    "dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600",
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500/60 dark:focus:border-red-400 dark:focus:ring-red-500/25"
      : "border-slate-300 focus:border-slate-500 focus:ring-slate-200 dark:border-slate-700 dark:focus:border-slate-500 dark:focus:ring-slate-500/25",
  );
}

export function FieldShell({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
}: FieldProps & { htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "ref"> {
  label?: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  error,
  hint,
  className,
  id,
  required,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        required={required}
        aria-invalid={!!error || undefined}
        className={cn(fieldClasses(!!error), className)}
        {...props}
      />
    </FieldShell>
  );
}

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "ref"> {
  label?: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  required,
  ...props
}: TextareaProps) {
  const areaId = id ?? props.name;
  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={areaId}
    >
      <textarea
        id={areaId}
        required={required}
        aria-invalid={!!error || undefined}
        className={cn(fieldClasses(!!error), "min-h-20 resize-y", className)}
        {...props}
      />
    </FieldShell>
  );
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "ref"> {
  label?: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({
  label,
  error,
  hint,
  className,
  id,
  required,
  children,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={selectId}
    >
      <select
        id={selectId}
        required={required}
        aria-invalid={!!error || undefined}
        className={cn(fieldClasses(!!error), "appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
