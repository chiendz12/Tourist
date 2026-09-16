import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  ChevronDown,
  Clock3,
  Heart,
  Map as MapIcon,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Briefcase,
  Star,
  Sun,
  Users,
} from "lucide-react";
import {
  authApi,
  destinationsApi,
  favoritesApi,
  itinerariesApi,
  ratingsApi,
  toursApi,
} from "@/lib/api/services";
import type {
  Destination,
  ItinerarySummary,
  Tour,
} from "@/lib/api/types";
import { buttonClass } from "@/components/ui/button";
import { MapView } from "@/components/map/map-view";
import { ClickMarker } from "@/components/map/click-marker";
import { MapLayers } from "@/components/map/map-layers";
import { Stars } from "@/components/shared/stars";
import { MemberSidebar } from "@/components/member/sidebar";
import { NotificationsDropdown } from "@/components/notifications/dropdown";
import { SaveButton } from "@/components/member/save-button";
import { TripMenu } from "@/components/member/trip-menu";
import { firstStopId, formatTripDate } from "@/components/itinerary/types";
import { formatVnd } from "@/lib/utils";

type MeTab = "planning" | "done" | "wishlist";

interface EnrichedTrip extends ItinerarySummary {
  days: number;
  stops: number;
  travelers: number;
  progress: number;
  cover?: string;
}

function payloadStats(t: ItinerarySummary): { days: number; stops: number; travelers: number } {
  const days = t.payload?.days ?? [];
  return {
    days: days.length,
    stops: days.reduce((s, d) => s + (d.stops?.length ?? 0), 0),
    travelers: t.payload?.travelers ?? 2,
  };
}

/**
 * Member dashboard: dark sidebar + trips header, featured journey,
 * stats, personal map, saved places, suggestions and AI tips.
 */
const TRIPS_PAGE_SIZE = 4;

async function enrichTrip(t: ItinerarySummary): Promise<EnrichedTrip> {
  const stats = payloadStats(t);
  const firstStop = firstStopId(t.payload?.days ?? []);
  let cover: string | undefined;
  if (firstStop) {
    try {
      const dest = await destinationsApi.get(firstStop);
      cover = dest.images?.[0];
    } catch {
      /* no cover */
    }
  }
  const filled = (t.payload?.days ?? []).filter((d) => (d.stops?.length ?? 0) > 0).length;
  return {
    ...t,
    ...stats,
    cover,
    progress: stats.days ? Math.round((filled / stats.days) * 100) : 0,
  };
}

