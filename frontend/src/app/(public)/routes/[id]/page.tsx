import { notFound } from "next/navigation";
import Link from "next/link";
import { routesApi } from "@/lib/api/services";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let route;
  try {
    route = await routesApi.get(id);
  } catch {
    notFound();
  }
  if (!route) notFound();

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10">
      <Link href="/routes" className="text-sm text-slate-500 hover:text-slate-900">
        ← Tất cả tuyến
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        {route!.name}
      </h1>
      {route!.description ? (
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          {route!.description}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Điểm dừng
            </h2>
            <ol className="mt-3 space-y-3">
              {(route!.waypoints ?? [])
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((wp) => (
                  <li key={wp.id} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {wp.order + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {wp.destination?.name ?? wp.destinationId}
                      </p>
                      {wp.stayMinutes ? (
                        <p className="text-xs text-slate-500">
                          Dừng {wp.stayMinutes} phút
                        </p>
                      ) : null}
                      {wp.notes ? (
                        <p className="mt-1 text-sm text-slate-600">{wp.notes}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <Badge variant="neutral">
              {route!.waypoints?.length ?? 0} điểm dừng
            </Badge>
            <Button className="w-full" size="lg">
              Lưu vào chuyến đi của tôi
            </Button>
            <Link
              href="/me"
              className={buttonClass({ variant: "outline", className: "w-full" })}
            >
              Mở chuyến đi của tôi
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
