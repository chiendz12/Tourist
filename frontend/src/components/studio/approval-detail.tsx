"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  Clock3,
  Loader2,
  MapPin,
  Star,
  X,
} from "lucide-react";
import { ratingsApi } from "@/lib/api/services";
import type { ApprovalRecord } from "@/lib/api/types";
import { classNames } from "@/lib/utils";
import { CommentBox } from "@/components/destination/comment-box";
import { timeAgo } from "@/lib/utils";
import { CATEGORY_LABEL } from "@/components/map/interactive/left-panel";

type DetailTab = "detail" | "media" | "history";

const STAGE_LABEL = ["Student", "Leader", "Lecturer"];

function stageOf(status: string): number {
  switch (status) {
    case "PENDING_LEADER":
      return 2;
    case "PENDING_LECTURER":
      return 3;
    case "PENDING_ADMIN":
      // Legacy rows (lecturer is now final) — still show as awaiting lecturer.
      return 3;
    case "PUBLISHED":
      return 4;
    default:
      return 1;
  }
}

interface ApprovalDetailProps {
  item: ApprovalRecord;
  pending: boolean;
  onReview: (action: "APPROVE" | "REJECT", comment?: string) => void;
  onClose: () => void;
}

/**
 * Right-hand detail of a review record: gallery, stepper, tabs
 * (detail / media / review history), comments and review actions.
 */
