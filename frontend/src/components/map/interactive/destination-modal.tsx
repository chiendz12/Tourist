"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  Clock3,
  Download,
  FileText,
  Flame,
  Heart,
  Link2,
  MapPin,
  Navigation,
  Plus,
  Printer,
  Share2,
  Star,
  Ticket,
  X,
} from "lucide-react";
import {
  destinationsApi,
  itinerariesApi,
  ratingsApi,
} from "@/lib/api/services";
import type { Destination, Province, Tour } from "@/lib/api/types";
import { classNames } from "@/lib/utils";
import { Stars } from "@/components/shared/stars";
import { ReviewForm } from "@/components/destination/review-form";
import { CommentBox } from "@/components/destination/comment-box";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL } from "@/components/map/interactive/left-panel";

interface DestinationModalProps {
  id: string;
  provinces: Province[];
  tours: Tour[];
  /** Demo-mode data rendered when the backend detail is unavailable. */
  fallback?: Destination | null;
  fallbackRating?: { avg: number; count: number } | null;
  userPosition: { lng: number; lat: number } | null;
  onClose: () => void;
  onAddStop: (destinationId: string) => void;
  onAddTourStops: (ids: string[]) => void;
  isStop: boolean;
  isFav: boolean;
  onToggleFavorite: () => void;
}

type ModalTab = "overview" | "tours" | "reviews";

function isNew(createdAt: string): boolean {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  return Number.isFinite(days) && days < 30;
}

/**
 * Destination detail modal: gallery + info columns on desktop,
 * bottom sheet on mobile. Opened from map pins and markers.
 */
