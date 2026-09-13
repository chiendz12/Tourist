import Link from "next/link";
import { Clock } from "lucide-react";
import { toursApi } from "@/lib/api/services";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ToursPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams) ?? {}).q ?? "";
  const result = await toursApi
    .list({ limit: "24", q: q || undefined })
    .catch(() => ({ data: [], meta: { page: 1, limit: 24, total: 0, totalPages: 0 } }));

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Tour
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        Tour đã qua kiểm duyệt
      </h1>

      <form className="relative mt-6 max-w-lg">
        <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Tìm tour theo tên..."
          className="pl-10"
        />
      </form>

      <p className="mt-4 text-sm text-slate-500">{result.meta.total} tour</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.data.map((tour) => (
          <Card key={tour.id} className="flex flex-col">
            <CardBody className="flex flex-1 flex-col gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  {tour.name}
                </h2>
                <p className="text-xs text-slate-500">{tour.code}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{tour.days} ngày</Badge>
                <Badge variant="neutral">{tour.paxCount} khách</Badge>
                {tour.targetAgeGroups.length > 0 ? (
                  <Badge variant="neutral">{tour.targetAgeGroups[0]}</Badge>
                ) : null}
              </div>
              {tour.description ? (
                <p className="line-clamp-2 text-sm text-slate-600">
                  {tour.description}
                </p>
              ) : null}
              <Link href={`/tours/${tour.id}`} className="mt-auto">
                <Button variant="outline" size="sm" className="w-full">
                  Xem tour
                </Button>
              </Link>
            </CardBody>
          </Card>
        ))}

        {result.data.length === 0 ? (
          <Card>
            <CardBody className="grid place-items-center gap-2 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Chưa có tour nào
              </p>
              <p className="text-xs text-slate-500">Hãy thử bỏ bộ lọc hoặc quay lại sau.</p>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