export default async function MePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; tripsPage?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const tab: MeTab =
    params.tab === "done" || params.tab === "wishlist" ? params.tab : "planning";

  const [user, tripsRaw, favorites, browse, tourList] = await Promise.all([
    authApi.me().catch(() => null),
    itinerariesApi.mine().catch(() => []),
    favoritesApi.list().catch(() => []),
    destinationsApi.list({ limit: 8 }).catch(() => ({ data: [], meta: null as never })),
    toursApi.list({ limit: 4 }).catch(() => ({ data: [], meta: null as never })),
  ]);

  // Paginate the grid; enrich only the featured trip + current page covers.
  const totalPages = Math.max(1, Math.ceil(tripsRaw.length / TRIPS_PAGE_SIZE));
  const page = Math.min(Math.max(Number.parseInt(params.tripsPage ?? "", 10) || 1, 1), totalPages);
  const pageTripsRaw = tripsRaw.slice((page - 1) * TRIPS_PAGE_SIZE, page * TRIPS_PAGE_SIZE);
  const enrichIds = new Set([tripsRaw[0]?.id, ...pageTripsRaw.map((t) => t.id)].filter((id): id is string => !!id));
  const enriched = new Map(
    await Promise.all(
      [...enrichIds].map(async (id) => {
        const t = tripsRaw.find((x) => x.id === id)!;
        return [id, await enrichTrip(t)] as const;
      }),
    ),
  );
  const trips: EnrichedTrip[] = pageTripsRaw.map(
    (t) => enriched.get(t.id) ?? { ...t, ...payloadStats(t), progress: 0 },
  );
  const tripStats = tripsRaw.map(payloadStats);

  // Saved places with live ratings.
  const saved: Array<{ d: Destination; avg: number; count: number }> = await Promise.all(
    favorites.slice(0, 6).map(async (f) => {
      try {
        const [d, ratings] = await Promise.all([
          destinationsApi.get(f.destinationId),
          ratingsApi.forDestination(f.destinationId).catch(() => []),
        ]);
        return {
          d,
          avg: ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : 0,
          count: ratings.length,
        };
      } catch {
        return null;
      }
    }),
  ).then((list) => list.filter((x) => x !== null));

  const favIds = new Set(favorites.map((f) => f.destinationId));
  const totalStops = tripStats.reduce((s, t) => s + t.stops, 0);
  const totalDays = tripStats.reduce((s, t) => s + t.days, 0);
  const featured = tripsRaw[0] ? (enriched.get(tripsRaw[0].id) ?? null) : null;

  // Suggestions: top-rated browsed destinations + first tour.
  const rated = await Promise.all(
    (browse.data ?? []).slice(0, 6).map(async (d) => {
      const r = await ratingsApi.forDestination(d.id).catch(() => []);
      return { d, avg: r.length ? r.reduce((s, x) => s + x.score, 0) / r.length : 0, count: r.length };
    }),
  );
  const suggestions = rated
    .slice()
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 2);
  const suggestedTour: Tour | null = (tourList.data ?? [])[0] ?? null;

  const mapMarkers = [...saved.map((s) => s.d)];

  return (
    <div className="flex min-h-dvh bg-slate-100">
      <div className="sticky top-0 hidden h-dvh lg:block">
        <React.Suspense fallback={<div className="h-dvh w-60 bg-[#0a1628]" />}>
          <MemberSidebar user={user} />
        </React.Suspense>
      </div>

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              <Briefcase className="size-6 text-slate-700" />
              Chuyến đi của tôi
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Quản lý tất cả hành trình và điểm đến của bạn
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationsDropdown buttonClassName="relative grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900" />
            <Link href="/itinerary/new" className={buttonClass()}>
              <Plus className="size-4" />
              Tạo lộ trình mới
            </Link>
          </div>
        </header>

        <nav className="mt-4 flex gap-5 border-b border-slate-200 text-sm font-semibold">
          {(
            [
              { key: "planning", label: "Đang lên kế hoạch", count: trips.length },
              { key: "done", label: "Đã hoàn thành", count: 0 },
              { key: "wishlist", label: "Đã lưu (Wishlist)", count: favorites.length },
            ] as const
          ).map((t) => (
            <Link
              key={t.key}
              href={`/me?tab=${t.key}`}
              className={
                tab === t.key
                  ? "-mb-px border-b-2 border-[#1d4ed8] pb-2.5 text-[#1d4ed8]"
                  : "pb-2.5 text-slate-500 hover:text-slate-800"
              }
            >
              {t.label}
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">
                {t.count}
              </span>
            </Link>
          ))}
        </nav>

        {tab === "done" ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-base font-bold text-slate-800">Chưa có chuyến đi hoàn thành</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Các chuyến đi bạn đánh dấu hoàn thành sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : tab === "wishlist" ? (
          <section className="mt-6">
            <h2 className="text-base font-bold text-slate-900">
              Đã lưu (Wishlist) · {saved.length}
            </h2>
            {saved.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
                Bạn chưa lưu điểm đến nào.{" "}
                <Link href="/destinations" className="font-bold text-[#1d4ed8] hover:underline">
                  Khám phá ngay →
                </Link>
              </p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {saved.map((s) => (
                  <SavedCard key={s.d.id} d={s.d} avg={s.avg} count={s.count} isFav />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="mt-5 grid items-start gap-4 xl:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-4">
              {featured ? (
                <FeaturedBanner trip={featured} />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <p className="text-base font-bold text-slate-800">Chưa có chuyến đi nào</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Tạo lộ trình đầu tiên để bắt đầu hành trình của bạn.
                  </p>
                  <Link href="/itinerary/new" className={buttonClass({ className: "mt-4" })}>
                    <Plus className="size-4" />
                    Tạo lộ trình mới
                  </Link>
                </div>
              )}

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Các chuyến đi của bạn</h2>
                  <span className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                    Sắp xếp
                    <ChevronDown className="size-3.5" />
                  </span>
                </div>
                {trips.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Danh sách trống.
                  </p>
                ) : (
                  <>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      {trips.map((t) => (
                        <TripCard key={t.id} trip={t} />
                      ))}
                    </div>
                    {totalPages > 1 ? (
                      <TripsPagination page={page} totalPages={totalPages} total={tripsRaw.length} tab={tab} />
                    ) : null}
                  </>
                )}
              </section>

              <section id="saved" className="scroll-mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Điểm đến đã lưu</h2>
                  <Link
                    href="/me?tab=wishlist"
                    className="flex items-center gap-0.5 text-[13px] font-bold text-[#1d4ed8] hover:underline"
                  >
                    Xem tất cả
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                {saved.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Bạn chưa lưu điểm đến nào.{" "}
                    <Link href="/destinations" className="font-bold text-[#1d4ed8] hover:underline">
                      Khám phá ngay →
                    </Link>
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {saved.map((s) => (
                      <SavedCard key={s.d.id} d={s.d} avg={s.avg} count={s.count} isFav compact />
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                <h2 className="text-base font-bold text-slate-900">Gợi ý AI cho bạn</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {[
                    {
                      icon: <Bot className="size-5 text-emerald-500" />,
                      bg: "bg-emerald-50",
                      text: "Dựa trên sở thích của bạn, Đà Nẵng có thể là điểm đến tiếp theo!",
                      link: "/destinations?q=Đà Nẵng",
                      linkLabel: "Khám phá Đà Nẵng",
                    },
                    {
                      icon: <MapIcon className="size-5 text-sky-500" />,
                      bg: "bg-sky-50",
                      text: "Thời tiết đẹp cuối tuần này tại Ninh Bình, thích hợp để đi du lịch",
                      link: "/destinations?q=Ninh Bình",
                      linkLabel: "Xem dự báo thời tiết",
                    },
                    {
                      icon: <Sun className="size-5 text-amber-500" />,
                      bg: "bg-amber-50",
                      text: "Ưu đãi 20% cho tour Phú Quốc đặt trước ngày 30/06!",
                      link: "/tours",
                      linkLabel: "Xem ưu đãi",
                    },
                  ].map((tip) => (
                    <div key={tip.linkLabel} className="flex gap-2.5 rounded-xl border border-slate-100 p-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tip.bg}`}>
                        {tip.icon}
                      </span>
                      <span>
                        <span className="block text-[13px] leading-snug text-slate-600">{tip.text}</span>
                        <Link
                          href={tip.link}
                          className="mt-1.5 inline-block text-xs font-bold text-[#1d4ed8] hover:underline"
                        >
                          {tip.linkLabel} →
                        </Link>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Tổng quan của bạn</h2>
                  <span className="text-xs font-bold text-[#1d4ed8]">Xem chi tiết</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {[
                    { icon: <Plane className="size-5 text-sky-500" />, bg: "bg-sky-50", value: trips.length, label: "Chuyến đi đã đi" },
                    { icon: <MapPin className="size-5 text-rose-500" />, bg: "bg-rose-50", value: favorites.length, label: "Điểm đến đã khám phá" },
                    { icon: <Star className="size-5 fill-amber-400 text-amber-400" />, bg: "bg-amber-50", value: totalStops, label: "Điểm dừng đã lên" },
                    { icon: <CalendarDays className="size-5 text-emerald-500" />, bg: "bg-emerald-50", value: totalDays, label: "Ngày đã khám phá" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-slate-50 p-3">
                      <span className={`grid size-9 place-items-center rounded-xl ${s.bg}`}>{s.icon}</span>
                      <p className="mt-2 text-xl font-black text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Bản đồ cá nhân</h2>
                  <Link
                    href="/map"
                    className="flex items-center gap-0.5 text-xs font-bold text-[#1d4ed8] hover:underline"
                  >
                    Xem bản đồ đầy đủ
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <div className="relative mt-2.5 h-56 overflow-hidden rounded-xl">
                  <MapView className="size-full" center={[108.2, 15.8]} zoom={5}>
                    <ClickMarker />
                    <MapLayers destinations={mapMarkers} />
                  </MapView>
                  <ul className="absolute bottom-2 left-2 space-y-1 rounded-lg bg-white/95 px-2.5 py-2 text-[11px] font-semibold text-slate-600 shadow backdrop-blur">
                    <li className="flex items-center gap-1.5">
                      <Heart className="size-3.5 fill-rose-500 text-rose-500" /> Điểm yêu thích
                    </li>
                    <li className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-emerald-500" /> Điểm đã ghé
                    </li>
                  </ul>
                </div>
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Gợi ý dành cho bạn ✨</h2>
                  <Link href="/destinations" className="text-xs font-bold text-[#1d4ed8] hover:underline">
                    Xem thêm
                  </Link>
                </div>
                <div className="mt-2.5 space-y-2.5">
                  {suggestions.map(({ d, avg, count }) => (
                    <div key={d.id} className="flex gap-2.5 rounded-xl border border-slate-100 p-2">
                      {d.images?.[0] ? (
                        <Image
                          src={d.images[0]}
                          alt=""
                          width={96}
                          height={96}
                          className="size-24 shrink-0 rounded-lg object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="grid size-24 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                          <MapPin className="size-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/destinations/${d.slug}`}
                          className="block truncate text-[13px] font-bold text-slate-900 hover:text-[#1d4ed8]"
                        >
                          {d.name}
                        </Link>
                        <Stars value={avg} count={count} />
                        <div className="mt-1.5">
                          <SaveButton destinationId={d.id} isFav={favIds.has(d.id)} variant="add" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {suggestedTour ? (
                    <div className="rounded-xl border border-slate-100 p-2.5">
                      <p className="truncate text-[13px] font-bold text-slate-900">
                        {suggestedTour.name}
                      </p>
                      <p className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Từ{" "}
                          <strong className="text-slate-900">
                            {formatVnd(suggestedTour.basePrice)}
                          </strong>
                        </span>
                        <Link
                          href={`/tours/${suggestedTour.id}`}
                          className="rounded-lg border border-[#1d4ed8]/30 px-2.5 py-1.5 font-bold text-[#1d4ed8] transition hover:bg-[#1d4ed8]/5"
                        >
                          Xem tour
                        </Link>
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedBanner({ trip }: { trip: EnrichedTrip }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm">
      {trip.cover ? (
        <Image src={trip.cover} alt="" fill sizes="100vw" className="object-cover" unoptimized />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
      <div className="relative max-w-lg p-5 sm:p-6">
        <span className="rounded-md bg-orange-500 px-2 py-0.5 text-[11px] font-bold">
          Sắp khởi hành
        </span>
        <h2 className="mt-2.5 font-display text-2xl font-bold leading-tight">{trip.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/85">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-4" />
            Cập nhật {formatTripDate(trip)}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="size-4" />
            {trip.days} ngày · {trip.stops} điểm đến
          </span>
        </p>
        <div className="mt-3 h-1.5 max-w-sm overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${trip.progress}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/itinerary/new?id=${trip.id}`}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-bold text-slate-900 transition hover:bg-slate-100"
          >
            <Pencil className="size-4" />
            Tiếp tục chỉnh sửa
          </Link>
          <Link
            href={`/itinerary/new?id=${trip.id}`}
            className="rounded-xl border border-white/50 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-white/10"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
    </section>
  );
}

function TripsPagination({
  page,
  totalPages,
  total,
  tab,
}: {
  page: number;
  totalPages: number;
  total: number;
  tab: string;
}) {
  const href = (p: number) => `/me?tab=${tab}&tripsPage=${p}`;
  const numbers: Array<number | "…"> = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) numbers.push(p);
    else if (numbers[numbers.length - 1] !== "…") numbers.push("…");
  }
  return (
    <nav aria-label="Phân trang chuyến đi" className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
      <Link
        href={href(Math.max(page - 1, 1))}
        aria-disabled={page <= 1}
        className={
          page <= 1
            ? "pointer-events-none rounded-lg px-3 py-1.5 text-sm font-bold text-slate-300"
            : "rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
        }
      >
        ‹ Trước
      </Link>
      {numbers.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-slate-300">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={
              p === page
                ? "rounded-lg bg-[#1d4ed8] px-3 py-1.5 text-sm font-bold text-white shadow"
                : "rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            }
          >
            {p}
          </Link>
        ),
      )}
      <Link
        href={href(Math.min(page + 1, totalPages))}
        aria-disabled={page >= totalPages}
        className={
          page >= totalPages
            ? "pointer-events-none rounded-lg px-3 py-1.5 text-sm font-bold text-slate-300"
            : "rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
        }
      >
        Sau ›
      </Link>
      <span className="ml-1 text-xs tabular-nums text-slate-400">
        Trang {page}/{totalPages} · {total} chuyến
      </span>
    </nav>
  );
}

function TripCard({ trip }: { trip: EnrichedTrip }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] bg-slate-100">
        {trip.cover ? (
          <Image src={trip.cover} alt={trip.name} fill sizes="400px" className="object-cover" unoptimized />
        ) : (
          <span className="grid size-full place-items-center text-slate-300">
            <MapIcon className="size-8" />
          </span>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-md bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
          Đang soạn
        </span>
        <span className="absolute right-2.5 top-2.5">
          <TripMenu tripId={trip.id} tripName={trip.name} />
        </span>
      </div>
      <div className="p-3">
        <Link
          href={`/itinerary/new?id=${trip.id}`}
          className="line-clamp-2 min-h-10 text-sm font-bold leading-snug text-slate-900 hover:text-[#1d4ed8]"
        >
          {trip.name}
        </Link>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {trip.days} ngày
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {trip.stops} điểm
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {trip.travelers} khách
          </span>
        </p>
        <p className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${trip.progress}%` }} />
        </p>
        <p className="mt-1 text-right text-[11px] font-bold text-slate-400">{trip.progress}%</p>
      </div>
    </article>
  );
}

function SavedCard({
  d,
  avg,
  count,
  isFav,
  compact = false,
}: {
  d: Destination;
  avg: number;
  count: number;
  isFav: boolean;
  compact?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/10] bg-slate-100">
        {d.images?.[0] ? (
          <Image src={d.images[0]} alt={d.name} fill sizes="300px" className="object-cover" unoptimized />
        ) : (
          <span className="grid size-full place-items-center text-slate-300">
            <MapIcon className="size-6" />
          </span>
        )}
        <span className="absolute right-2 top-2">
          <SaveButton destinationId={d.id} isFav={isFav} />
        </span>
      </div>
      <div className="p-2.5">
        <Link
          href={`/destinations/${d.slug}`}
          className="line-clamp-1 text-[13px] font-bold text-slate-900 hover:text-[#1d4ed8]"
        >
          {d.name}
        </Link>
        {!compact ? (
          <p className="line-clamp-1 text-xs text-slate-500">{d.address ?? "VietJourney"}</p>
        ) : null}
        <p className="mt-1">
          <Stars value={avg} count={count} />
        </p>
      </div>
    </article>
  );
}