export function ApprovalDetailInline({
  item,
  pending,
  onReview,
  onClose,
}: ApprovalDetailProps) {
  const [photo, setPhoto] = React.useState(0);
  const [tab, setTab] = React.useState<DetailTab>("detail");
  const [comment, setComment] = React.useState("");

  const entity = item.entity;
  const isDestination = item.entityType === "DESTINATION";
  const images = entity?.images ?? [];
  const provinceName = entity?.province?.name;
  const stage = stageOf(item.status);

  const ratings = useQuery({
    queryKey: ["ratings", "approval", item.entityId],
    queryFn: () => ratingsApi.forDestination(item.entityId),
    enabled: isDestination && (tab === "detail" || tab === "media"),
  });
  const list = ratings.data ?? [];
  const avg = list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0;



  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h2 className="truncate text-base font-black tracking-tight">
          {entity?.name ?? `${item.entityType} · ${item.entityId.slice(0, 8)}…`}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết"
          className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        <span
          className={classNames(
            "mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold",
            item.status === "PUBLISHED"
              ? "bg-emerald-50 text-emerald-600"
              : item.status === "REJECTED"
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-700",
          )}
        >
          {item.status === "PUBLISHED" ? (
            <>
              <BadgeCheck className="size-3.5" /> Đã duyệt
            </>
          ) : (
            statusVi(item.status)
          )}
        </span>

        {images[photo] ? (
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={images[photo]} src={images[photo]} alt={entity?.name ?? ""} className="size-full object-cover" />
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/55 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {photo + 1} / {images.length}
            </span>
          </div>
        ) : (
          <div className="grid aspect-[16/10] place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400">
            Chưa có hình ảnh
          </div>
        )}
        {images.length > 1 ? (
          <div className="grid grid-cols-4 gap-1.5">
            {images.slice(0, 4).map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setPhoto(images.indexOf(src))}
                aria-label={`Xem ảnh ${i + 1}`}
                className={classNames(
                  "aspect-square overflow-hidden rounded-lg bg-slate-100 ring-2 transition",
                  images.indexOf(src) === photo ? "ring-[#1d4ed8]" : "ring-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        {isDestination ? (
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            <strong className="text-slate-900">{avg ? avg.toFixed(1) : "—"}</strong>
            <span>({list.length} đánh giá)</span>
            {entity?.category ? (
              <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
                {CATEGORY_LABEL[entity.category] ?? entity.category}
              </span>
            ) : null}
          </p>
        ) : null}
        {[entity?.address, provinceName].some(Boolean) ? (
          <p className="flex items-start gap-1.5 text-sm text-slate-500">
            <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
            {[entity?.address, provinceName].filter(Boolean).join(", ")}
          </p>
        ) : null}

        <div className="rounded-2xl border border-slate-100 p-3">
          <p className="text-[13px] font-bold text-slate-900">Thông tin sinh viên</p>
          <p className="mt-1.5 flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1d4ed8]/10 text-xs font-black text-[#1d4ed8]">
              {(item.submittedBy?.fullName ?? "?").trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-slate-800">
                {item.submittedBy?.fullName ?? "Ẩn danh"}
              </span>
              <span className="block truncate text-xs text-slate-400">
                @{item.submittedBy?.username ?? "—"}
              </span>
            </span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3 className="size-3.5" />
            Nộp lúc {new Date(item.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>

        <div>
          <p className="text-[13px] font-bold text-slate-900">Tiến trình duyệt</p>
          <ol className="mt-2 flex items-center">
            {STAGE_LABEL.map((label, i) => {
              const n = i + 1;
              const done = stage > n;
              const current = stage === n;
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none">
                  <span className="flex flex-col items-center">
                    <span
                      className={classNames(
                        "grid size-6 place-items-center rounded-full text-[11px] font-black text-white",
                        done || current
                          ? n === 1
                            ? "bg-[#1d4ed8]"
                            : n === 2
                              ? "bg-amber-500"
                              : n === 3
                                ? "bg-orange-500"
                                : "bg-emerald-500"
                          : "bg-slate-200 text-slate-500",
                      )}
                    >
                      {done ? "✓" : n}
                    </span>
                    <span className="mt-0.5 text-[10px] font-bold text-slate-600">{label}</span>
                    <span className="text-[9px] text-slate-400">
                      {done ? "Đã duyệt" : current ? "Chờ duyệt" : "—"}
                    </span>
                  </span>
                  {i < STAGE_LABEL.length - 1 ? <span className="mb-5 h-px w-full bg-slate-200" /> : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex gap-1 border-b border-slate-100">
          {(
            [
              { key: "detail", label: "Chi tiết" },
              { key: "media", label: `Ảnh & Media (${images.length})` },
              { key: "history", label: "Lịch sử duyệt" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={classNames(
                "-mb-px border-b-2 px-2.5 py-2 text-xs font-bold transition",
                tab === t.key
                  ? "border-[#1d4ed8] text-[#1d4ed8]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "detail" ? (
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-600">
            {entity?.description || "Chưa có mô tả."}
          </p>
        ) : null}
        {tab === "media" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setPhoto(images.indexOf(src))}
                className="aspect-square overflow-hidden rounded-xl bg-slate-100"
                aria-label={`Xem ảnh ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
            {images.length === 0 ? (
              <p className="col-span-3 py-4 text-center text-xs text-slate-400">Chưa có hình ảnh.</p>
            ) : null}
          </div>
        ) : null}
        {tab === "history" ? (
          <ol className="space-y-2">
            {(item.history ?? []).length === 0 ? (
              <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                Chưa có lượt xử lý nào.
              </li>
            ) : (
              (item.history ?? []).map((h) => (
                <li key={h.id} className="flex gap-2 rounded-xl bg-slate-50 p-2.5 text-xs">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[10px] font-black text-slate-500 shadow-sm">
                    {h.level.slice(0, 2)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-700">
                      {h.action} · Cấp {h.level}
                    </span>
                    {h.comment ? (
                      <span className="block truncate text-slate-500">“{h.comment}”</span>
                    ) : null}
                    <span className="text-[11px] text-slate-400">{timeAgo(h.createdAt)}</span>
                  </span>
                </li>
              ))
            )}
          </ol>
        ) : null}

        {isDestination ? (
          <div>
            <p className="text-[13px] font-bold text-slate-900">Bình luận & Phản hồi</p>
            <div className="mt-1.5">
              <CommentBox destinationId={item.entityId} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-[1fr_1fr_auto] gap-2 border-t border-slate-100 p-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => onReview("APPROVE", comment.trim() || undefined)}
          className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-2 py-2.5 text-[13px] font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Duyệt
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onReview("REJECT", comment.trim() || undefined)}
          className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 px-2 py-2.5 text-[13px] font-bold text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
        >
          <X className="size-4" />
          Trả lại
        </button>
        <Link
          href={
            item.entityType === "TOUR" ? `/tours/${item.entityId}` : `/destinations/${item.entityId}`
          }
          className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50"
        >
          Xem chi tiết
        </Link>
      </div>
      <div className="shrink-0 border-t border-slate-100 px-3 pb-3 pt-2">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Nhập bình luận… (gửi kèm khi Duyệt / Trả lại)"
          className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none placeholder:text-slate-400 focus:border-[#1d4ed8]"
        />
      </div>
    </aside>
  );
}

function statusVi(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Nháp",
    PENDING_LEADER: "Chờ Leader",
    PENDING_LECTURER: "Chờ Lecturer",
    PENDING_ADMIN: "Chờ Admin",
    PUBLISHED: "Đã duyệt",
    REJECTED: "Bị trả lại",
  };
  return map[status] ?? status;
}
