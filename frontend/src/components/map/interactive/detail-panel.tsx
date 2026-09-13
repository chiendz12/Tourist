"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bike,
  BookOpen,
  Camera,
  Check,
  Clock3,
  Coffee,
  Heart,
  Landmark,
  MapPin,
  Music,
  Navigation,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Sunrise,
  Tent,
  Ticket,
  Users,
  UtensilsCrossed,
  Wallet,
  Waves,
  X,
} from "lucide-react";
import { destinationsApi, ratingsApi } from "@/lib/api/services";
import type { DestinationCategory, Province, Tour } from "@/lib/api/types";
import { classNames } from "@/lib/utils";
import { Stars } from "@/components/shared/stars";
import { ReviewForm } from "@/components/destination/review-form";
import { CommentBox } from "@/components/destination/comment-box";
import { CATEGORY_LABEL } from "@/components/map/interactive/left-panel";

interface DetailPanelProps {
  id: string;
  provinces: Province[];
  tours: Tour[];
  tourFilterNote: string | null;
  userPosition: { lng: number; lat: number } | null;
  onClose: () => void;
  onAddStop: () => void;
  isStop: boolean;
  isFav: boolean;
  onToggleFavorite: () => void;
}

type DetailTab = "overview" | "media" | "tours" | "reviews";

const HIGHLIGHTS: Record<
  DestinationCategory,
  Array<{ icon: React.ComponentType<{ className?: string }>; label: string }>
> = {
  NATURE: [
    { icon: Waves, label: "Tắm biển" },
    { icon: Sunrise, label: "Ngắm bình minh" },
    { icon: Bike, label: "Thể thao biển" },
    { icon: Tent, label: "Cắm trại" },
  ],
  CULTURE: [
    { icon: Landmark, label: "Di tích cổ" },
    { icon: Camera, label: "Check-in sống ảo" },
    { icon: BookOpen, label: "Tìm hiểu lịch sử" },
    { icon: Users, label: "Lễ hội địa phương" },
  ],
  HISTORY: [
    { icon: Landmark, label: "Di tích cổ" },
    { icon: Camera, label: "Check-in sống ảo" },
    { icon: BookOpen, label: "Tìm hiểu lịch sử" },
    { icon: Users, label: "Lễ hội địa phương" },
  ],
  RELIGION: [
    { icon: Landmark, label: "Chùa chiền" },
    { icon: Sparkles, label: "Cầu an" },
    { icon: Camera, label: "Check-in sống ảo" },
    { icon: BookOpen, label: "Văn hóa tâm linh" },
  ],
  CUISINE: [
    { icon: UtensilsCrossed, label: "Ẩm thực địa phương" },
    { icon: Coffee, label: "Cà phê view đẹp" },
    { icon: Star, label: "Món must-try" },
    { icon: ShoppingBag, label: "Quà đặc sản" },
  ],
  ENTERTAINMENT: [
    { icon: Ticket, label: "Vui chơi giải trí" },
    { icon: Music, label: "Âm nhạc & sự kiện" },
    { icon: Sparkles, label: "Trải nghiệm mới" },
    { icon: Camera, label: "Check-in sống ảo" },
  ],
  OTHER: [
    { icon: MapPin, label: "Tham quan" },
    { icon: Camera, label: "Check-in sống ảo" },
    { icon: Coffee, label: "Nghỉ chân" },
    { icon: ShoppingBag, label: "Mua quà lưu niệm" },
  ],
};

