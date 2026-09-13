"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin, Star, Users, Wallet } from "lucide-react";
import type { Destination, Rating, Tour } from "@/lib/api/types";
import { classNames } from "@/lib/utils";
import { Stars } from "@/components/shared/stars";
import { ReviewForm } from "@/components/destination/review-form";
import { CommentBox } from "@/components/destination/comment-box";
import { CATEGORY_LABEL } from "@/components/map/interactive/left-panel";

export type DetailTabKey = "overview" | "media" | "tours" | "reviews";

interface DetailTabsProps {
  destination: Destination;
  ratings: Rating[];
  nearby: Destination[];
  tours: Tour[];
  provinceName?: string | null;
  defaultTab: DetailTabKey;
}

/**
 * Tabbed body of the destination page: overview, media gallery,
 * suggested tours and ratings/discussion.
 */
export function DetailTabs({
  destination,
  ratings,
  nearby,
  tours,
  provinceName,
  defaultTab,
}: DetailTabsProps) {
  const [tab, setTab] = React.useState<DetailTabKey>(defaultTab);
  const avg =
    ratings.length === 0
      ? 0
      : ratings.reduce((s, r) => s + r.score, 0) / ratings.length;

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {(
          [
            { key: "overview", label: "Tổng quan" },
            { key: "media", label: "Hình ảnh & Video" },
            { key: "tours", label: "Lộ trình & Tour" },
            { key: "reviews", label: `Đánh giá (${ratings.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={classNames(
              "-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition",
              tab === t.key
                ? "border-[#1d4ed8] text-[#1d4ed8]"
                : "border-transparent text-slate-500 hover:text-slate-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === "overview" ? (
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Về {destination.name}
            </h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">
              {destination.description || "Chưa có mô tả cho điểm đến này."}
            </p>

            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">
              Điểm nổi bật
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Loại hình", CATEGORY_LABEL[destination.category]],
                ["Tỉnh / Thành", provinceName ?? "—"],
                [
                  "Giá vé",
                  destination.ticketPrice
                    ? String(destination.ticketPrice)
                    : "Miễn phí",
                ],
                [
                  "Đánh giá",
                  ratings.length ? `${avg.toFixed(1)}/5` : "Chưa có",
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {k}
                  </dt>
                  <dd className="truncate text-sm font-bold text-slate-800">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            {nearby.length ? (
              <>
                <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Điểm đến gần đây
                </h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {nearby
                    .filter((n) => n.id !== destination.id)
                    .slice(0, 4)
                    .map((n) => (
                      <li key={n.id}>
                        <Link
                          href={`/destinations/${n.slug}`}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 transition hover:border-[#1d4ed8]/40 hover:shadow-sm"
                        >
                          {n.images?.[0] ? (
                            <Image
                              src={n.images[0]}
                              alt=""
                              width={64}
                              height={64}
                              className="size-16 shrink-0 rounded-lg object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                              <MapPin className="size-5" />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">
                              {n.name}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {n.distanceM != null
                                ? `${(n.distanceM / 1000).toFixed(1)} km`
                                : CATEGORY_LABEL[n.category]}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {tab === "media" ? (
          <div id="media">
            {destination.images?.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {destination.images.map((src) => (
                  <span
                    key={src}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"
                  >
                    <Image
                      src={src}
                      alt={destination.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Chưa có hình ảnh cho điểm đến này.
              </p>
            )}
          </div>
        ) : null}

        {tab === "tours" ? (
          <div>
            {tours.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Chưa có tour gợi ý. Khám phá các tour nổi bật bên dưới.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {tours.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tours/${t.id}`}
                      className="block rounded-2xl border border-slate-200 p-4 transition hover:border-[#1d4ed8]/40 hover:shadow-md"
                    >
                      <p className="font-bold text-slate-900">{t.name}</p>
                      {t.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {t.description}
                        </p>
                      ) : null}
                      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock3 className="size-3.5 text-slate-400" />
                          {t.days} ngày
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5 text-slate-400" />
                          {t.paxCount} khách
                        </span>
                        <span className="flex items-center gap-1 text-[#1d4ed8]">
                          <Wallet className="size-3.5" />
                          {String(t.basePrice)} {t.currency}
                        </span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/tours"
              className="mt-4 inline-block text-sm font-bold text-[#1d4ed8] hover:underline"
            >
              Xem tất cả tour →
            </Link>
          </div>
        ) : null}

        {tab === "reviews" ? (
          <div>
            <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-4xl font-black text-slate-900">
                {ratings.length ? avg.toFixed(1) : "—"}
              </p>
              <div>
                <Stars value={avg} className="text-amber-400" />
                <p className="mt-1 text-xs text-slate-500">
                  Dựa trên {ratings.length} đánh giá đã kiểm duyệt
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {ratings.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ trải
                  nghiệm!
                </li>
              ) : (
                ratings.slice(0, 8).map((r) => (
                  <li key={r.id} className="rounded-2xl border border-slate-100 p-4">
                    <p className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="grid size-8 place-items-center rounded-full bg-[#1d4ed8]/10 text-xs font-bold text-[#1d4ed8]">
                          {(r.user?.fullName ?? "K").charAt(0).toUpperCase()}
                        </span>
                        <span className="font-bold text-slate-800">
                          {r.user?.fullName ?? "Du khách"}
                        </span>
                      </span>
                      <Stars value={r.score} className="text-amber-400" />
                    </p>
                    {r.review ? (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {r.review}
                      </p>
                    ) : null}
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Star className="size-3" />
                      {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </li>
                ))
              )}
            </ul>

            <h3 className="mt-6 text-base font-bold text-slate-900">
              Viết đánh giá của bạn
            </h3>
            <div className="mt-2">
              <ReviewForm destinationId={destination.id} />
            </div>

            <h3 className="mt-6 text-base font-bold text-slate-900">Thảo luận</h3>
            <div className="mt-2">
              <CommentBox destinationId={destination.id} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
