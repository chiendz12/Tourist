import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Images, MapPin } from "lucide-react";
import {
  destinationsApi,
  provincesApi,
  ratingsApi,
  toursApi,
} from "@/lib/api/services";
import { Stars } from "@/components/shared/stars";
import { DetailActions } from "@/components/destination/detail-actions";
import { DetailSidebar } from "@/components/destination/detail-sidebar";
import {
  DetailTabs,
  type DetailTabKey,
} from "@/components/destination/detail-tabs";
import { CATEGORY_LABEL } from "@/components/map/interactive/left-panel";

const TABS: DetailTabKey[] = ["overview", "media", "tours", "reviews"];

/**
 * Destination detail: breadcrumb, title + actions, gallery mosaic,
 * tabbed content and a sticky booking sidebar.
 */
export default async function DestinationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const defaultTab: DetailTabKey = TABS.includes(tab as DetailTabKey)
    ? (tab as DetailTabKey)
    : "overview";

  let destination;
  try {
    destination = await destinationsApi.get(id);
  } catch {
    notFound();
  }
  if (!destination) notFound();

  const [ratings, nearby, provinces, tours] = await Promise.all([
    ratingsApi.forDestination(destination.id).catch(() => []),
    destinationsApi
      .nearby({
        lng: destination.lng,
        lat: destination.lat,
        radius: 50000,
        limit: 6,
      })
      .catch(() => []),
    provincesApi.list().catch(() => []),
    toursApi.list({ limit: 4 }).catch(() => ({ data: [], meta: null as never })),
  ]);
  const provinceName = provinces.find(
    (p) => p.id === destination.provinceId,
  )?.name;
  const avg =
    ratings.length === 0
      ? 0
      : ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
  const images = destination.images ?? [];
  const hero = images[0];
  const mosaic = images.slice(1, 5);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-5">
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
        <Link href="/" className="hover:text-slate-900">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/destinations" className="hover:text-slate-900">
          Điểm đến
        </Link>
        {provinceName ? (
          <>
            <span>/</span>
            <span>{provinceName}</span>
          </>
        ) : null}
        <span>/</span>
        <span className="font-semibold text-slate-800">{destination.name}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {destination.name}
            {destination.status === "PUBLISHED" ? (
              <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-600">
                <BadgeCheck className="size-4" />
                Đã verify
              </span>
            ) : null}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Stars value={avg} className="text-amber-400" />
              <strong className="text-slate-800">
                {ratings.length ? avg.toFixed(1) : "—"}
              </strong>
              <span>({ratings.length} đánh giá)</span>
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-4 text-slate-400" />
              {[destination.address, provinceName].filter(Boolean).join(", ") ||
                "VietJourney"}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
              Đang mùa đẹp
            </span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
              {destination.ticketPrice
                ? `Vé: ${destination.ticketPrice}`
                : "Miễn phí vào cửa"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {CATEGORY_LABEL[destination.category]}
            </span>
          </div>
        </div>
        <DetailActions destinationId={destination.id} />
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-[1.6fr_1fr]">
        <div className="relative min-h-64 overflow-hidden rounded-2xl bg-slate-100 sm:min-h-80">
          {hero ? (
            <Image
              src={hero}
              alt={destination.name}
              fill
              sizes="(max-width: 768px) 100vw, 62vw"
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div className="flex size-full min-h-64 items-center justify-center text-sm text-slate-400">
              Hình ảnh đang được cập nhật
            </div>
          )}
        </div>
        <div className="hidden grid-cols-2 gap-2 md:grid">
          {mosaic.map((src) => (
            <span
              key={src}
              className="relative min-h-36 overflow-hidden rounded-2xl bg-slate-100"
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="20vw"
                className="object-cover"
                unoptimized
              />
            </span>
          ))}
          {mosaic.length === 0
            ? [0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="grid min-h-36 place-items-center rounded-2xl bg-slate-50 text-xs text-slate-300"
                >
                  VietJourney
                </span>
              ))
            : null}
          {images.length > 5 ? (
            <Link
              href={`/destinations/${destination.slug}?tab=media`}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 py-2 text-[13px] font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Images className="size-4" />
              Xem tất cả {images.length} ảnh
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
        <DetailTabs
          key={defaultTab}
          destination={destination}
          ratings={ratings}
          nearby={nearby}
          tours={tours.data ?? []}
          provinceName={provinceName}
          defaultTab={defaultTab}
        />
        <DetailSidebar destination={destination} />
      </div>
    </div>
  );
}
