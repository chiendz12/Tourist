import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  adminApi,
  approvalsApi,
  authApi,
  destinationsApi,
  notificationsApi,
  provincesApi,
} from "@/lib/api/services";
import { classesApi } from "@/lib/api/services";
import type { ClassItem } from "@/lib/api/types";
import { buttonClass } from "@/components/ui/button";
import { UserApprovalButtons } from "@/components/studio/user-approval-buttons";
import { DashboardShell } from "@/components/studio/dashboard-shell";
import { ExportButton, Ring, StatCard } from "@/components/studio/widgets";
import { timeAgo } from "@/lib/utils";

const LECTURER_NAV = [
  { href: "/studio/lecturer", label: "Tổng quan lớp học", icon: "home" },
  { href: "/studio/classes", label: "Các học phần đang dạy", icon: "book" },
  { href: "/studio/classes", label: "Phân công tỉnh / nhóm", icon: "users" },
  { href: "/studio/approvals", label: "Duyệt dữ liệu (Kanban)", icon: "check" },
  { href: "/studio/admin", label: "Báo cáo sinh viên", icon: "chart" },
];

function memberCount(c: ClassItem): number | null {
  if (typeof c._count?.members === "number") return c._count.members;
  if (Array.isArray(c.members)) return c.members.length;
  if (Array.isArray(c.groups)) {
    return c.groups.length;
  }
  return null;
}

function classNameOf(c: ClassItem): string {
  return c.name || c.code || "Lớp học";
}

/**
 * Lecturer dashboard: class stats, approval progress, review queue,
 * province density and managed classes.
 */
