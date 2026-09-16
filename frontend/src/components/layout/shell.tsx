"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, MapPin, Search } from "lucide-react";
import { classNames } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";
import { NotificationsDropdown } from "@/components/notifications/dropdown";

const NAV = [
  { href: "/", label: "Khám phá" },
  { href: "/map", label: "Bản đồ" },
  { href: "/routes", label: "Tuyến du lịch" },
  { href: "/tours", label: "Tour nổi bật" },
  { href: "/blog", label: "Blog / Cẩm nang" },
];

export function BrandMark({
  compact = false,
  tone = "dark",
}: {
  compact?: boolean;
  /** Light tone for transparent headers over imagery. */
  tone?: "dark" | "light";
}) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2">
      <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white shadow-sm">
        <MapPin className="size-4" />
      </span>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight">
          <span className={tone === "light" ? "text-white" : "text-slate-900"}>
            Viet
          </span>
          <span className={tone === "light" ? "text-sky-300" : "text-[#1d4ed8]"}>
            Journey
          </span>
        </span>
      )}
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "U";
}

const ROLE_VI: Record<string, string> = {
  STUDENT: "Học viên",
  LEADER: "Nhóm trưởng",
  LECTURER: "Giảng viên",
  SUPER_ADMIN: "Quản trị viên",
  MEMBER: "Thành viên",
};

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isAuthenticated, refresh } = useSession();
  const [open, setOpen] = React.useState(false);

  const logout = async () => {
    setOpen(false);
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
  // Transparent overlay variant on the home page (sits over the hero image).
  // The interactive map and member dashboard are fullscreen apps with
  // their own navigation.
  const overlay = pathname === "/";
  const fullscreen =
    pathname === "/map" ||
    pathname === "/me" ||
    pathname === "/studio/enter" ||
    pathname === "/studio/lecturer" ||
    pathname === "/studio/admin" ||
    pathname === "/studio/approvals" ||
    pathname === "/studio/classes";
  if (fullscreen) return null;

  return (
    <header
      className={classNames(
        "h-16",
        overlay
          ? "absolute inset-x-0 top-0 z-40 border-transparent bg-transparent"
          : "sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75",
      )}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center gap-5 px-5">
        <BrandMark tone={overlay ? "light" : "dark"} />

        <nav
          aria-label="Chính"
          className="hidden items-center gap-5 lg:flex"
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  "whitespace-nowrap text-sm font-medium transition-colors",
                  overlay
                    ? active
                      ? "text-white"
                      : "text-white/80 hover:text-white"
                    : active
                      ? "text-[#1d4ed8]"
                      : "text-slate-600 hover:text-slate-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/map"
            aria-label="Tìm kiếm"
            className={classNames(
              "grid size-9 place-items-center rounded-full transition-colors",
              overlay
                ? "border border-white/40 text-white hover:bg-white/15"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            <Search className="size-4" />
          </Link>
          <Link
            href="/itinerary/new"
            className={buttonClass({
              size: "sm",
              className: "hidden rounded-full px-4 font-semibold sm:inline-flex",
            })}
          >
            Xây dựng lộ trình
          </Link>
            {isAuthenticated && user ? (
            <>
              <NotificationsDropdown
                buttonClassName="relative grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                iconClassName="size-4"
                badgeClassName="absolute -right-0.5 -top-0.5 grid size-4 min-w-4 place-items-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white"
              />
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-label="Tài khoản"
                  aria-expanded={open}
                  className="flex items-center gap-2"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-sky-100 text-sm font-black text-[#1d4ed8]">
                    {initials(user.fullName)}
                  </span>
                  <span className="hidden text-left md:block">
                    <span
                      className={classNames(
                        "block max-w-28 truncate text-sm font-bold",
                        overlay ? "text-white" : "text-slate-900",
                      )}
                    >
                      {user.fullName}
                    </span>
                    <span
                      className={classNames(
                        "block text-xs",
                        overlay ? "text-white/70" : "text-slate-500",
                      )}
                    >
                      {ROLE_VI[user.role] ?? user.role}
                    </span>
                  </span>
                  <ChevronDown
                    className={classNames(
                      "size-4 transition-transform",
                      overlay ? "text-white/70" : "text-slate-400",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open ? (
                  <>
                    <button
                      type="button"
                      aria-label="Đóng menu"
                      onClick={() => setOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-slate-900/10">
                      <Link
                        href="/me"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Chuyến đi của tôi
                      </Link>
                      <Link
                        href="/me/profile"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Hồ sơ của tôi
                      </Link>
                      {user.role === "LECTURER" || user.role === "SUPER_ADMIN" ? (
                        <Link
                          href="/studio"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#1d4ed8] transition hover:bg-slate-50"
                        >
                          <LayoutDashboard className="size-4" />
                          Studio
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={logout}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <LogOut className="size-4 text-slate-400" />
                        Đăng xuất
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className={buttonClass({
                size: "sm",
                variant: "outline",
                className: classNames(
                  "rounded-full px-4",
                  overlay &&
                    "border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white",
                ),
              })}
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
