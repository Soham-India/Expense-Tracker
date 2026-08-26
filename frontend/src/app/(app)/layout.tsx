"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TargetIcon } from "@/components/icons";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { MenuIcon } from "@/components/icons";
import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/Spinner";
import { QuickAddModal } from "@/components/quickadd/QuickAddModal";
import { StartMonthDialog } from "@/features/ideal/StartMonthDialog";
import { useMounted } from "@/lib/useMounted";
import { useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated } from "@/store/slices/authSlice";

/**
 * Guarded shell for every authenticated route. While auth is hydrating
 * (SSR/first client render) we render a neutral splash to avoid mismatches;
 * once mounted, an unauthenticated visitor is redirected to /login.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authed = useAppSelector((s) => selectIsAuthenticated(s.auth));
  const mounted = useMounted();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (mounted && !authed) router.replace("/login");
  }, [mounted, authed, router]);

  if (!mounted || !authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner className="size-7 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />

      <div className="flex min-h-screen flex-col lg:pl-60">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ideal-600 text-white [&_svg]:size-4">
              <TargetIcon />
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Expense Tracker
            </span>
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomNav />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <QuickAddModal />
      <StartMonthDialog />
    </div>
  );
}