export default async function LecturerPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/studio/lecturer");
  if (me.role !== "LECTURER" && me.role !== "SUPER_ADMIN") redirect("/studio");

  const q = ((await searchParams)?.q ?? "").trim().toLowerCase();
  const [classes, summary, queue, pendingUsersData, provinces, published, notifications] = await Promise.all([
    classesApi.list().catch(() => []),
    approvalsApi
      .summary()
      .catch((): { total: number; pending: number; byStatus: Record<string, number> } => ({
        total: 0,
        pending: 0,
        byStatus: {},
      })),
    approvalsApi
      .queue({ limit: 50 })
      .catch(() => ({ data: [], meta: null as never })),
    adminApi.pendingUsers({ limit: 20 }).catch(() => ({ data: [], meta: null as never })),
    provincesApi.list().catch(() => []),
    destinationsApi
      .bbox({ minLng: 100, minLat: 8, maxLng: 112, maxLat: 24, limit: 500 })
      .catch(() => []),
    notificationsApi.list({ limit: 10 }).catch(() => ({ data: [], meta: null as never })),
  ]);

  const memberCounts = classes.map(memberCount);
  const totalStudents = memberCounts.some((n) => n == null)
    ? null
    : (memberCounts as number[]).reduce((s, n) => s + n, 0);
  const approved = summary.byStatus.PUBLISHED ?? 0;
  const rate = summary.total > 0 ? Math.round((approved / summary.total) * 100) : 0;

  const queueRows = queue.data ?? [];
  const filteredQueue = q
    ? queueRows.filter((r) =>
        `${r.entityType} ${r.entity?.name ?? ""} ${r.entityId} ${r.status} ${r.currentLevel} ${r.submittedBy?.fullName ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : queueRows;
  const pendingQueue = filteredQueue.filter((r) =>
    ["PENDING_LEADER", "PENDING_LECTURER", "PENDING_ADMIN"].includes(r.status),
  );
  // Server already scopes this to pending STUDENT registrations for lecturers.
  const pendingStudents = pendingUsersData.data ?? [];

  const byProvince = new Map<string, number>();
  for (const d of published) {
    if (!d.provinceId) continue;
    byProvince.set(d.provinceId, (byProvince.get(d.provinceId) ?? 0) + 1);
  }
  const topProvinces = [...byProvince.entries()]
    .map(([id, count]) => ({
      name: provinces.find((p) => p.id === id)?.name ?? "Khác",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxProvince = topProvinces[0]?.count ?? 1;

  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;

  return (
    <DashboardShell
      user={me}
      roleLabel="Giảng viên"
      nav={LECTURER_NAV}
      title="Tổng quan lớp học"
      subtitle="Học phần: QTDL & Lữ hành"
      searchPlaceholder="Tìm kiếm trong hàng đợi duyệt…"
      unread={unread}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportButton
          filename="hang-doi-duyet.csv"
          rows={filteredQueue.map((r) => ({
            loai: r.entityType,
            ma: r.entityId,
            trang_thai: r.status,
            cap: r.currentLevel,
            cap_nhat: r.updatedAt,
          }))}
          label="Xuất báo cáo"
        />
        <Link href="/studio/approvals" className={buttonClass({ size: "sm" })}>
          Mở Kanban duyệt
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BookOpen className="size-4 text-sky-600" />}
          tint="bg-sky-50"
          label="Số lớp đang dạy"
          value={classes.length}
        />
        <StatCard
          icon={<Users className="size-4 text-indigo-600" />}
          tint="bg-indigo-50"
          label="Tổng sinh viên"
          value={totalStudents ?? "—"}
          sub={totalStudents == null ? "Chưa có dữ liệu sĩ số" : undefined}
        />
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <Ring pct={rate} />
          <div>
            <p className="text-[13px] font-medium text-slate-500">Tỷ lệ dữ liệu đã duyệt</p>
            <p className="text-2xl font-black tabular-nums text-slate-900">{rate}%</p>
            <p className="text-xs text-slate-400">
              {approved}/{summary.total} hồ sơ
            </p>
          </div>
        </div>
        <StatCard
          icon={<ShieldCheck className="size-4 text-amber-600" />}
          tint="bg-amber-50"
          label="Số điểm cần duyệt"
          value={summary.pending}
          sub="Đang chờ các cấp"
        />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Tài khoản sinh viên chờ duyệt
              </h2>
              <span className="rounded-md bg-amber-100 px-1.5 text-xs font-bold text-amber-700">
                {pendingStudents.length}
              </span>
            </div>
            {pendingStudents.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Không có tài khoản nào đang chờ.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {pendingStudents.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-2"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1d4ed8]/10 text-xs font-black text-[#1d4ed8]">
                      {u.fullName.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-slate-800">
                        {u.fullName}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {u.email} · {timeAgo(u.createdAt)}
                      </span>
                    </span>
                    <UserApprovalButtons id={u.id} fullName={u.fullName} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Hàng đợi duyệt {q ? `· “${q}”` : ""}
              </h2>
              <Link href="/studio/approvals" className="text-xs font-bold text-[#1d4ed8] hover:underline">
                Xem Kanban →
              </Link>
            </div>
            {pendingQueue.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Không có hồ sơ nào đang chờ.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {pendingQueue.slice(0, 8).map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5"
                  >
                    {r.entity?.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.entity.images[0]}
                        alt=""
                        loading="lazy"
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-slate-800">
                        {r.entity?.name ?? `${r.entityType} · ${r.entityId.slice(0, 8)}…`}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {r.entityType}
                        {r.submittedBy ? ` · ${r.submittedBy.fullName}` : ""}
                        {r.entity?.province ? ` · ${r.entity.province.name}` : ""}
                      </span>
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      {r.status}
                    </span>
                    <span className="text-xs text-slate-400">{timeAgo(r.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
            <h2 className="text-base font-bold text-slate-900">Mật độ điểm đã duyệt theo tỉnh</h2>
            {topProvinces.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Chưa có dữ liệu.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {topProvinces.map((p) => (
                  <li key={p.name}>
                    <p className="flex justify-between text-[13px]">
                      <span className="font-semibold text-slate-700">{p.name}</span>
                      <span className="font-black tabular-nums text-slate-900">{p.count}</span>
                    </p>
                    <p className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-sky-400"
                        style={{ width: `${Math.max(Math.round((p.count / maxProvince) * 100), 4)}%` }}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <GraduationCap className="size-5 text-slate-400" />
                Lớp đang quản lý
              </h2>
              <Link href="/studio/classes" className="text-xs font-bold text-[#1d4ed8] hover:underline">
                Quản lý lớp →
              </Link>
            </div>
            {classes.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Chưa có lớp nào được phân công.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {classes.slice(0, 6).map((c, i) => (
                  <li key={i} className="rounded-xl border border-slate-100 p-3">
                    <p className="truncate text-sm font-bold text-slate-900">{classNameOf(c)}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Users className="size-3.5" />
                      {memberCounts[i] ?? "—"} thành viên
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Hoạt động gần đây</h2>
            <Link href="/notifications" className="text-xs font-bold text-[#1d4ed8] hover:underline">
              Xem tất cả
            </Link>
          </div>
          {(notifications.data ?? []).length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Chưa có hoạt động nào.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {(notifications.data ?? []).slice(0, 6).map((n) => (
                <li key={n.id} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#1d4ed8]/10 text-xs font-black text-[#1d4ed8]">
                    {n.title.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-slate-800">{n.title}</span>
                    <span className="block truncate text-xs text-slate-500">{n.body}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <CheckSquare className="size-3" />
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
