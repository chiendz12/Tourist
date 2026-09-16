"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckSquare,
  ChevronDown,
  Clock3,
  Database,
  Home,
  Layers,
  LogOut,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  approvalsApi,
  destinationsApi,
} from "@/lib/api/services";
import type {
  ApprovalRecord,
  CurrentUser,
  Destination,
  Province,
} from "@/lib/api/types";
import { classNames, timeAgo } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ExportButton } from "@/components/studio/widgets";
import { ApprovalDetailInline } from "@/components/studio/approval-detail";
import { NotificationsDropdown } from "@/components/notifications/dropdown";

type ViewMode = "kanban" | "list";
type SortMode = "new" | "old" | "name";

interface ApprovalBoardProps {
  user: CurrentUser;
  items: ApprovalRecord[];
  summary: { total: number; pending: number; byStatus: Record<string, number> };
  provinces: Province[];
}

const PENDING = ["PENDING_LEADER", "PENDING_LECTURER", "PENDING_ADMIN"];

/** Module-scope clock read (render bodies may not call Date.now). */
function weekAgo(): number {
  return Date.now() - 7 * 86400000;
}

function columnOf(status: string): "draft" | "leader" | "lecturer" | "published" | null {
  if (status === "DRAFT" || status === "REJECTED") return "draft";
  if (status === "PENDING_LEADER") return "leader";
  if (status === "PENDING_LECTURER" || status === "PENDING_ADMIN") return "lecturer";
  if (status === "PUBLISHED") return "published";
  return null;
}

const COLUMNS: Array<{
  key: "draft" | "leader" | "lecturer" | "published";
  title: string;
  tint: string;
  badge: string;
}> = [
  { key: "draft", title: "Student Draft", tint: "bg-slate-50 ring-slate-200", badge: "bg-slate-500" },
  { key: "leader", title: "Chờ Leader Duyệt", tint: "bg-amber-50/50 ring-amber-200", badge: "bg-amber-500" },
  { key: "lecturer", title: "Chờ Giảng viên Duyệt", tint: "bg-orange-50/50 ring-orange-200", badge: "bg-orange-500" },
  { key: "published", title: "Đã Duyệt / Published", tint: "bg-emerald-50/50 ring-emerald-200", badge: "bg-emerald-500" },
];

/**
 * Approval workflow board: rail, stats, toolbar, kanban columns and the
 * detail panel. Review actions hit the real PATCH review endpoint.
 */
