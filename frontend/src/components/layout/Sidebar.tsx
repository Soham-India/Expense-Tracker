"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { LogOutIcon, TargetIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  isNavItemActive,
  primaryNav,
  secondaryNav,
  type NavItem,
} from "@/components/layout/navConfig";
import { selectUser } from "@/store/slices/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/slices/authSlice";

const activeClasses: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  ideal: "bg-ideal-50 text-ideal-700 dark:bg-ideal-500/10 dark:text-ideal-300",
  actual:
    "bg-actual-50 text-actual-700 dark:bg-actual-500/10 dark:text-actual-300",
  splits:
    "bg-splits-50 text-splits-700 dark:bg-splits-500/10 dark:text-splits-300",
};

const idleClasses =
  "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;
  const accent = item.accent ?? "neutral";
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? activeClasses[accent] : idleClasses,
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", !active && "text-current")} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => selectUser(s.auth));
  const [logoutOpen, setLogoutOpen] = useState(false);

  function handleLogout() {
    setLogoutOpen(false);
    dispatch(logout());
    window.location.replace("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-ideal-600 text-white [&_svg]:size-5">
          <TargetIcon />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
            Expense Tracker
          </p>
          <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">
            Ideal · Actual · Splits
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Systems
        </p>
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Manage
        </p>
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {(user?.displayName ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
              {user?.displayName ?? "…"}
            </p>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">
              {user?.email}
            </p>
          </div>
          <ThemeToggle />
          <button
            onClick={() => setLogoutOpen(true)}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <LogOutIcon className="size-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
        title="Log out"
        message="Are you sure you want to log out of Expense Tracker?"
        confirmLabel="Log out"
      />
    </aside>
  );
}
