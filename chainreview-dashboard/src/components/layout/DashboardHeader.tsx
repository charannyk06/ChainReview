"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { Avatar } from "@/components/ui/Avatar";
import type { SidebarUser } from "./Sidebar";

/* ------------------------------------------------------------------ */
/*  Breadcrumb labels                                                  */
/* ------------------------------------------------------------------ */

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: "Overview",
  usage: "Usage",
  reviews: "Reviews",
  keys: "API Keys",
  settings: "Settings",
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    const label = BREADCRUMB_LABELS[segment] || segment;
    crumbs.push({ label, href: path });
  }

  return crumbs;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface DashboardHeaderProps {
  user: SidebarUser;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const breadcrumbs = buildBreadcrumbs(pathname);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [menuOpen]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [supabase, router]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 min-w-0 pl-10 lg:pl-0"
      >
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  size={14}
                  className="text-zinc-300 dark:text-zinc-600 shrink-0"
                />
              )}
              {isLast ? (
                <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* User avatar dropdown */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className={clsx(
            "flex items-center gap-2 p-1 rounded-full transition-colors",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800",
            menuOpen && "bg-zinc-100 dark:bg-zinc-800",
          )}
          aria-label="User menu"
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <Avatar
            size="sm"
            name={user.name || user.email}
            src={user.avatarUrl}
          />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg dark:shadow-zinc-900/50 py-1.5 z-50">
            {/* User info */}
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {user.name || user.email.split("@")[0]}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {user.email}
              </p>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <Link
                href="/dashboard/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Settings size={16} className="text-zinc-400" />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <LogOut size={16} className="text-zinc-400" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
