"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  BarChart3,
  FileSearch,
  Key,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SidebarUser {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
}

interface SidebarProps {
  user: SidebarUser;
}

/* ------------------------------------------------------------------ */
/*  Navigation config                                                  */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Usage", href: "/dashboard/usage", icon: BarChart3 },
  { label: "Reviews", href: "/dashboard/reviews", icon: FileSearch },
  { label: "API Keys", href: "/dashboard/keys", icon: Key },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    if (mobileOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [mobileOpen]);

  const handleLogout = useCallback(async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }, [supabase, router]);

  const isPro = user.plan === "pro";

  /* Shared sidebar content used by both desktop and mobile */
  const sidebarContent = (
    <>
      {/* ── Brand ── */}
      <div className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight"
        >
          Chain<span className="text-brand-500">Review</span>
        </Link>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── User info ── */}
      <div className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
        <div className="flex items-center gap-3">
          <Avatar
            size="md"
            name={user.name || user.email}
            src={user.avatarUrl}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {user.name || user.email.split("@")[0]}
              </span>
              <Badge
                variant={isPro ? "premium" : "default"}
                size="sm"
              >
                {isPro ? "Pro" : "Free"}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200",
              )}
            >
              {/* Active left border indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-500" />
              )}

              <item.icon
                size={18}
                className={clsx(
                  "shrink-0 transition-colors",
                  isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom section ── */}
      <div className="px-3 pb-4 space-y-2">
        {/* Upgrade CTA (free plan only) */}
        {!isPro && (
          <Link href="/dashboard/settings">
            <div className="mx-1 p-3 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white cursor-pointer hover:from-brand-600 hover:to-brand-800 transition-all">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Upgrade to Pro
                </span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Unlimited tokens, 60 req/min, cloud sync, and priority support.
              </p>
            </div>
          </Link>
        )}

        {/* Sign Out */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
          <button
            onClick={handleLogout}
            disabled={signingOut}
            className={clsx(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {signingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile hamburger trigger ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={clsx(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 min-h-screen">
        {sidebarContent}
      </aside>
    </>
  );
}
