"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { notificationsApi } from "@/lib/api/services";
import type { Notification } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { classNames, timeAgo } from "@/lib/utils";

/**
 * Where a click on the notification should land.
 * - USER_APPROVAL (new student/lecturer account): the review queue of the
 *   viewer's role (admin overview, lecturer class overview).
 * - APPROVAL with a pending status: the approval kanban.
 * - APPROVAL with a terminal status: the public entity page when one exists,
 *   otherwise the author's own data list.
 */
function targetFor(n: Notification, viewerRole?: string): string | null {
  const data = n.data ?? {};
  if (n.type === "USER_APPROVAL") {
    if (data.role === "LECTURER") return "/studio/admin";
    if (viewerRole === "SUPER_ADMIN") return "/studio/admin";
    if (viewerRole === "LECTURER") return "/studio/lecturer";
    return "/studio/admin";
  }
  if (n.type === "APPROVAL") {
    const { entityType, entityId, status } = data;
    if (status === "PENDING_LEADER" || status === "PENDING_LECTURER" || status === "PENDING_ADMIN") {
      return "/studio/approvals";
    }
    if (entityType && entityId) {
      if (status === "PUBLISHED") {
        if (entityType === "DESTINATION") return `/destinations/${entityId}`;
        if (entityType === "ROUTE") return `/routes/${entityId}`;
        if (entityType === "TOUR") return `/tours/${entityId}`;
      }
      if (status === "REJECTED" || status === "DRAFT") return "/studio/mine";
      if (entityType === "DESTINATION") return `/destinations/${entityId}`;
      if (entityType === "ROUTE") return `/routes/${entityId}`;
      if (entityType === "TOUR") return `/tours/${entityId}`;
      return "/studio/approvals";
    }
    return "/studio/approvals";
  }
  return null;
}

interface NotificationsDropdownProps {
  buttonClassName: string;
  iconClassName?: string;
  badgeClassName?: string;
  /** Extra classes for the relative wrapper (e.g. pointer-events-auto). */
  wrapperClassName?: string;
}

/**
 * Bell button opening the notification inbox as a dropdown.
 * Badge, list and read-state all come from its own query; there is no
 * separate notifications page.
 */
export function NotificationsDropdown({
  buttonClassName,
  iconClassName = "size-5",
  badgeClassName = "absolute -right-1 -top-1 grid size-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white",
  wrapperClassName = "relative shrink-0",
}: NotificationsDropdownProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  const list = useQuery({
    queryKey: ["notifications", "dropdown"],
    queryFn: () => notificationsApi.list({ limit: 30 }),
    staleTime: 30_000,
    retry: false,
  });
  const items = list.data?.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["notifications", "dropdown"] });

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
    } catch {
      /* already read or offline */
    } finally {
      void refresh();
    }
  };

  const openItem = async (n: Notification) => {
    try {
      await notificationsApi.markRead(n.id);
    } catch {
      /* already read or offline */
    } finally {
      void refresh();
    }
    const target = targetFor(n, user?.role);
    setOpen(false);
    if (target) router.push(target);
  };

  return (
    <div ref={boxRef} className={wrapperClassName}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Thông báo"
        aria-expanded={open}
        className={buttonClassName}
      >
        <Bell className={iconClassName} />
        {unread > 0 ? (
          <span className={badgeClassName}>{unread > 9 ? "9+" : unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-black text-slate-900">
              Thông báo
              {unread > 0 ? <span className="ml-1.5 text-xs font-bold text-rose-500">{unread} mới</span> : null}
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="flex items-center gap-1 text-xs font-bold text-[#1d4ed8] hover:underline"
              >
                <CheckCheck className="size-3.5" />
                Đánh dấu đã đọc
              </button>
            ) : null}
          </div>
          {list.isPending ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Đang tải…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(n)}
                    className={classNames(
                      "flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-slate-50",
                      !n.readAt && "bg-[#1d4ed8]/[0.03]",
                    )}
                  >
                    <span
                      className={classNames(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.readAt ? "bg-slate-200" : "bg-[#1d4ed8]",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold leading-snug text-slate-800">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{n.body}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
