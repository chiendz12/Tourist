import Image from "next/image";
import Link from "next/link";
import {
  Backpack,
  Clock3,
  CloudSun,
  Flower2,
  Landmark,
  Leaf,
  Map as MapIcon,
  MapPin,
  Mic,
  Mountain,
  Route as RouteIcon,
  Search,
  Sun,
  TreePine,
  Users,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import {
  destinationsApi,
  ratingsApi,
  toursApi,
} from "@/lib/api/services";
import type { Destination, Tour } from "@/lib/api/types";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapView } from "@/components/map/map-view";
import { ClickMarker } from "@/components/map/click-marker";
import { MapLayers } from "@/components/map/map-layers";
import {
  DestinationCard,
  type CardBadge,
} from "@/components/destination/destination-card";
import { CarouselRow } from "@/components/shared/carousel-row";
import { Stars } from "@/components/shared/stars";
import { formatVnd } from "@/lib/utils";

const u = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?q=80&w=${w}&auto=format&fit=crop`;

const HERO_IMG = u("1528127269322-539801943592", 2400);

const CATEGORY_PILLS = [
  { key: "NATURE", label: "Biển", icon: Waves },
  { key: "NATURE-mountain", label: "Núi", icon: Mountain },
  { key: "CULTURE", label: "Văn hóa", icon: Landmark },
  { key: "CUISINE", label: "Ẩm thực", icon: UtensilsCrossed },
  { key: "FAMILY", label: "Gia đình", icon: Users },
  { key: "BACKPACKER", label: "Backpacker", icon: Backpack },
];

/** Curated fallback when the API is unreachable — mirrors the Figma content. */
const FIGMA_SPOTS: Array<{
  name: string;
  province: string;
  category: Destination["category"];
  image: string;
  rating: number;
  ratingCount: number;
  badge: CardBadge;
  lng: number;
  lat: number;
}> = [
  { name: "Vịnh Hạ Long", province: "Quảng Ninh", category: "NATURE", image: u("1528127269322-539801943592", 600), rating: 4.8, ratingCount: 523, badge: "verify", lng: 107.07, lat: 20.91 },
  { name: "Sa Pa", province: "Lào Cai", category: "NATURE", image: u("1470071459604-3b5ec3a7fe05", 600), rating: 4.7, ratingCount: 412, badge: "hot", lng: 103.84, lat: 22.34 },
  { name: "Đà Nẵng", province: "Đà Nẵng", category: "NATURE", image: u("1519046904884-53103b34b206", 600), rating: 4.6, ratingCount: 388, badge: "verify", lng: 108.22, lat: 16.06 },
  { name: "Hội An", province: "Quảng Nam", category: "CULTURE", image: u("1559592413-7cec4d0cae2b", 600), rating: 4.9, ratingCount: 621, badge: "hot", lng: 108.33, lat: 15.88 },
  { name: "Phú Quốc", province: "Kiên Giang", category: "NATURE", image: u("1507525428034-b723cf961d3e", 600), rating: 4.7, ratingCount: 455, badge: "verify", lng: 103.96, lat: 10.29 },
  { name: "Mộc Châu", province: "Sơn La", category: "NATURE", image: u("1433086966358-54859d0ed716", 600), rating: 4.5, ratingCount: 289, badge: "new", lng: 104.64, lat: 20.83 },
];

const FIGMA_TOURS: Array<{
  name: string;
  subtitle: string;
  days: number;
  price: number;
  image: string;
  rating: number;
  ratingCount: number;
}> = [
  { name: "Hà Nội – Sa Pa", subtitle: "Khám phá vùng núi Tây Bắc", days: 4, price: 2590000, image: u("1469854523086-cc02fe5d8800", 800), rating: 4.8, ratingCount: 324 },
  { name: "Miền Trung Biển – Núi", subtitle: "Đà Nẵng – Hội An – Huế", days: 5, price: 3790000, image: u("1544551763-46a013bb70d5", 800), rating: 4.7, ratingCount: 256 },
  { name: "Tour Gia Đà Lạt", subtitle: "Thành phố ngàn hoa", days: 3, price: 2190000, image: u("1441974231531-c6227db76b6e", 800), rating: 4.6, ratingCount: 198 },
  { name: "Ninh Bình – Tràng An", subtitle: "Vẻ đẹp non nước hữu tình", days: 2, price: 1590000, image: u("1476514525535-07fb3b4ae5f1", 800), rating: 4.5, ratingCount: 167 },
];

const SEASONS = [
  { title: "Hè (Tháng 5 – 8)", desc: "Biển xanh nắng vàng", image: u("1507525428034-b723cf961d3e", 600), icon: Sun, iconClass: "text-amber-500" },
  { title: "Thu (Tháng 9 – 11)", desc: "Mùa vàng vùng cao", image: u("1470071459604-3b5ec3a7fe05", 600), icon: Leaf, iconClass: "text-orange-500" },
  { title: "Đông (Tháng 12 – 2)", desc: "Săn mây & Lễ hội", image: u("1483728642387-6c3bdd6c93e5", 600), icon: CloudSun, iconClass: "text-sky-400" },
  { title: "Xuân (Tháng 3 – 4)", desc: "Hoa nở khắp mọi nơi", image: u("1522383225653-ed111181a951", 600), icon: Flower2, iconClass: "text-pink-400" },
];

const TESTIMONIALS = [
  {
    quote: "VietJourney giúp mình khám phá những nơi tuyệt đẹp mà trước đây chưa từng biết đến!",
    name: "Nguyễn Minh Thư",
    meta: "Đã đi 15 chuyến",
    avatar: u("1494790108377-be9c29b29330", 160),
  },
  {
    quote: "Lộ trình gợi ý rất hợp lý, tiết kiệm thời gian và chi phí. Highly recommend!",
    name: "Trần Hoàng Nam",
    meta: "Đã đi 23 chuyến",
    avatar: u("1507003211169-0a1dd7228f2d", 160),
  },
  {
    quote: "Bản đồ tương tác siêu tiện lợi, thông tin chi tiết và cập nhật thường xuyên.",
    name: "Lê Quỳnh Anh",
    meta: "Đã đi 8 chuyến",
    avatar: u("1438761681033-6461ffad8d80", 160),
  },
];

const MAP_LEGEND = [
  { label: "Điểm đến nổi bật", icon: MapPin, iconClass: "text-[#1d4ed8]" },
  { label: "Tuyến du lịch", icon: RouteIcon, iconClass: "text-orange-500" },
  { label: "Khu vực thiên nhiên", icon: TreePine, iconClass: "text-emerald-600" },
  { label: "Văn hóa – Lịch sử", icon: Landmark, iconClass: "text-purple-500" },
];

function dayBadge(days: number): string {
  return `${days}N${Math.max(days - 1, 0)}Đ`;
}

function SectionHead({ title, moreHref }: { title: string; moreHref: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
        {title}
      </h2>
      {/* Right padding clears the carousel arrow buttons. */}
      <Link
        href={moreHref}
        className="mr-20 shrink-0 text-sm font-semibold text-[#1d4ed8] hover:underline"
      >
        Xem tất cả
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [featured, tours, miniMap] = await Promise.all([
    destinationsApi
      .list({ limit: 6, status: "PUBLISHED" })
      .catch(() => ({ data: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } })),
    // NOTE: /tour rejects unknown query keys (e.g. status) with 400,
    // so only limit is sent; the seed data is all PUBLISHED anyway.
    toursApi
      .list({ limit: 4 })
      .catch(() => ({ data: [], meta: { page: 1, limit: 4, total: 0, totalPages: 0 } })),
    destinationsApi
      .bbox({ minLng: 102, minLat: 8, maxLng: 110, maxLat: 24, limit: 80 })
      .catch(() => []),
  ]);

  const hot = featured.data.slice(0, 6);
  const useFallbackSpots = hot.length === 0;
  const ratings = await Promise.allSettled(
    hot.map((d) => ratingsApi.forDestination(d.id).catch(() => [])),
  );
  const ratingById = new Map(
    hot.map((d, i) => {
      const r = ratings[i].status === "fulfilled" ? ratings[i].value : [];
      const avg = r.length
        ? r.reduce((s, x) => s + x.score, 0) / r.length
        : null;
      return [d.id, { avg, count: r.length }] as const;
    }),
  );

  const tourList = tours.data.slice(0, 4);
  const useFallbackTours = tourList.length === 0;

  return (
    <>
      {/* ————— Hero ————— */}
      <section className="relative isolate overflow-hidden bg-slate-900">
        <div className="absolute inset-0 -z-10">
          <Image
            src={HERO_IMG}
            alt="Vịnh Hạ Long lúc hoàng hôn"
            fill
            priority
            sizes="100vw"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/55" />
        </div>

        <div className="mx-auto flex min-h-[560px] w-full max-w-[1280px] flex-col items-center justify-center px-5 pb-14 pt-28 text-center">
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.15] text-white md:text-6xl">
            Khám phá Việt Nam
            <br />
            theo cách của bạn
          </h1>
          <p className="mt-4 text-sm text-white/85 md:text-base">
            Bản đồ du lịch thông minh • Hàng ngàn điểm đến • Lộ trình cá nhân hóa
          </p>

          <form
            action="/destinations"
            method="get"
            className="mt-7 flex w-full max-w-2xl items-center gap-2 rounded-full bg-white p-2 pl-5 shadow-2xl"
          >
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              name="q"
              placeholder="Bạn muốn đi đâu? (Sapa, Đà Nẵng, Phú Quốc...)"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <Mic className="hidden size-4 shrink-0 text-slate-400 sm:block" />
            <Button type="submit" className="shrink-0 rounded-full px-6">
              Tìm kiếm
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {CATEGORY_PILLS.map(({ key, label, icon: Icon }) => (
              <Link
                key={label}
                href={`/destinations?category=${key.split("-")[0]}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/55"
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ————— Hot destinations ————— */}
      <section aria-labelledby="hot-heading" className="mx-auto max-w-[1400px] px-5 pb-4 pt-10">
        <div id="hot-heading">
          <SectionHead title="Điểm đến đang hot tuần này 🔥" moreHref="/destinations" />
        </div>
        <CarouselRow>
          {useFallbackSpots
            ? FIGMA_SPOTS.map((s) => (
                <DestinationCard
                  key={s.name}
                  destination={{
                    id: `figma-${s.name}`,
                    name: s.name,
                    slug: s.name,
                    category: s.category,
                    address: s.province,
                    images: [s.image],
                    status: "PUBLISHED",
                    createdById: "figma",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lng: s.lng,
                    lat: s.lat,
                    location: { type: "Point", coordinates: [s.lng, s.lat] },
                  } satisfies Destination}
                  badge={s.badge}
                  rating={s.rating}
                  ratingCount={s.ratingCount}
                  province={s.province}
                  href={`/destinations?q=${encodeURIComponent(s.name)}`}
                />
              ))
            : hot.map((d, i) => (
                <DestinationCard
                  key={d.id}
                  destination={d}
                  badge={(["verify", "hot", "verify", "hot", "verify", "new"] as CardBadge[])[i % 6]}
                  rating={ratingById.get(d.id)?.avg ?? null}
                  ratingCount={ratingById.get(d.id)?.count ?? 0}
                  province={d.address ?? undefined}
                />
              ))}
        </CarouselRow>
      </section>

      {/* ————— Favorite routes ————— */}
      <section aria-labelledby="routes-heading" className="mx-auto max-w-[1400px] px-5 pb-4 pt-8">
        <div id="routes-heading">
          <SectionHead title="Tuyến du lịch được yêu thích" moreHref="/tours" />
        </div>
        <CarouselRow>
          {useFallbackTours
            ? FIGMA_TOURS.map((t) => (
                <TourCard
                  key={t.name}
                  href={`/tours?q=${encodeURIComponent(t.name)}`}
                  image={t.image}
                  dayBadge={dayBadge(t.days)}
                  name={t.name}
                  subtitle={t.subtitle}
                  duration={`${t.days} ngày ${Math.max(t.days - 1, 0)} đêm`}
                  price={`Từ ${formatVnd(t.price)}`}
                  rating={t.rating}
                  ratingCount={t.ratingCount}
                />
              ))
            : tourList.map((t: Tour) => (
                <TourCard
                  key={t.id}
                  href={`/tours/${t.id}`}
                  image={t.route?.waypoints?.[0]?.destination?.images?.[0]}
                  dayBadge={dayBadge(t.days)}
                  name={t.name}
                  subtitle={t.description ?? "Khám phá những điểm đến nổi bật"}
                  duration={`${t.days} ngày ${Math.max(t.days - 1, 0)} đêm`}
                  price={`Từ ${formatVnd(t.basePrice)}`}
                  rating={null}
                />
              ))}
        </CarouselRow>
      </section>

      {/* ————— Mini map ————— */}
      <section aria-labelledby="map-heading" className="mx-auto max-w-[1400px] px-5 pb-4 pt-8">
        <h2
          id="map-heading"
          className="mb-5 text-xl font-bold tracking-tight text-slate-900 md:text-2xl"
        >
          Khám phá bản đồ du lịch Việt Nam
        </h2>
        <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-[#e8f1fd]">
          <div className="h-[380px]">
            <MapView>
              <ClickMarker />
              <MapLayers destinations={miniMap} />
            </MapView>
          </div>
          <div className="absolute left-4 top-4 w-60 rounded-xl border border-slate-200/70 bg-white/95 p-4 shadow-lg backdrop-blur">
            <ul className="space-y-2.5 text-[13px] font-medium text-slate-700">
              {MAP_LEGEND.map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  <row.icon className={`size-4 shrink-0 ${row.iconClass}`} />
                  <span className="flex-1">{row.label}</span>
                  <span className="grid size-4 place-items-center rounded border border-[#1d4ed8] bg-[#1d4ed8] text-[10px] leading-none text-white">
                    ✓
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/map"
              className={buttonClass({ size: "sm", className: "mt-3 w-full" })}
            >
              <MapIcon className="size-4" />
              Mở bản đồ đầy đủ
            </Link>
          </div>
        </div>
      </section>

      {/* ————— Seasons ————— */}
      <section aria-labelledby="season-heading" className="mx-auto max-w-[1400px] px-5 pb-4 pt-8">
        <div id="season-heading">
          <SectionHead title="Mùa này nên đi đâu?" moreHref="/destinations" />
        </div>
        <CarouselRow>
          {SEASONS.map((s) => (
            <Link
              key={s.title}
              href="/destinations"
              className="group w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-2 p-4 pb-3">
                <s.icon className={`size-5 shrink-0 ${s.iconClass}`} />
                <div>
                  <p className="text-sm font-bold text-slate-900">{s.title}</p>
                  <p className="text-xs text-slate-500">{s.desc}</p>
                </div>
              </div>
              <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                <Image
                  src={s.image}
                  alt={s.title}
                  fill
                  sizes="300px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  unoptimized
                />
              </div>
            </Link>
          ))}
        </CarouselRow>
      </section>

      {/* ————— Testimonials ————— */}
      <section aria-labelledby="social-heading" className="mx-auto max-w-[1400px] px-5 pb-16 pt-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2
            id="social-heading"
            className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl"
          >
            Cộng đồng nói gì về VietJourney?
          </h2>
          <span className="shrink-0 text-sm font-semibold text-[#1d4ed8]">
            Xem tất cả
          </span>
        </div>
        <CarouselRow sideArrows>
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex w-[320px] shrink-0 snap-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:w-[380px]"
            >
              <span className="relative block size-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                <Image
                  src={t.avatar}
                  alt={t.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                  unoptimized
                />
              </span>
              <span>
                <span className="text-sm tracking-tight text-amber-400">★★★★★</span>
                <blockquote className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-2.5">
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.meta}</p>
                </figcaption>
              </span>
            </figure>
          ))}
        </CarouselRow>
      </section>
    </>
  );
}

function TourCard({
  href,
  image,
  dayBadge,
  name,
  subtitle,
  duration,
  price,
  rating,
  ratingCount,
}: {
  href: string;
  image?: string;
  dayBadge: string;
  name: string;
  subtitle: string;
  duration: string;
  price: string;
  rating: number | null;
  ratingCount?: number;
}) {
  return (
    <Card className="group w-[300px] shrink-0 snap-start overflow-hidden transition-shadow hover:shadow-md">
      <Link href={href} className="block" aria-label={name}>
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
          {image ? (
            <Image
              src={image}
              alt={name}
              fill
              sizes="300px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              unoptimized
            />
          ) : null}
          <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-bold text-slate-800 shadow-sm">
            {dayBadge}
          </span>
        </div>
        <div className="space-y-1 p-4">
          <h3 className="line-clamp-1 font-semibold text-slate-900">{name}</h3>
          <p className="line-clamp-1 text-xs text-slate-500">{subtitle}</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3 className="size-3.5 text-slate-400" />
            {duration}
          </p>
          <p className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-slate-900">{price}</span>
            <Stars value={rating} count={ratingCount} />
          </p>
        </div>
      </Link>
    </Card>
  );
}
