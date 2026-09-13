import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { authApi, destinationsApi } from "@/lib/api/services";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";

const STATUS_VI: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_LEADER: "Chờ Leader",
  PENDING_LECTURER: "Chờ Lecturer",
  PENDING_ADMIN: "Chờ Admin",
  PUBLISHED: "Đã duyệt",
  REJECTED: "Bị trả về",
};

/**
 * Student's own destination records in any status, with edit shortcuts
 * back into the entry workspace.
 */
export default async function MinePage() {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/studio/mine");

  const mine = await destinationsApi
    .mine({ limit: 50 })
    .catch(() => ({ data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } }));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Studio · Dữ liệu của tôi
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            Điểm đến tôi đã nhập
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mine.meta.total} bản ghi · nháp và đang duyệt đều có thể mở lại chỉnh sửa.
          </p>
        </div>
        <Link href="/studio/enter" className={buttonClass()}>
          <Plus className="size-4" />
          Nhập điểm mới
        </Link>
      </div>

      {mine.data.length === 0 ? (
        <Card className="mt-6">
          <CardBody className="grid place-items-center gap-2 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">Chưa có dữ liệu nào</p>
            <p className="text-xs text-slate-500">Bắt đầu nhập điểm đến đầu tiên của bạn.</p>
          </CardBody>
        </Card>
      ) : (
        <ul className="mt-6 space-y-2.5">
          {mine.data.map((d) => (
            <li key={d.id}>
              <Card>
                <CardBody className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">{d.name}</span>
                      <Badge variant="neutral">{STATUS_VI[d.status] ?? d.status}</Badge>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {d.address ?? "—"} · Cập nhật{" "}
                      {new Date(d.updatedAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <Link
                    href={`/studio/enter?id=${d.id}`}
                    className={buttonClass({ variant: "outline", size: "sm" })}
                  >
                    <Pencil className="size-4" />
                    {d.status === "DRAFT" || d.status === "REJECTED" ? "Tiếp tục nhập" : "Xem / Sửa"}
                  </Link>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
