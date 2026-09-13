"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Loader2,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { classesApi } from "@/lib/api/services";
import type { ClassItem } from "@/lib/api/types";
import { classNames } from "@/lib/utils";

const ROLE_VI: Record<string, string> = {
  STUDENT: "Học viên",
  LEADER: "Nhóm trưởng",
  LECTURER: "Giảng viên",
  SUPER_ADMIN: "Quản trị viên",
  MEMBER: "Thành viên",
};

/**
 * Class card with expandable roster (members + groups), fetched on demand.
 */
export function ClassCard({ item }: { item: ClassItem }) {
  const [open, setOpen] = React.useState(false);
  const detail = useQuery({
    queryKey: ["class", item.id],
    queryFn: () => classesApi.get(item.id),
    enabled: open,
  });

  const members = detail.data?.members ?? [];
  const groups = detail.data?.groups ?? item.groups ?? [];
  const memberCount =
    item._count?.members ?? item.members?.length ?? members.length;

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50/60"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#1d4ed8]/10 text-[#1d4ed8]">
          <BookOpen className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-slate-900">
            {item.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="font-mono font-bold text-slate-400">{item.code}</span>
            {item.hocPhan ? (
              <span className="rounded-md bg-sky-50 px-1.5 py-0.5 font-bold text-sky-700">
                {item.hocPhan.code} · {item.hocPhan.name}
              </span>
            ) : null}
            {item.province ? (
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {item.province.name}
              </span>
            ) : null}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">
          <span className="flex items-center justify-end gap-1 font-bold text-slate-700">
            <Users className="size-3.5" />
            {memberCount} thành viên
          </span>
          <span className="mt-0.5 block">
            {item.startDate
              ? `${new Date(item.startDate).toLocaleDateString("vi-VN")} → ${item.endDate ? new Date(item.endDate).toLocaleDateString("vi-VN") : "…"}`
              : "Chưa có lịch"}
          </span>
        </span>
        <ChevronDown
          className={classNames("size-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 py-3">
          {detail.isPending ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Đang tải danh sách…
            </p>
          ) : detail.isError ? (
            <p className="py-6 text-center text-sm text-rose-500">Không tải được chi tiết lớp.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Danh sách ({members.length})
                </p>
                {members.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">Lớp chưa có thành viên.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-[#1d4ed8] shadow-sm">
                          {(m.user?.fullName ?? "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate text-[13px] font-bold text-slate-800">
                            {m.user?.fullName ?? "Ẩn danh"}
                            {m.isLeader ? (
                              <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {m.user?.role ? (ROLE_VI[m.user.role] ?? m.user.role) : ""}
                            {m.group ? ` · ${m.group.name}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {new Date(m.joinedAt).toLocaleDateString("vi-VN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Nhóm ({groups.length})
                </p>
                {groups.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">Chưa chia nhóm.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {groups.map((g) => (
                      <li key={g.id} className="rounded-xl border border-slate-100 px-2.5 py-2">
                        <p className="truncate text-[13px] font-bold text-slate-800">{g.name}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-400">
                          <CalendarDays className="size-3" />
                          {members.filter((m) => m.groupId === g.id).length} thành viên
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
