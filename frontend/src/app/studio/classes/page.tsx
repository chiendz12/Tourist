import { redirect } from "next/navigation";
import { BookOpen, MapPin, Users } from "lucide-react";
import {
  authApi,
  classesApi,
} from "@/lib/api/services";
import { DashboardShell } from "@/components/studio/dashboard-shell";
import { StatCard } from "@/components/studio/widgets";
import { ClassCard } from "@/components/studio/class-card";

const CLASSES_NAV = [
  { href: "/studio/lecturer", label: "Tổng quan lớp học", icon: "home" },
  { href: "/studio/classes", label: "Quản lý lớp & nhóm", icon: "users" },
  { href: "/studio/approvals", label: "Duyệt dữ liệu", icon: "check" },
  { href: "/studio/enter", label: "Nhập dữ liệu", icon: "pen" },
  { href: "/studio/mine", label: "Dữ liệu của tôi", icon: "database" },
];

/**
 * Class & group management: stats, search and expandable rosters.
 */
export default async function ClassesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/studio/classes");

  const q = ((await searchParams)?.q ?? "").trim().toLowerCase();
  const [classes] = await Promise.all([
    classesApi.list().catch(() => []),
  ]);

  const visible = q
    ? classes.filter((c) =>
        `${c.name} ${c.code} ${c.hocPhan?.name ?? ""} ${c.province?.name ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : classes;

  const students = classes.reduce((s, c) => s + (c._count?.members ?? c.members?.length ?? 0), 0);
  const groups = classes.reduce((s, c) => s + (c.groups?.length ?? 0), 0);
  const provinceSet = new Set(classes.map((c) => c.province?.name).filter(Boolean));

  return (
    <DashboardShell
      user={me}
      roleLabel="Studio"
      nav={CLASSES_NAV}
      title="Quản lý lớp & nhóm"
      subtitle={`${classes.length} lớp · ${students} thành viên · ${provinceSet.size} tỉnh phụ trách`}
      searchPlaceholder="Tìm lớp, mã lớp, học phần, tỉnh…"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BookOpen className="size-4 text-sky-600" />}
          tint="bg-sky-50"
          label="Tổng số lớp"
          value={classes.length}
        />
        <StatCard
          icon={<Users className="size-4 text-indigo-600" />}
          tint="bg-indigo-50"
          label="Tổng sinh viên"
          value={students}
        />
        <StatCard
          icon={<Users className="size-4 text-emerald-600" />}
          tint="bg-emerald-50"
          label="Tổng nhóm"
          value={groups}
        />
        <StatCard
          icon={<MapPin className="size-4 text-amber-600" />}
          tint="bg-amber-50"
          label="Tỉnh phụ trách"
          value={provinceSet.size}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-900/5">
          <p className="text-base font-bold text-slate-800">
            {q ? `Không tìm thấy lớp nào khớp “${q}”` : "Chưa có lớp nào"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {q ? "Thử từ khóa khác." : "Lớp được phân công sẽ hiện tại đây."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((c) => (
            <ClassCard key={c.id} item={c} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
