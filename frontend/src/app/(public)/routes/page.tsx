import Link from "next/link";
import { MapPin } from "lucide-react";
import { routesApi } from "@/lib/api/services";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function RoutesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams) ?? {}).q ?? "";
  const result = await routesApi
    .list({ limit: "24", q: q || undefined })
    .catch(() => ({ data: [], meta: { page: 1, limit: 24, total: 0, totalPages: 0 } }));

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Tuyến du lịch
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        Các tuyến đã qua kiểm duyệt
      </h1>

      <form className="relative mt-6 max-w-lg">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Tìm tuyến theo tên..."
          className="pl-10"
        />
      </form>

      <p className="mt-4 text-sm text-slate-500">{result.meta.total} tuyến</p>

      <div className="mt-6 space-y-3">
        {result.data.map((route) => (
          <Card key={route.id}>
            <CardBody className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                    {route.name}
                  </h2>
                  <Badge variant="neutral">{route.waypoints?.length ?? 0} điểm dừng</Badge>
                </div>
                {route.description ? (
                  <p className="mt-1 line-clamp-2 max-w-xl text-sm text-slate-600">
                    {route.description}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/routes/${route.id}`}
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                Xem tuyến
              </Link>
            </CardBody>
          </Card>
        ))}

        {result.data.length === 0 ? (
          <Card>
            <CardBody className="grid place-items-center gap-2 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Chưa có tuyến nào
              </p>
              <p className="text-xs text-slate-500">
                Hãy thử bỏ bộ lọc hoặc quay lại sau.
              </p>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
