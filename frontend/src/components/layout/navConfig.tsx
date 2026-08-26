"use client";

import {
  ChartIcon,
  CompareIcon,
  HomeIcon,
  SettingsIcon,
  TargetIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** domain accent used for active states */
  accent?: "neutral" | "ideal" | "actual" | "splits";
}

export const primaryNav: NavItem[] = [
  { href: "/", label: "Home", icon: HomeIcon, accent: "neutral" },
  { href: "/ideal", label: "Ideal", icon: TargetIcon, accent: "ideal" },
  { href: "/actual", label: "Actual", icon: WalletIcon, accent: "actual" },
  { href: "/splits", label: "Splits", icon: UsersIcon, accent: "splits" },
];

export const secondaryNav: NavItem[] = [
  { href: "/reports", label: "Reports", icon: ChartIcon },
  { href: "/compare", label: "Compare", icon: CompareIcon },
  { href: "/people", label: "People", icon: UsersIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
