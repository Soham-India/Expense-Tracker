"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { LogOutIcon, XIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  isNavItemActive,
  primaryNav,
  secondaryNav,
  type NavItem,
} from "@/components/layout/navConfig";
import { logout, selectUser } from "@/store/slices/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

function DrawerLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;
  const accent = item.accent ?? "neutral";
  const accentText =
    accent === "ideal"
      ? "text-ideal-700 dark:text-ideal-300"
      : accent === "actual"
        ? "text-actual-700 dark:text-actual-300"
        : accent === "splits"
          ? "text-splits-700 dark:text-splits-300"
          : "";
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? cn(
              "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
              accentText && "[&>svg]:text-inherit",
            )
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        active && accent !== "neutral" && accentText,
      )}
    >
      <Icon className={cn("size-[18px]", !active && "text-current")} />
      {item.label}
    </Link>
  );
}

export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => selectUser(s.auth));
  const [logoutOpen, setLogoutOpen] = useState(false);

  function handleLogout() {
    setLogoutOpen(false);
    dispatch(logout());
    window.location.replace("/login");
  }

  return (
    <>
      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl dark:bg-slate-900"
            role="dialog"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Menu
              </p>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Close menu"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {primaryNav.map((item) => (
                <DrawerLink key={item.href} item={item} onNavigate={onClose} />
              ))}
              <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Manage
              </p>
              {secondaryNav.map((item) => (
                <DrawerLink key={item.href} item={item} onNavigate={onClose} />
              ))}
            </nav>

            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {user?.displayName ?? "…"}
                  </p>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                    {user?.email}
                  </p>
                </div>
                <ThemeToggle />
              </div>
              <button
                onClick={() => {
                  onClose();
                  setLogoutOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer dark:hover:bg-red-500/10 dark:text-red-400"
              >
                <LogOutIcon className="size-4" />
                Log out
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
      </AnimatePresence>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
        title="Log out"
        message="Are you sure you want to log out of Expense Tracker?"
        confirmLabel="Log out"
      />
    </>
  );
}
