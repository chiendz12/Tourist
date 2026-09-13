"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Database,
  Globe,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Map as MapIcon,
  PenSquare,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import type { CurrentUser } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { classNames } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  map: MapIcon,
  book: BookOpen,
  briefcase: ClipboardList,
  chart: BarChart3,
  bell: Bell,
  users: Users,
  globe: Globe,
  check: CheckSquare,
  database: Database,
  settings: Settings,
  star: Star,
  shield: ShieldCheck,
  layers: Layers,
  pen: PenSquare,
  grad: GraduationCap,
};

export interface StudioNavItem {
  href: string;
  label: string;
  icon: string;
}

interface DashboardShellProps {
  user: CurrentUser;
  roleLabel: string;
  nav: StudioNavItem[];
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  unread: number;
  children: React.ReactNode;
}

/**
 * Shared chrome for staff dashboards: dark sidebar, topbar with search,
 * notifications and account menu.
 */
export function DashboardShell({
  user,
  roleLabel,
  nav,
  title,
  subtitle,
  searchPlaceholder,
  unread,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { refresh } = useSession();
  const [menu, setMenu] = React.useState(false);
  const [q, setQ] = React.useState(search.get("q") ?? "");

  const logout = async () => {
    try {
      await fetch("/session/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    // Hard navigation: drops SessionContext + router cache entirely. A
    // client-side replace can land on /login while stale session state is
    // still committed, and the login page then bounces straight to /me.
    try {
      await refresh();
    } catch {
      /* session already gone */
    }
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-dvh bg-slate-100">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-[#0a1628] p-4 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 px-1.5">
          <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white">
            <MapIcon className="size-4" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-white">Viet</span>
            <span className="text-sky-400">Journey</span>
          </span>
        </Link>
        <p className="mt-2 inline-block w-fit rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-200">
          {roleLabel}
        </p>
        <nav className="mt-4 flex-1 space-y-1">
          {nav.map((item) => {
            const Icon = ICONS[item.icon] ?? Home;
            const active =
              item.href === "/studio"
                ? pathname === "/studio"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={classNames(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[#1d4ed8] text-white shadow"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-white/10 pt-3">
          <span
            title="Sắp hỗ trợ"
            className="flex cursor-default items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400"
          >
            <Settings className="size-[18px] shrink-0" />
            Cài đặt
          </span>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-[18px] shrink-0" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center gap-3">
          <div className="min-w-44 flex-1">
            <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
          </div>
          <form
            action={pathname}
            method="get"
            className="flex min-w-52 max-w-md flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm"
          >
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </form>
          <Link
            href="/notifications"
            aria-label="Thông báo"
            className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900"
          >
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 grid size-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="flex items-center gap-2"
            >
              <span className="grid size-10 place-items-center rounded-full bg-[#1d4ed8]/10 text-sm font-black text-[#1d4ed8]">
                {(user.fullName ?? user.email).trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left md:block">
                <span className="block max-w-32 truncate text-[13px] font-bold text-slate-900">
                  {user.fullName}
                </span>
                <span className="block text-xs text-slate-500">{roleLabel}</span>
              </span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>
            {menu ? (
              <>
                <button
                  type="button"
                  aria-label="Đóng menu"
                  onClick={() => setMenu(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
                  <Link
                    href="/me"
                    onClick={() => setMenu(false)}
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Hồ sơ của tôi
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <LogOut className="size-4" />
                    Đăng xuất
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
