"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Mic,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { classNames } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";

export type MapMode = "public" | "training";

interface MapTopbarProps {
  q: string;
  onQChange: (value: string) => void;
  onSubmitSearch: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  unread: number;
  mode: MapMode;
  onMode: (mode: MapMode) => void;
}

/**
 * Floating toolbar of the interactive map: brand, search, filter toggle,
 * builder shortcut, notifications, account menu and Public/Training switch.
 */
export function MapTopbar({
  q,
  onQChange,
  onSubmitSearch,
  filtersOpen,
  onToggleFilters,
  unread,
  mode,
  onMode,
}: MapTopbarProps) {
  const { user } = useSession();
  const [menu, setMenu] = React.useState(false);

  const logout = async () => {
    setMenu(false);
    try {
      await fetch("/session/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-3 sm:gap-3 sm:px-4">
      <Link
        href="/"
        className="pointer-events-auto flex shrink-0 items-center gap-1.5"
        aria-label="VietJourney"
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white shadow">
          <MapIcon className="size-4" />
        </span>
        <span className="hidden text-lg font-extrabold tracking-tight xl:block">
          <span className="text-slate-900">Viet</span>
          <span className="text-[#1d4ed8]">Journey</span>
        </span>
      </Link>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitSearch();
        }}
        className="pointer-events-auto flex min-w-0 max-w-xl flex-1 items-center gap-2 rounded-xl bg-white/95 py-2 pl-3 pr-2 shadow-lg ring-1 ring-slate-900/5 backdrop-blur"
      >
        <Search className="size-4 shrink-0 text-slate-400" />
        <input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder={
            mode === "public"
              ? "Tìm điểm đến, tuyến đường, tour..."
              : "Tìm tour đào tạo, tuyến, lớp học..."
          }
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <Mic className="size-4 shrink-0 text-slate-400" />
      </form>

      <button
        type="button"
        onClick={onToggleFilters}
        className={classNames(
          "pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold shadow-lg ring-1 ring-slate-900/5 backdrop-blur transition",
          filtersOpen
            ? "bg-[#1d4ed8] text-white"
            : "bg-white/95 text-slate-600 hover:text-slate-900",
        )}
      >
        <SlidersHorizontal className="size-4" />
        <span className="hidden sm:inline">Filter</span>
      </button>

      <span className="hidden w-2 lg:block" />

      <Link
        href="/itinerary/new"
        className={buttonClass({ className: "pointer-events-auto hidden shrink-0 shadow-lg md:inline-flex" })}
      >
        <Plus className="size-4" />
        Xây dựng lộ trình
      </Link>

      <Link
        href="/notifications"
        className="pointer-events-auto relative grid size-10 shrink-0 place-items-center rounded-xl bg-white/95 text-slate-600 shadow-lg ring-1 ring-slate-900/5 backdrop-blur transition hover:text-slate-900"
        aria-label="Thông báo"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid size-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>

      <div className="pointer-events-auto relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          className="flex items-center gap-1"
          aria-label="Tài khoản"
        >
          <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-[#1d4ed8] text-sm font-bold text-white shadow-lg">
            {user?.fullName?.trim()?.charAt(0)?.toUpperCase() ?? "K"}
          </span>
          <ChevronDown className="size-4 text-slate-500" />
        </button>
        {menu ? (
          <>
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMenu(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <p className="truncate text-sm font-bold text-slate-900">
                  {user?.fullName ?? "Khách"}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.email ?? ""}</p>
              </div>
              <Link
                href="/me"
                onClick={() => setMenu(false)}
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Chuyến đi của tôi
              </Link>
              {user?.role === "LECTURER" || user?.role === "SUPER_ADMIN" ? (
                <Link
                  href="/studio"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#1d4ed8] hover:bg-slate-50"
                >
                  <LayoutDashboard className="size-4" />
                  Studio
                </Link>
              ) : null}
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

      <div className="pointer-events-auto hidden shrink-0 items-center rounded-xl bg-white/95 p-1 shadow-lg ring-1 ring-slate-900/5 backdrop-blur sm:flex">
        {(["public", "training"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            className={classNames(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              mode === m
                ? m === "public"
                  ? "bg-[#1d4ed8] text-white shadow"
                  : "bg-emerald-500 text-white shadow"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {m === "public" ? "Public" : "Training"}
          </button>
        ))}
      </div>
    </div>
  );
}
