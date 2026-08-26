"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "expense-tracker:theme";

/**
 * Blocking script for the root layout <head>. Applies the stored (or system)
 * theme class before first paint so there is no flash of the wrong theme.
 * Must stay in sync with STORAGE_KEY and the resolution logic below.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||"system";var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;d?c.add("dark"):c.remove("dark");}catch(e){}})();`;

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// External store: the persisted theme choice (localStorage + cross-tab sync).
// ---------------------------------------------------------------------------

let cachedTheme: Theme | null = null;
const listeners = new Set<() => void>();

function readStored(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // storage unavailable (private mode etc.) - fall back to system
  }
  return "system";
}

function notify() {
  cachedTheme = null;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify();
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", notify);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    media.removeEventListener("change", notify);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Theme {
  if (cachedTheme === null) cachedTheme = readStored();
  return cachedTheme;
}

function getServerSnapshot(): Theme {
  return "system";
}

// ---------------------------------------------------------------------------
// External store: the OS-level dark preference.
// ---------------------------------------------------------------------------

const systemDarkSubscribe = (cb: () => void) => {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", cb);
  return () => media.removeEventListener("change", cb);
};

const getSystemDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const getSystemDarkServer = () => false;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const systemDark = useSyncExternalStore(
    systemDarkSubscribe,
    getSystemDark,
    getSystemDarkServer,
  );
  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Sync React state to the external system (<html> class).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    cachedTheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
