import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { authApi, notificationsApi } from "@/lib/api/services";
import { Card, CardBody } from "@/components/ui/card";

/**
 * Notification inbox for the signed-in user.
 */
export default async function NotificationsPage() {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/notifications");

  const list = await notificationsApi
    .list({ limit: 30 })
    .catch(() => ({ data: [], meta: null as never }));
  const items = list.data ?? [];

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-5">
      <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-slate-900">
        <Bell className="size-7" />
        Thông báo
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {items.filter((n) => !n.readAt).length} chưa đọc · {items.length} tổng cộng
      </p>

      {items.length === 0 ? (
        <Card className="mt-6">
          <CardBody className="grid place-items-center gap-2 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">Không có thông báo</p>
            <p className="text-xs text-slate-500">
              Hoạt động duyệt bài và cập nhật sẽ hiện ở đây.{" "}
              <Link href="/map" className="font-bold text-[#1d4ed8] hover:underline">
                Mở bản đồ →
              </Link>
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={!n.readAt ? "ring-1 ring-[#1d4ed8]/30" : undefined}>
                <CardBody>
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    {!n.readAt ? <span className="size-2 rounded-full bg-[#1d4ed8]" /> : null}
                    {n.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(n.createdAt).toLocaleString("vi-VN")}
                  </p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
