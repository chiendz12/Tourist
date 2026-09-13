import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckSquare,
  Database,
  Download,
  Globe,
  MapPin,
  Server,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import {
  adminApi,
  authApi,
  destinationsApi,
  notificationsApi,
  provincesApi,
} from "@/lib/api/services";
import { buttonClass } from "@/components/ui/button";
import { DashboardShell } from "@/components/studio/dashboard-shell";
import { ExportButton, LockButton, Ring, StatCard } from "@/components/studio/widgets";
import { timeAgo } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/studio/admin", label: "Tổng quan hệ thống", icon: "home" },
  { href: "/studio/admin?tab=users", label: "Quản lý người dùng", icon: "users" },
  { href: "/studio/approvals", label: "Duyệt cuối (Publish)", icon: "check" },
  { href: "/studio/classes", label: "Quản lý dữ liệu", icon: "database" },
  { href: "/studio/lecturer", label: "Analytics toàn quốc", icon: "chart" },
];

const ROLE_VI: Record<string, string> = {
  STUDENT: "Sinh viên",
  LEADER: "Leader",
  LECTURER: "Giảng viên",
  SUPER_ADMIN: "Admin",
  MEMBER: "Thành viên",
  GUEST: "Khách",
};

const ROLE_TABS = ["all", "STUDENT", "LECTURER", "LEADER", "SUPER_ADMIN"] as const;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