export function ApprovalBoard({ user, items, summary, provinces }: ApprovalBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [provinceId, setProvinceId] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortMode>("new");
  const [view, setView] = React.useState<ViewMode>("kanban");
  const [groupProvince, setGroupProvince] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [showAllProvinces, setShowAllProvinces] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(items[0]?.id ?? null);
  const [covers, setCovers] = React.useState<Map<string, Destination>>(new Map());
  const [menu, setMenu] = React.useState(false);

  const logout = async () => {
    setMenu(false);
    try {
      await fetch("/session/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    // Hard navigation: drops SessionContext + router cache entirely. A
    // client-side replace can land on /login while stale session state is
    // still committed, and the login page then bounces straight to /me.
    window.location.href = "/login";
  };

  const review = useMutation({
    mutationFn: (input: { id: string; action: "APPROVE" | "REJECT"; comment?: string }) =>
      approvalsApi.review(input.id, { action: input.action, comment: input.comment }),
    onSuccess: (_, input) => {
      toast({
        title: input.action === "APPROVE" ? "Đã duyệt" : "Đã trả lại",
        variant: "success",
      });
      router.refresh();
    },
    onError: (e) => {
      toast({ title: "Thao tác thất bại", description: e instanceof Error ? e.message : undefined, variant: "error" });
    },
  });

  // Resolve destination covers for cards linked to destinations.
  React.useEffect(() => {
    const ids = items
      .filter((r) => r.entityType === "DESTINATION" && !r.entity?.images?.length)
      .map((r) => r.entityId)
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, 20);
    if (!ids.length) return;
    void (async () => {
      const results = await Promise.allSettled(ids.map((id) => destinationsApi.get(id).catch(() => null)));
      setCovers((prev) => {
        const next = new Map(prev);
        ids.forEach((id, i) => {
          if (results[i].status === "fulfilled" && results[i].value) next.set(id, results[i].value);
        });
        return next;
      });
    })();
  }, [items]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = items.filter((r) => {
      if (provinceId && r.entity?.province?.id !== provinceId) {
        // Fall back to matching by province name for entities without id.
        const pname = provinces.find((p) => p.id === provinceId)?.name;
        if (!pname || r.entity?.province?.name !== pname) return false;
      }
      if (statusFilter === "pending" && !PENDING.includes(r.status)) return false;
      if (statusFilter === "published" && r.status !== "PUBLISHED") return false;
      if (statusFilter === "draft" && r.status !== "DRAFT" && r.status !== "REJECTED") return false;
      if (needle) {
        const hay = `${r.entity?.name ?? ""} ${r.submittedBy?.fullName ?? ""} ${r.submittedBy?.username ?? ""} ${r.entityId}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "old") return a.updatedAt.localeCompare(b.updatedAt);
      if (sort === "name") return (a.entity?.name ?? "").localeCompare(b.entity?.name ?? "");
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return list;
  }, [items, q, provinceId, statusFilter, sort, provinces]);

  const selected = filtered.find((r) => r.id === selectedId) ?? items.find((r) => r.id === selectedId) ?? null;

  const byStatus = summary.byStatus;
  const publishedWeek = filtered.filter(
    (r) => r.status === "PUBLISHED" && Date.parse(r.updatedAt) > weekAgo(),
  ).length;
  const approvedTotal = byStatus.PUBLISHED ?? 0;
  const rate = summary.total > 0 ? Math.round((approvedTotal / summary.total) * 100) : 0;

  const submitters = React.useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const r of items) {
      const id = r.submittedBy?.id ?? r.entityId;
      const prev = map.get(id) ?? { name: r.submittedBy?.fullName ?? "Ẩn danh", count: 0 };
      prev.count += 1;
      map.set(id, prev);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [items]);

  const provinceCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of items) {
      const name = r.entity?.province?.name;
      if (name) map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const coverOf = (r: ApprovalRecord): string | undefined =>
    r.entity?.images?.[0] ?? (r.entityType === "DESTINATION" ? covers.get(r.entityId)?.images?.[0] : undefined);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-100 text-slate-900">
      {/* Rail */}
      <aside className={classNames("hidden shrink-0 flex-col bg-white py-4 shadow-sm md:flex", collapsed ? "w-16 items-center px-2" : "w-60 px-3")}>
        <Link href="/" className="flex items-center gap-2 px-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white">
            <MapIcon className="size-4" />
          </span>
          {collapsed ? null : (
            <span className="text-base font-extrabold tracking-tight">
              <span className="text-slate-900">Viet</span>
              <span className="text-[#1d4ed8]">Journey</span>
            </span>
          )}
        </Link>
        <nav className="mt-5 w-full flex-1 space-y-4 overflow-y-auto text-sm">
          <div>
            {collapsed ? null : (
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Tổng quan</p>
            )}
            <RailLink href="/studio/approvals" icon={<Home className="size-[18px]" />} label="Tất cả dữ liệu" collapsed={collapsed} active />
            <RailLink
              href="/studio/approvals"
              icon={<Clock3 className="size-[18px]" />}
              label="Đang chờ duyệt"
              collapsed={collapsed}
              badge={String(summary.pending)}
              badgeTint="bg-orange-100 text-orange-600"
            />
            <RailLink
              href="/studio/approvals"
              icon={<CheckSquare className="size-[18px]" />}
              label="Đã duyệt"
              collapsed={collapsed}
              badge={String(approvedTotal)}
              badgeTint="bg-emerald-100 text-emerald-600"
            />
            <RailLink
              href="/studio/approvals"
              icon={<X className="size-[18px]" />}
              label="Bị trả lại"
              collapsed={collapsed}
              badge={String(byStatus.REJECTED ?? 0)}
              badgeTint="bg-rose-100 text-rose-600"
            />
          </div>
          <div>
            {collapsed ? null : (
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Theo khu vực</p>
            )}
            {(showAllProvinces ? provinceCounts : provinceCounts.slice(0, 5)).map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  const p = provinces.find((x) => x.name === name);
                  setProvinceId(p && provinceId !== p.id ? p.id : "");
                }}
                title={name}
                className={classNames(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-100",
                  collapsed && "justify-center",
                )}
              >
                <MapPin className="size-[18px] shrink-0 text-slate-400" />
                {collapsed ? null : (
                  <>
                    <span className="flex-1 truncate font-medium text-slate-600">{name}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 text-xs font-bold text-slate-500">{count}</span>
                  </>
                )}
              </button>
            ))}
            {provinceCounts.length > 5 && !collapsed ? (
              <button
                type="button"
                onClick={() => setShowAllProvinces((v) => !v)}
                className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#1d4ed8] hover:underline"
              >
                {showAllProvinces ? "Thu gọn" : "Xem tất cả tỉnh"}
                <ArrowRight className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div>
            {collapsed ? null : (
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Báo cáo & thống kê</p>
            )}
            <RailLink href="/studio/lecturer" icon={<BarChart3 className="size-[18px]" />} label="Thống kê tổng quan" collapsed={collapsed} />
            <RailLink href="/studio/admin" icon={<Database className="size-[18px]" />} label="Quản lý dữ liệu" collapsed={collapsed} />
          </div>
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-100"
        >
          <span className={classNames("transition-transform", collapsed && "rotate-180")}>‹</span>
          {collapsed ? null : "Thu gọn menu"}
        </button>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          <h1 className="mr-auto min-w-40 flex-1 text-base font-black tracking-tight sm:text-lg">
            Quản lý Duyệt Dữ liệu – Học phần QTDL & Lữ hành
          </h1>
          <div className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:max-w-xs">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm điểm đến, sinh viên, tỉnh…"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <select
            value={provinceId}
            onChange={(e) => setProvinceId(e.target.value)}
            aria-label="Lọc tỉnh"
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-600 outline-none"
          >
            <option value="">Tỉnh/Vùng: Tất cả</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc trạng thái"
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-600 outline-none"
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="pending">Đang chờ duyệt</option>
            <option value="published">Đã duyệt</option>
            <option value="draft">Nháp / Bị trả lại</option>
          </select>
          <Link href="/map" className={buttonClass({ variant: "outline", size: "sm" })}>
            <MapIcon className="size-4" />
            <span className="hidden xl:inline">View Map</span>
          </Link>
          <ExportButton
            filename="bao-cao-duyet.csv"
            rows={filtered.map((r) => ({
              ten: r.entity?.name ?? r.entityId,
              loai: r.entityType,
              trang_thai: r.status,
              cap: r.currentLevel,
              nguoi_nop: r.submittedBy?.fullName ?? "",
              tinh: r.entity?.province?.name ?? "",
              cap_nhat: r.updatedAt,
            }))}
            label="Báo cáo thống kê"
          />
          <NotificationsDropdown
            buttonClassName="relative grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:text-slate-900"
            iconClassName="size-4"
            badgeClassName="absolute -right-1 -top-1 grid size-4 min-w-4 place-items-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white"
          />
          <div className="relative hidden shrink-0 md:block">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="flex items-center gap-2"
              aria-label="Tài khoản"
            >
              <span className="grid size-9 place-items-center rounded-full bg-[#1d4ed8]/10 text-xs font-black text-[#1d4ed8]">
                {(user.fullName ?? user.email).trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left xl:block">
                <span className="block max-w-28 truncate text-[13px] font-bold">{user.fullName}</span>
                <span className="block text-[11px] text-slate-400">{user.role}</span>
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

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
          <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto p-3 sm:p-4">
            <div className="grid shrink-0 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
              <MiniStat label="Tổng điểm cần duyệt" value={summary.total} tint="bg-sky-50 text-sky-600" icon={<Layers className="size-4" />} />
              <MiniStat label="Chờ Leader duyệt" value={byStatus.PENDING_LEADER ?? 0} tint="bg-amber-50 text-amber-600" icon={<Clock3 className="size-4" />} sub="Ưu tiên xử lý" />
              <MiniStat label="Chờ GV duyệt" value={(byStatus.PENDING_LECTURER ?? 0) + (byStatus.PENDING_ADMIN ?? 0)} tint="bg-orange-50 text-orange-600" icon={<Users className="size-4" />} />
              <MiniStat label="Đã duyệt tuần này" value={publishedWeek} tint="bg-emerald-50 text-emerald-600" icon={<Check className="size-4" />} />
              <MiniStat label="Tỷ lệ duyệt" value={`${rate}%`} tint="bg-violet-50 text-violet-600" icon={<ShieldCheck className="size-4" />} />
              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
                <p className="text-xs font-bold text-slate-700">Sinh viên nổi bật</p>
                <ul className="mt-1.5 space-y-1">
                  {submitters.map((s) => (
                    <li key={s.name} className="truncate text-xs text-slate-500">
                      <strong className="text-slate-700">{s.name}</strong> · {s.count} hồ sơ
                    </li>
                  ))}
                  {submitters.length === 0 ? <li className="text-xs text-slate-400">—</li> : null}
                </ul>
              </div>
            </div>

            <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-900/5">
                {(["kanban", "list"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setView(m)}
                    className={classNames(
                      "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                      view === m ? "bg-[#1d4ed8]/10 text-[#1d4ed8]" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {m === "kanban" ? "Kanban" : "Danh sách"}
                  </button>
                ))}
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                aria-label="Sắp xếp"
                className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none"
              >
                <option value="new">Sắp xếp: Mới nhất</option>
                <option value="old">Sắp xếp: Cũ nhất</option>
                <option value="name">Sắp xếp: Tên A–Z</option>
              </select>
              <button
                type="button"
                onClick={() => setGroupProvince((v) => !v)}
                className={classNames(
                  "h-9 rounded-xl border px-2.5 text-xs font-bold transition",
                  groupProvince ? "border-[#1d4ed8] bg-[#1d4ed8]/5 text-[#1d4ed8]" : "border-slate-200 bg-white text-slate-500",
                )}
              >
                Group: {groupProvince ? "Theo tỉnh" : "Không nhóm"}
              </button>
            </div>

            {view === "list" ? (
              <ul className="mt-3 shrink-0 space-y-1.5">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={classNames(
                        "flex w-full items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-left shadow-sm ring-1 transition",
                        selectedId === r.id ? "ring-2 ring-[#1d4ed8]/40" : "ring-slate-900/5 hover:shadow",
                      )}
                    >
                      <span className={classNames("rounded-md px-1.5 py-0.5 text-[11px] font-bold", statusTint(r.status))}>
                        {statusVi(r.status)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800">
                        {r.entity?.name ?? r.entityId.slice(0, 8)}
                      </span>
                      <span className="hidden text-xs text-slate-400 sm:block">
                        {r.entity?.province?.name ?? r.entityType}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">{timeAgo(r.updatedAt)}</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 ? <EmptyNote /> : null}
              </ul>
            ) : (
              <div className="mt-3 grid shrink-0 items-start gap-2.5 xl:grid-cols-2 2xl:grid-cols-4">
                {COLUMNS.map((col) => {
                  const rows = filtered.filter((r) => columnOf(r.status) === col.key);
                  return (
                    <section key={col.key} className={classNames("rounded-2xl p-2 ring-1", col.tint)}>
                      <header className="flex items-center gap-1.5 px-1.5 py-1.5">
                        <span className={classNames("grid size-5 place-items-center rounded-md text-[11px] font-black text-white", col.badge)}>
                          {COLUMNS.indexOf(col) + 1}
                        </span>
                        <h2 className="flex-1 truncate text-[13px] font-bold text-slate-800">{col.title}</h2>
                        <span className="text-xs tabular-nums text-slate-400">{rows.length} items</span>
                      </header>
                      <div className="max-h-[52dvh] space-y-2 overflow-y-auto p-0.5">
                        {rows.length === 0 ? (
                          <p className="rounded-xl bg-white/70 px-3 py-6 text-center text-xs text-slate-400">Trống</p>
                        ) : (
                          <ColumnCards
                            rows={rows}
                            groupProvince={groupProvince}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            coverOf={coverOf}
                            pending={review.isPending}
                            onReview={(id, action) => review.mutate({ id, action })}
                          />
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden min-h-0 border-l border-slate-200 bg-white lg:block">
            {selected ? (
              <ApprovalDetailInline
                item={selected}
                pending={review.isPending}
                onReview={(action, comment) => review.mutate({ id: selected.id, action, comment })}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <p className="p-6 text-center text-sm text-slate-400">Chọn một hồ sơ để xem chi tiết.</p>
            )}
          </div>
        </div>

        {/* Mobile detail overlay */}
        {selected ? (
          <div className="fixed inset-0 z-40 bg-black/40 p-4 lg:hidden">
            <div className="mx-auto flex h-full max-w-md flex-col overflow-hidden rounded-2xl bg-white">
              <ApprovalDetailInline
                item={selected}
                pending={review.isPending}
                onReview={(action, comment) => review.mutate({ id: selected.id, action, comment })}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RailLink({
  href,
  icon,
  label,
  collapsed,
  active = false,
  badge,
  badgeTint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  active?: boolean;
  badge?: string;
  badgeTint?: string;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={classNames(
        "flex items-center gap-3 rounded-xl px-3 py-2 transition",
        active ? "bg-[#1d4ed8]/10 font-bold text-[#1d4ed8]" : "text-slate-600 hover:bg-slate-100",
        collapsed && "justify-center",
      )}
    >
      <span className="shrink-0">{icon}</span>
      {collapsed ? null : <span className="flex-1 text-[13px]">{label}</span>}
      {collapsed || !badge ? null : (
        <span className={classNames("rounded-md px-1.5 text-xs font-bold", badgeTint ?? "bg-slate-100 text-slate-500")}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function MiniStat({
  label,
  value,
  tint,
  icon,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tint: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <span className={classNames("grid size-7 shrink-0 place-items-center rounded-lg", tint)}>{icon}</span>
        <span className="leading-tight">{label}</span>
      </p>
      <p className="mt-1.5 text-xl font-black tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function statusTint(status: string): string {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-600";
  if (status === "REJECTED" || status === "DRAFT") return "bg-slate-100 text-slate-500";
  return "bg-amber-50 text-amber-700";
}

function statusVi(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Nháp",
    PENDING_LEADER: "Chờ Leader",
    PENDING_LECTURER: "Chờ Lecturer",
    PENDING_ADMIN: "Chờ Admin",
    PUBLISHED: "Đã duyệt",
    REJECTED: "Bị trả lại",
  };
  return map[status] ?? status;
}

function EmptyNote() {
  return (
    <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-900/5">
      Không có hồ sơ nào khớp bộ lọc.
    </p>
  );
}

function ColumnCards({
  rows,
  groupProvince,
  selectedId,
  onSelect,
  coverOf,
  pending,
  onReview,
}: {
  rows: ApprovalRecord[];
  groupProvince: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  coverOf: (r: ApprovalRecord) => string | undefined;
  pending: boolean;
  onReview: (id: string, action: "APPROVE" | "REJECT") => void;
}) {
  const groups = React.useMemo(() => {
    if (!groupProvince) return [{ key: "", rows }];
    const map = new Map<string, ApprovalRecord[]>();
    for (const r of rows) {
      const key = r.entity?.province?.name ?? "Khác";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].map(([key, groupRows]) => ({ key, rows: groupRows }));
  }, [rows, groupProvince]);

  return (
    <>
      {groups.map((g) => (
        <div key={g.key || "all"}>
          {g.key ? (
            <p className="px-1.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.key}</p>
          ) : null}
          {g.rows.map((r) => {
            const cover = coverOf(r);
            const isPending = PENDING.includes(r.status);
            return (
              <article
                key={r.id}
                onClick={() => onSelect(r.id)}
                className={classNames(
                  "mb-2 cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm ring-1 transition last:mb-0 hover:shadow",
                  selectedId === r.id ? "ring-2 ring-[#1d4ed8]/50" : "ring-slate-900/5",
                )}
              >
                <div className="flex gap-2 p-2">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                      <MapPin className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-slate-800">
                      {r.entity?.name ?? `${r.entityType} · ${r.entityId.slice(0, 8)}…`}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {r.submittedBy ? `${r.submittedBy.fullName} · ` : ""}
                      {r.entity?.province?.name ?? r.entityType}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <MessageSquare className="size-3" />
                      {(r.history ?? []).length} lượt · {timeAgo(r.updatedAt)}
                    </p>
                  </div>
                </div>
                {isPending ? (
                  <div className="flex gap-1.5 border-t border-slate-100 p-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReview(r.id, "APPROVE");
                      }}
                      className="flex-1 rounded-lg border border-emerald-200 py-1.5 text-xs font-bold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40"
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReview(r.id, "REJECT");
                      }}
                      className="flex-1 rounded-lg border border-rose-200 py-1.5 text-xs font-bold text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
                    >
                      Trả lại
                    </button>
                  </div>
                ) : (
                  <p className="border-t border-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-400">
                    {r.status === "PUBLISHED" ? (
                      <span className="text-emerald-600">✓ Đã duyệt</span>
                    ) : r.status === "REJECTED" ? (
                      <span className="text-rose-500">Bị trả lại</span>
                    ) : (
                      <span className="text-slate-400">Nháp</span>
                    )}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ))}
    </>
  );
}