export function DestinationModal({
  id,
  provinces,
  tours,
  fallback,
  fallbackRating,
  userPosition,
  onClose,
  onAddStop,
  onAddTourStops,
  isStop,
  isFav,
  onToggleFavorite,
}: DestinationModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [photo, setPhoto] = React.useState(0);
  const [tab, setTab] = React.useState<ModalTab>("overview");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const discussionRef = React.useRef<HTMLDivElement | null>(null);

  const isDemoId = id.startsWith("figma-");
  const detail = useQuery({
    queryKey: ["destination", id],
    queryFn: () => destinationsApi.get(id),
    enabled: !isDemoId || !fallback,
    retry: false,
  });
  const ratings = useQuery({
    queryKey: ["ratings", id],
    queryFn: () => ratingsApi.forDestination(id),
    enabled: !isDemoId,
  });
  // Demo markers render from embedded data; the fetch is skipped entirely.
  const d = detail.data ?? (isDemoId ? (fallback ?? null) : null);
  const detailFailed = detail.isError && !d;
  const nearby = useQuery({
    queryKey: ["destination-nearby", id],
    queryFn: () =>
      d
        ? destinationsApi.nearby({ lng: d.lng, lat: d.lat, radius: 60000, limit: 7 })
        : Promise.resolve([]),
    enabled: !!d && tab === "overview",
  });

  const list = ratings.data ?? [];
  const avg = list.length
    ? list.reduce((s, r) => s + r.score, 0) / list.length
    : (fallbackRating?.avg ?? 0);
  const count = list.length || fallbackRating?.count || 0;
  const provinceName = provinces.find((p) => p.id === d?.provinceId)?.name;
  const images = d?.images ?? [];
  const km =
    d && userPosition
      ? haversineKm(userPosition, { lng: d.lng, lat: d.lat })
      : null;
  const isHot = avg >= 4.5 && count >= 5;

  // NOTE: the parent remounts per destination (key={id}), so useState
  // initializers above are always fresh — no reset effect needed.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/destinations/${d?.slug ?? id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const newItineraryFromHere = async () => {
    if (!d) return;
    try {
      const created = (await itinerariesApi.create({
        name: `Chuyến đi ${d.name}`,
        payload: { travelers: 2, days: [{ day: 1, stops: [d.id] }] },
      })) as { id: string };
      router.push(`/itinerary/new?id=${created.id}`);
    } catch (e) {
      toast({ title: "Tạo chuyến đi thất bại", description: e instanceof Error ? e.message : undefined, variant: "error" });
    }
  };

  const downloadCsv = () => {
    if (!d) return;
    const rows = [
      ["Tên", "Địa chỉ", "Vĩ độ", "Kinh độ", "Giá vé", "Đánh giá", "Lượt đánh giá"],
      [d.name, d.address ?? "", String(d.lat), String(d.lng), d.ticketPrice != null ? String(d.ticketPrice) : "Miễn phí", avg ? avg.toFixed(1) : "", String(list.length)],
    ];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const el = document.createElement("a");
    el.href = url;
    el.download = `${d.slug}.csv`;
    el.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={d?.name ?? "Chi tiết điểm đến"}>
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <div className="pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-3xl lg:max-w-5xl">
          <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />
          {detail.isPending ? (
            <p className="p-10 text-center text-sm text-slate-500">Đang tải…</p>
          ) : detailFailed || !d ? (
            <div className="p-10 text-center">
              <p className="text-sm font-bold text-rose-600">Không tải được điểm đến.</p>
              <button type="button" onClick={onClose} className="mt-3 text-sm font-bold text-[#1d4ed8] hover:underline">
                Đóng
              </button>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.05fr_1fr] lg:overflow-hidden">
              {/* Gallery column */}
              <div className="p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
                  {images[photo] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={images[photo]} src={images[photo]} alt={d.name} className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-sm text-slate-400">
                      Chưa có hình ảnh
                    </span>
                  )}
                  <span className="absolute left-3 top-3 rounded-lg bg-black/55 px-2 py-1 text-xs font-bold tabular-nums text-white backdrop-blur">
                    {images.length ? `${photo + 1} / ${images.length}` : "0 / 0"}
                  </span>
                  <span className="absolute right-3 top-3 flex gap-1.5">
                    {d.status === "PUBLISHED" ? (
                      <span className="flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-bold text-emerald-600 shadow">
                        <BadgeCheck className="size-3.5" />
                        Đã verify
                      </span>
                    ) : null}
                    {isHot ? (
                      <span className="flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-bold text-orange-500 shadow">
                        <Flame className="size-3.5" />
                        Hot
                      </span>
                    ) : null}
                    {isNew(d.createdAt) ? (
                      <span className="rounded-lg bg-white/95 px-2 py-1 text-[11px] font-bold text-sky-600 shadow">
                        New
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng"
                    className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow transition hover:text-slate-900 lg:hidden"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                {images.length > 1 ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {images.slice(0, 6).map((src, i) => (
                      <button
                        key={src + i}
                        type="button"
                        onClick={() => setPhoto(images.indexOf(src))}
                        aria-label={`Xem ảnh ${i + 1}`}
                        className={classNames(
                          "relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 ring-2 transition",
                          images.indexOf(src) === photo ? "ring-[#1d4ed8]" : "ring-transparent hover:ring-slate-300",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                        {i === 5 && images.length > 6 ? (
                          <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-black text-white">
                            +{images.length - 6}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 hidden gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={() => onAddStop(d.id)}
                    className={classNames(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                      isStop ? "bg-emerald-50 text-emerald-700" : "bg-[#1d4ed8] text-white hover:bg-blue-700",
                    )}
                  >
                    <Plus className="size-4" />
                    {isStop ? "Đã thêm vào lộ trình" : "Thêm vào lộ trình"}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    className={classNames(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition",
                      isFav ? "border-rose-200 bg-rose-50 text-rose-600" : "border-rose-200 text-rose-500 hover:bg-rose-50",
                    )}
                  >
                    <Heart className={classNames("size-4", isFav && "fill-rose-500")} />
                    Lưu yêu thích
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Share2 className="size-4" />}
                    {copied ? "Đã chép!" : "Chia sẻ"}
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2.5 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50"
                  >
                    <Navigation className="size-4" />
                    Xem chỉ đường
                  </a>
                </div>
              </div>

              {/* Info column */}
              <div className="flex min-h-0 flex-col p-4 pt-1 sm:p-5 sm:pt-2 lg:overflow-y-auto lg:pl-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                    {d.name}
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng"
                    className="hidden size-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:grid"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <strong className="text-slate-900">{avg ? avg.toFixed(1) : "—"}</strong>
                  <span>({count} đánh giá)</span>
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  {[d.address, provinceName].filter(Boolean).join(", ") || "VietJourney"}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
                  {km != null ? (
                    <span>
                      Cách bạn {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(0)} km`}
                    </span>
                  ) : null}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#1d4ed8] hover:underline"
                  >
                    Chỉ đường
                  </a>
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                  <Ticket className="size-4 text-slate-400" />
                  Giá vé:{" "}
                  <strong>{d.ticketPrice != null && String(d.ticketPrice) !== "" ? String(d.ticketPrice) : "Miễn phí"}</strong>
                  {d.ticketPrice ? <span className="text-slate-400">/ người lớn</span> : null}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {[CATEGORY_LABEL[d.category], provinceName].filter(Boolean).map((c) => (
                    <span key={c} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {c}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex gap-1 overflow-x-auto border-b border-slate-200">
                  {(
                    [
                      { key: "overview", label: "Tổng quan" },
                      { key: "tours", label: "Lịch trình & Tour" },
                      { key: "reviews", label: `Đánh giá (${count})` },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={classNames(
                        "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-bold transition",
                        tab === t.key ? "border-[#1d4ed8] text-[#1d4ed8]" : "border-transparent text-slate-500 hover:text-slate-800",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="py-3">
                  {tab === "overview" ? (
                    <div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                        {d.description || "Chưa có mô tả cho điểm đến này."}
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { icon: Clock3, k: "Giờ mở cửa", v: hoursOf(d) },
                          { icon: Ticket, k: "Giá vé", v: d.ticketPrice != null && String(d.ticketPrice) !== "" ? String(d.ticketPrice) : "Miễn phí" },
                          { icon: Star, k: "Đánh giá", v: avg ? `${avg.toFixed(1)}/5` : "Chưa có" },
                          { icon: MapPin, k: "Khu vực", v: provinceName ?? "Việt Nam" },
                        ].map((t) => (
                          <div key={t.k} className="rounded-xl bg-slate-50 px-2.5 py-2.5 text-center">
                            <t.icon className="mx-auto size-4 text-slate-500" />
                            <dt className="mt-1 text-[11px] font-semibold text-slate-500">{t.k}</dt>
                            <dd className="truncate text-[13px] font-bold text-slate-800" title={t.v}>{t.v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-3 space-y-2 text-sm">
                        <p className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Clock3 className="size-4" />
                            Giờ mở cửa
                          </span>
                          <span className="font-semibold text-slate-800">{hoursOf(d)}</span>
                        </p>
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <MapPin className="size-4" />
                            Dịch vụ gần nhất
                          </span>
                          <span className="flex items-center gap-1">
                            {(nearby.data ?? []).slice(0, 4).map((n) => (
                              <span key={n.id} title={n.name} className="grid size-8 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                                {n.images?.[0] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={n.images[0]} alt="" loading="lazy" className="size-full object-cover" />
                                ) : (
                                  <MapPin className="size-3.5" />
                                )}
                              </span>
                            ))}
                            {(nearby.data ?? []).length > 4 ? (
                              <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                                +{(nearby.data ?? []).length - 4}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === "tours" ? (
                    <div>
                      {tours.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                          Chưa có tour gợi ý cho điểm đến này.
                        </p>
                      ) : (
                        <ul className="space-y-2.5">
                          {tours.slice(0, 5).map((t) => (
                            <li key={t.id} className="flex gap-2.5 rounded-2xl border border-slate-200 p-2">
                              {t.route?.waypoints?.[0]?.destination?.images?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={t.route.waypoints[0].destination.images[0]}
                                  alt=""
                                  loading="lazy"
                                  className="h-20 w-24 shrink-0 rounded-xl object-cover"
                                />
                              ) : (
                                <span className="grid h-20 w-24 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-300">
                                  <MapPin className="size-5" />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <Link href={`/tours/${t.id}`} className="block truncate text-sm font-bold text-slate-900 hover:text-[#1d4ed8]">
                                  {t.name}
                                </Link>
                                <p className="truncate text-xs text-slate-500">
                                  {t.days} ngày · {String(t.basePrice)} {t.currency}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAddTourStops(
                                      (t.route?.waypoints ?? [])
                                        .map((w) => w.destinationId)
                                        .filter(Boolean),
                                    )
                                  }
                                  disabled={!(t.route?.waypoints ?? []).length}
                                  className="mt-1.5 flex items-center gap-1 rounded-lg border border-[#1d4ed8]/30 px-2 py-1 text-xs font-bold text-[#1d4ed8] transition hover:bg-[#1d4ed8]/5 disabled:opacity-40"
                                >
                                  <Plus className="size-3.5" />
                                  Thêm vào lộ trình
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={newItineraryFromHere}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#1d4ed8]/30 py-2.5 text-sm font-bold text-[#1d4ed8] transition hover:bg-[#1d4ed8]/5"
                      >
                        <Plus className="size-4" />
                        Tạo lộ trình mới từ điểm này
                      </button>
                    </div>
                  ) : null}

                  {tab === "reviews" ? (
                    <div>
                      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                        <p className="text-3xl font-black text-slate-900">{count ? avg.toFixed(1) : "—"}</p>
                        <div>
                          <Stars value={avg} className="text-amber-400" />
                          <p className="mt-0.5 text-xs text-slate-500">{count} đánh giá</p>
                        </div>
                      </div>
                      <ul className="mt-2.5 space-y-2.5">
                        {count === 0 ? (
                          <li className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                            Chưa có đánh giá nào.
                          </li>
                        ) : (
                          list.slice(0, 5).map((r) => (
                            <li key={r.id} className="rounded-2xl border border-slate-100 p-3">
                              <p className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="grid size-8 place-items-center rounded-full bg-[#1d4ed8]/10 text-xs font-black text-[#1d4ed8]">
                                    {(r.user?.fullName ?? "K").charAt(0).toUpperCase()}
                                  </span>
                                  <span>
                                    <span className="block font-bold text-slate-800">{r.user?.fullName ?? "Du khách"}</span>
                                    <span className="block text-[11px] font-normal text-slate-400">
                                      {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                                    </span>
                                  </span>
                                </span>
                                <span className="flex items-center gap-1 text-xs font-bold text-slate-700">
                                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                  {r.score.toFixed(1)}
                                </span>
                              </p>
                              {r.review ? (
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{r.review}</p>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setTab("reviews");
                                  requestAnimationFrame(() =>
                                    discussionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                                  );
                                }}
                                className="mt-1.5 text-xs font-bold text-[#1d4ed8] hover:underline"
                              >
                                Trả lời
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                      <div className="mt-3">
                        <ReviewForm destinationId={d.id} />
                      </div>
                      <div ref={discussionRef} className="mt-3 scroll-mt-4">
                        <CommentBox destinationId={d.id} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-1 flex gap-2 pb-1 lg:hidden">
                  <button
                    type="button"
                    onClick={() => onAddStop(d.id)}
                    className={classNames(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                      isStop ? "bg-emerald-50 text-emerald-700" : "bg-[#1d4ed8] text-white",
                    )}
                  >
                    <Plus className="size-4" />
                    {isStop ? "Đã thêm" : "Thêm vào lộ trình"}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    aria-label="Lưu yêu thích"
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-500"
                  >
                    <Heart className={classNames("size-4", isFav && "fill-rose-500")} />
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    aria-label="Chia sẻ"
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500"
                  >
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Link2 className="size-4" />}
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Chỉ đường"
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-emerald-200 text-emerald-600"
                  >
                    <Navigation className="size-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setExportOpen(true)}
                    aria-label="Xuất"
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500"
                  >
                    <Download className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {exportOpen ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-3 shadow-2xl">
            <p className="px-1 pb-1 text-sm font-bold text-slate-900">Xuất thông tin</p>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-slate-50"
            >
              <Printer className="size-5 shrink-0 text-slate-400" />
              <span>
                <span className="block text-sm font-bold text-slate-800">PDF Itinerary</span>
                <span className="block text-xs text-slate-500">In hoặc lưu thành PDF</span>
              </span>
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-slate-50"
            >
              <FileText className="size-5 shrink-0 text-emerald-500" />
              <span>
                <span className="block text-sm font-bold text-slate-800">Excel Budget</span>
                <span className="block text-xs text-slate-500">Tải file CSV chi tiết</span>
              </span>
            </button>
            <button
              type="button"
              onClick={share}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-slate-50"
            >
              <Link2 className="size-5 shrink-0 text-slate-400" />
              <span>
                <span className="block text-sm font-bold text-slate-800">Chia sẻ link công khai</span>
                <span className="block text-xs text-slate-500">
                  {copied ? "Đã sao chép!" : "Sao chép liên kết điểm đến"}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="mt-1 w-full rounded-xl bg-slate-100 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

function hoursOf(d: { openingHours?: unknown }): string {
  const h = d.openingHours;
  if (typeof h === "string" && h.trim()) return h;
  if (h && typeof h === "object") {
    const hours = (h as { hours?: unknown }).hours;
    if (typeof hours === "string" && hours.trim()) return hours;
  }
  return "—";
}