function distanceKm(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

/**
 * Floating detail card: photo, verified title, rating, tabs and the
 * 2x2 action grid, per the Figma map screen.
 */
export function DetailPanel({
  id,
  provinces,
  tours,
  tourFilterNote,
  userPosition,
  onClose,
  onAddStop,
  isStop,
  isFav,
  onToggleFavorite,
}: DetailPanelProps) {
  const [tab, setTab] = React.useState<DetailTab>("overview");
  const [copied, setCopied] = React.useState(false);

  const detail = useQuery({
    queryKey: ["destination", id],
    queryFn: () => destinationsApi.get(id),
  });
  const ratings = useQuery({
    queryKey: ["ratings", id],
    queryFn: () => ratingsApi.forDestination(id),
    enabled: tab === "reviews" || tab === "overview",
  });

  const d = detail.data;
  const provinceName = provinces.find((p) => p.id === d?.provinceId)?.name;
  const list = ratings.data ?? [];
  const avg = list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0;
  const km =
    d && userPosition
      ? distanceKm(userPosition, { lng: d.lng, lat: d.lat })
      : null;

  const share = async () => {
    const url = `${window.location.origin}/destinations/${d?.slug ?? id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <aside className="pointer-events-auto flex max-h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/5">
      <div className="relative h-48 shrink-0 bg-slate-200">
        {d?.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.images[0]} alt={d.name} className="size-full object-cover" />
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow transition hover:text-slate-900"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4 pb-2">
          {detail.isPending ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : detail.isError || !d ? (
            <p className="text-sm text-rose-600">Không tải được điểm đến.</p>
          ) : (
            <>
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
                {d.name}
                {d.status === "PUBLISHED" ? (
                  <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600">
                    <BadgeCheck className="size-3.5" />
                    Đã verify
                  </span>
                ) : null}
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <strong className="text-slate-900">{avg ? avg.toFixed(1) : "—"}</strong>
                <span>({list.length} đánh giá)</span>
              </p>
              <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-slate-500">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {[d.address, provinceName].filter(Boolean).join(", ") || "VietJourney"}
              </p>
              {km != null ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                  <Navigation className="size-4 shrink-0 text-slate-400" />
                  {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} từ vị trí hiện tại
                </p>
              ) : null}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600">
                  🔥 Hot season
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                  🎟 {d.ticketPrice ? `Vé: ${d.ticketPrice}` : "Miễn phí vào cửa"}
                </span>
              </div>
            </>
          )}

          <div className="mt-3 flex gap-1 overflow-x-auto border-b border-slate-100">
            {(
              [
                { key: "overview", label: "Tổng quan" },
                { key: "media", label: "Hình ảnh & Video" },
                { key: "tours", label: "Lộ trình & Tour" },
                { key: "reviews", label: "Đánh giá" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={classNames(
                  "-mb-px shrink-0 border-b-2 px-2.5 py-2 text-[13px] font-semibold transition",
                  tab === t.key
                    ? "border-[#1d4ed8] text-[#1d4ed8]"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-2">
          {tab === "overview" && d ? (
            <div>
              <p className="text-[13px] leading-relaxed text-slate-600">
                {d.description || "Chưa có mô tả cho điểm đến này."}
              </p>
              <p className="mt-3 text-[13px] font-bold text-slate-900">Highlights</p>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-2.5">
                {HIGHLIGHTS[d.category].map((h) => (
                  <li
                    key={h.label}
                    className="flex items-center gap-1.5 text-[13px] text-slate-600"
                  >
                    <h.icon className="size-4 shrink-0 text-[#1d4ed8]" />
                    {h.label}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-400">
                {CATEGORY_LABEL[d.category]}
                {provinceName ? ` · ${provinceName}` : ""}
              </p>
            </div>
          ) : null}

          {tab === "media" ? (
            <div className="grid grid-cols-2 gap-1.5">
              {(d?.images ?? []).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-24 w-full rounded-xl object-cover"
                />
              ))}
              {!d?.images?.length ? (
                <p className="col-span-2 py-4 text-center text-xs text-slate-400">
                  Chưa có hình ảnh.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "tours" ? (
            <div>
              {tourFilterNote ? (
                <p className="rounded-lg bg-[#1d4ed8]/5 px-2.5 py-1.5 text-xs font-semibold text-[#1d4ed8]">
                  {tourFilterNote}
                </p>
              ) : null}
              <ul className="mt-2 space-y-2">
                {tours.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                    Không có tour nào khớp bộ lọc.
                  </li>
                ) : (
                  tours.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/tours/${t.id}`}
                        className="block rounded-xl border border-slate-200 p-2.5 transition hover:border-[#1d4ed8]/40"
                      >
                        <p className="truncate text-[13px] font-bold text-slate-800">
                          {t.name}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-0.5">
                            <Clock3 className="size-3" />
                            {t.days} ngày
                          </span>
                          <span className="flex items-center gap-0.5 font-bold text-[#1d4ed8]">
                            <Wallet className="size-3" />
                            {String(t.basePrice)} {t.currency}
                          </span>
                        </p>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          {tab === "reviews" ? (
            <div>
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <p className="text-3xl font-black text-slate-900">
                  {list.length ? avg.toFixed(1) : "—"}
                </p>
                <div>
                  <Stars value={avg} className="text-amber-400" />
                  <p className="mt-0.5 text-xs text-slate-500">
                    {list.length} đánh giá
                  </p>
                </div>
              </div>
              <ul className="mt-2 space-y-2">
                {list.length === 0 ? (
                  <li className="py-3 text-center text-xs text-slate-400">
                    Chưa có đánh giá.
                  </li>
                ) : (
                  list.slice(0, 4).map((r) => (
                    <li key={r.id} className="rounded-xl bg-slate-50 p-2.5">
                      <p className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          {r.user?.fullName ?? "Du khách"}
                        </span>
                        <Stars value={r.score} className="text-amber-400" />
                      </p>
                      {r.review ? (
                        <p className="mt-1 line-clamp-2 text-[13px] text-slate-600">
                          {r.review}
                        </p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              <div className="mt-2">
                <ReviewForm destinationId={id} />
              </div>
              <div className="mt-2">
                <CommentBox destinationId={id} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={onAddStop}
          className={classNames(
            "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-bold transition",
            isStop
              ? "bg-emerald-50 text-emerald-700"
              : "bg-[#1d4ed8] text-white hover:bg-blue-700",
          )}
        >
          {isStop ? <Check className="size-4" /> : <Plus className="size-4" />}
          {isStop ? "Đã thêm" : "Thêm vào lộ trình"}
        </button>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={classNames(
            "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[13px] font-bold transition",
            isFav
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-rose-200 text-rose-500 hover:bg-rose-50",
          )}
        >
          <Heart className={classNames("size-4", isFav && "fill-rose-500")} />
          {isFav ? "Đã lưu" : "Lưu yêu thích"}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Share2 className="size-4" />}
          {copied ? "Đã chép!" : "Chia sẻ"}
        </button>
        {d ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 px-2 py-2.5 text-[13px] font-bold text-emerald-600 transition hover:bg-emerald-50"
          >
            <Navigation className="size-4" />
            Xem chỉ đường
          </a>
        ) : (
          <span className="rounded-xl border border-slate-100 px-2 py-2.5 text-center text-[13px] font-bold text-slate-300">
            Xem chỉ đường
          </span>
        )}
      </div>
    </aside>
  );
}