/**
 * Super Admin dashboard: platform stats, province density, user
 * management, audit activity and quick actions.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; role?: string }>;
}) {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/studio/admin");
  if (me.role !== "SUPER_ADMIN") redirect("/studio");

  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();
  const role = (params.role ?? "all").toUpperCase();
  const roleFilter = (ROLE_TABS as readonly string[]).includes(role) && role !== "all" ? role : undefined;

  const [overviewTimed, users, audit, provinces, published, notifications] = await Promise.all([
    timed(() => adminApi.overview().catch(() => null)),
    adminApi
      .users({ limit: 12, ...(q ? { q } : {}), ...(roleFilter ? { role: roleFilter } : {}) })
      .catch(() => ({ data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } })),
    adminApi.audit({ limit: 8 }).catch(() => ({ data: [], meta: null as never })),
    provincesApi.list().catch(() => []),
    destinationsApi
      .bbox({ minLng: 100, minLat: 8, maxLng: 112, maxLat: 24, limit: 500 })
      .catch(() => []),
    notificationsApi.list({ limit: 10 }).catch(() => ({ data: [], meta: null as never })),
  ]);
  const overview = overviewTimed.value;
  const latencyMs = overviewTimed.ms;

  const quality =
    overview && overview.destinations > 0
      ? Math.round((overview.publishedDestinations / overview.destinations) * 100)
      : 0;

  const byProvince = new Map<string, number>();
  for (const d of published) {
    if (!d.provinceId) continue;
    byProvince.set(d.provinceId, (byProvince.get(d.provinceId) ?? 0) + 1);
  }
  const ranked = [...byProvince.entries()]
    .map(([id, count]) => ({
      name: provinces.find((p) => p.id === id)?.name ?? "Khác",
      count,
      share: published.length ? Math.round((count / published.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
  const top = ranked.slice(0, 5);
  const maxCount = top[0]?.count ?? 1;

  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;
  const auditItems = audit.data ?? [];

  return (
    <DashboardShell
      user={me}
      roleLabel="Super Admin"
      nav={ADMIN_NAV}
      title="Tổng quan hệ thống"
      subtitle="Toàn bộ hệ thống VietJourney"
      searchPlaceholder="Tìm kiếm người dùng…"
      unread={unread}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          icon={<MapPin className="size-4 text-sky-600" />}
          tint="bg-sky-50"
          label="Tổng điểm đã publish"
          value={(overview?.publishedDestinations ?? 0).toLocaleString("vi-VN")}
        />
        <StatCard
          icon={<Users className="size-4 text-amber-600" />}
          tint="bg-amber-50"
          label="Người dùng hoạt động"
          value={(overview?.users ?? 0).toLocaleString("vi-VN")}
        />
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <Ring pct={quality} />
          <div>
            <p className="text-[13px] font-medium text-slate-500">Tỷ lệ dữ liệu đã duyệt</p>
            <p className="text-2xl font-black tabular-nums text-slate-900">{quality}%</p>
          </div>
        </div>
        <StatCard
          icon={<Server className="size-4 text-emerald-600" />}
          tint="bg-emerald-50"
          label="Server Status"
          value={overview ? "Ổn định" : "Gián đoạn"}
          sub={overview ? `API · ${latencyMs}ms` : "Không kết nối được API"}
        />
        <StatCard
          icon={<ShieldCheck className="size-4 text-violet-600" />}
          tint="bg-violet-50"
          label="Duyệt cuối chờ xử lý"
          value={overview?.pendingApprovals ?? 0}
        />
        <Link
          href="/studio/approvals"
          className="flex items-center justify-between gap-2 rounded-2xl bg-[#1d4ed8] p-4 text-white shadow-sm transition hover:bg-blue-700"
        >
          <span>
            <span className="block text-sm font-bold">Publish to Public</span>
            <span className="mt-0.5 block text-xs text-white/75">Duyệt và xuất bản dữ liệu</span>
          </span>
          <ArrowRight className="size-5 shrink-0" />
        </Link>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[280px_1fr_340px]">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <h2 className="text-base font-bold text-slate-900">Mật độ dữ liệu toàn quốc</h2>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {["Rất cao", "Cao", "Trung bình", "Thấp", "Rất thấp"].map((t, i) => (
              <li key={t} className="flex items-center gap-1">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: ["#15803d", "#22c55e", "#86efac", "#bbf7d0", "#dcfce7"][i] }}
                />
                {t}
              </li>
            ))}
          </ul>
          {top.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Chưa có dữ liệu.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {top.map((p, i) => (
                <li key={p.name}>
                  <p className="flex items-center gap-2 text-[13px]">
                    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-black text-slate-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate font-semibold text-slate-700">{p.name}</span>
                    <span className="font-black tabular-nums text-slate-900">{p.share}%</span>
                  </p>
                  <p className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(Math.round((p.count / maxCount) * 100), 5)}%` }}
                    />
                  </p>
                  <p className="mt-0.5 text-right text-[11px] tabular-nums text-slate-400">
                    {p.count} điểm
                  </p>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-2 block text-right text-xs font-bold text-[#1d4ed8]">
            {published.length} điểm trên bản đồ
          </span>
        </section>

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Quản lý người dùng</h2>
            <span className="text-xs text-slate-400">{users.meta.total} tài khoản</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ROLE_TABS.map((r) => {
              const href = r === "all" ? "/studio/admin" : `/studio/admin?role=${r}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
              const active = (r === "all" && !roleFilter) || r === roleFilter;
              return (
                <Link
                  key={r}
                  href={href}
                  className={
                    active
                      ? "rounded-lg bg-[#1d4ed8] px-2.5 py-1.5 text-xs font-bold text-white shadow"
                      : "rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                  }
                >
                  {r === "all" ? "Tất cả" : (ROLE_VI[r] ?? r)}
                </Link>
              );
            })}
          </div>
          {users.data.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Không tìm thấy tài khoản nào.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {users.data.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-100 px-2.5 py-2"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1d4ed8]/10 text-xs font-black text-[#1d4ed8]">
                    {u.fullName.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-slate-800">
                      {u.fullName}
                    </span>
                    <span className="block truncate text-xs text-slate-400">@{u.username}</span>
                  </span>
                  <span className="hidden rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 sm:block">
                    {ROLE_VI[u.role] ?? u.role}
                  </span>
                  <span
                    className={
                      u.isActive
                        ? "hidden rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600 md:block"
                        : "hidden rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-600 md:block"
                    }
                  >
                    {u.isActive ? "Hoạt động" : "Tạm khóa"}
                  </span>
                  <LockButton id={u.id} isActive={u.isActive} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Hoạt động hệ thống</h2>
            <span className="text-xs font-bold text-[#1d4ed8]">Nhật ký kiểm toán</span>
          </div>
          {auditItems.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Chưa ghi nhận hoạt động nào.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {auditItems.slice(0, 7).map((a) => (
                <li key={a.id} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                    {(a.user?.fullName ?? "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-snug text-slate-600">
                      <strong className="text-slate-800">{a.user?.fullName ?? "Hệ thống"}</strong>{" "}
                      · {a.action}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {a.entity}
                      {a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ""} · {timeAgo(a.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
        <p className="mr-1 text-[13px] font-bold text-slate-700">Thao tác nhanh</p>
        <Link href="/studio/classes" className={buttonClass({ variant: "outline", size: "sm" })}>
          <Database className="size-4" />
          Tạo học phần mới
        </Link>
        <Link href="/studio/classes" className={buttonClass({ variant: "outline", size: "sm" })}>
          <Globe className="size-4" />
          Phân công tỉnh mới
        </Link>
        <Link href="/studio/approvals" className={buttonClass({ variant: "outline", size: "sm" })}>
          <CheckSquare className="size-4" />
          Duyệt hàng loạt
        </Link>
        <ExportButton
          filename="nguoi-dung.csv"
          rows={users.data.map((u) => ({
            ho_ten: u.fullName,
            email: u.email,
            username: u.username,
            vai_tro: u.role,
            trang_thai: u.isActive ? "Hoạt động" : "Tạm khóa",
            ngay_tao: u.createdAt,
          }))}
          label="Export báo cáo Excel"
        />
        <span
          title="Chưa hỗ trợ nhập liệu hàng loạt"
          className="flex cursor-default items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-bold text-slate-400"
        >
          <Download className="size-4" />
          Import dữ liệu
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          <Star className="size-3.5" />
          {overview
            ? `${overview.routes} tuyến · ${overview.tours} tour · ${overview.suppliers} NCC`
            : "—"}
        </span>
      </section>
    </DashboardShell>
  );
}
