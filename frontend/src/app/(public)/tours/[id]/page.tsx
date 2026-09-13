import { notFound } from "next/navigation";
import Link from "next/link";
import { toursApi } from "@/lib/api/services";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let tour;
  try {
    tour = await toursApi.get(id);
  } catch {
    notFound();
  }
  if (!tour) notFound();

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-10">
      <Link href="/tours" className="text-sm text-slate-500 hover:text-slate-900">
        ← Tất cả tour
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        {tour!.name}
      </h1>
      <p className="text-xs text-slate-500">{tour!.code}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card>
          <CardBody>
            {tour!.description ? (
              <p className="text-base leading-relaxed text-slate-700">
                {tour!.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="info">{tour!.days} ngày</Badge>
              <Badge variant="neutral">{tour!.paxCount} khách</Badge>
              {tour!.targetAgeGroups.map((g) => (
                <Badge key={g} variant="neutral">
                  {g}
                </Badge>
              ))}
              {tour!.travelStyles.map((s) => (
                <Badge key={s} variant="neutral">
                  {s}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <p className="text-3xl font-bold text-slate-900">
              {new Intl.NumberFormat("vi-VN").format(Number(tour!.basePrice))}đ
              <span className="ml-1 text-sm font-normal text-slate-500">/ khách</span>
            </p>
            <Button className="w-full" size="lg">
              Lưu vào chuyến đi
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
