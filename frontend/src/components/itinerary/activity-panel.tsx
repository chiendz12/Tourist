"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Clock3,
  MapPin,
  Pencil,
  PencilLine,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type { Destination, Rating } from "@/lib/api/types";
import { classNames } from "@/lib/utils";
import { Stars } from "@/components/shared/stars";
import { TimePicker } from "@/components/itinerary/time-picker";
import { buttonClass } from "@/components/ui/button";
import {
  KIND_META,
  fmtKm,
  formatVnd,
  type Activity,
  type ActivityKind,
} from "@/components/itinerary/types";

export interface Alternative {
  d: Destination;
  km: number;
  avg: number;
  count: number;
}

interface ActivityPanelProps {
  activity: Activity;
  dest: Destination | null;
  avg: number;
  count: number;
  review: Rating | null;
  alternatives: Alternative[];
  onClose: () => void;
  onChange: (patch: Partial<Activity>) => void;
  onDelete: () => void;
  onReplace: (dest: Destination) => void;
  onQuickAdd: (dest: Destination) => void;
}

/**
 * Right column: activity detail with edit mode, review, AI alternatives
 * and edit/replace/delete actions.
 */
export function ActivityPanel({
  activity,
  dest,
  avg,
  count,
  review,
  alternatives,
  onClose,
  onChange,
  onDelete,
  onReplace,
  onQuickAdd,
}: ActivityPanelProps) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(activity.title);
  const [kind, setKind] = React.useState<ActivityKind>(activity.kind);
  const [start, setStart] = React.useState(activity.start);
  const [end, setEnd] = React.useState(activity.end);
  const [cost, setCost] = React.useState(String(activity.cost || ""));
  const [note, setNote] = React.useState(activity.note ?? "");
  // NOTE: the parent remounts this panel per activity (key={activity.id}),
  // so prop-derived initial state above is always fresh — no sync effect.

  const displayTitle =
    activity.title || dest?.name || KIND_META[activity.kind].label;
  const photo = dest?.images?.[0];

  const saveEdit = () => {
    onChange({
      title: title.trim(),
      kind,
      start,
      end,
      cost: Number(cost.replace(/[^\d]/g, "")) || 0,
      note: note.slice(0, 200),
    });
    setEditing(false);
  };

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h2 className="text-sm font-bold text-slate-900">Chi tiết hoạt động</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết"
          className="grid size-7 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-2.5">
        <div className="flex gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-300">
              <MapPin className="size-6" />
            </span>
          )}
          <div className="min-w-0">
            {editing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên hoạt động"
                className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm font-bold outline-none focus:border-[#1d4ed8]"
              />
            ) : (
              <p className="truncate text-[15px] font-bold text-slate-900">{displayTitle}</p>
            )}
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold"
              style={{ background: KIND_META[activity.kind].bg, color: KIND_META[activity.kind].color }}
            >
              <MapPin className="size-3" />
              {KIND_META[editing ? kind : activity.kind].label}
            </span>
            {!editing ? (
              <>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  <strong className="text-slate-800">{avg ? avg.toFixed(1) : "—"}</strong>
                  <span>({count} đánh giá)</span>
                </p>
                {dest?.address ? (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                    <MapPin className="mt-0.5 size-3 shrink-0" />
                    <span className="line-clamp-2">{dest.address}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(Object.keys(KIND_META) as ActivityKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={classNames(
                      "rounded-md px-1.5 py-1 text-[11px] font-bold transition",
                      kind === k ? "bg-[#1d4ed8] text-white" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {KIND_META[k].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-2 rounded-xl bg-slate-50 p-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block text-xs font-semibold text-slate-500">
                Bắt đầu
                <span className="mt-0.5 block">
                  <TimePicker value={start} onChange={setStart} ariaLabel="Giờ bắt đầu" />
                </span>
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Kết thúc
                <span className="mt-0.5 block">
                  <TimePicker value={end} onChange={setEnd} ariaLabel="Giờ kết thúc" />
                </span>
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-500">
              Chi phí (VND)
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="0"
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 tabular-nums outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Ghi chú cá nhân
              <span className="relative mt-0.5 block">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 200))}
                  rows={3}
                  placeholder="Thêm ghi chú cho hoạt động này…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] outline-none"
                />
                <span className="absolute bottom-1.5 right-2 text-[11px] tabular-nums text-slate-400">
                  {note.length}/200
                </span>
              </span>
            </label>
            <button type="button" onClick={saveEdit} className={buttonClass({ size: "sm", className: "w-full" })}>
              <Check className="size-4" />
              Lưu thay đổi
            </button>
          </div>
        ) : (
          <>
            <dl className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Clock3 className="size-4 text-slate-400" />
                  Thời gian gợi ý
                </dt>
                <dd className="tabular-nums text-slate-500">
                  {activity.start} - {activity.end}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Wallet className="size-4 text-slate-400" />
                  Chi phí ước tính
                </dt>
                <dd className="font-bold text-slate-900">
                  {activity.cost > 0 ? formatVnd(activity.cost) : "Miễn phí"}
                </dd>
              </div>
            </dl>
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <PencilLine className="size-4 text-slate-400" />
                Ghi chú cá nhân
              </p>
              <div className="relative mt-1.5">
                <textarea
                  value={activity.note ?? ""}
                  onChange={(e) => onChange({ note: e.target.value.slice(0, 200) })}
                  rows={3}
                  placeholder="Thêm ghi chú cho hoạt động này…"
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-[13px] leading-relaxed outline-none focus:border-[#1d4ed8]"
                />
                <span className="absolute bottom-1.5 right-2 text-[11px] tabular-nums text-slate-400">
                  {(activity.note ?? "").length}/200
                </span>
              </div>
            </div>
          </>
        )}

        {!editing && (review || count > 0) ? (
          <div>
            <p className="text-[13px] font-bold text-slate-900">Đánh giá & Review</p>
            {review ? (
              <div className="mt-1.5 rounded-xl bg-slate-50 p-2.5">
                <p className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span className="grid size-6 place-items-center rounded-full bg-[#1d4ed8]/10 text-[10px] font-black text-[#1d4ed8]">
                      {(review.user?.fullName ?? "K").charAt(0).toUpperCase()}
                    </span>
                    {review.user?.fullName ?? "Du khách"}
                  </span>
                  <Stars value={review.score} />
                </p>
                {review.review ? (
                  <p className="mt-1 line-clamp-3 text-[13px] text-slate-600">{review.review}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                {count} đánh giá — mở trang điểm đến để xem tất cả.
              </p>
            )}
            {dest ? (
              <Link
                href={`/destinations/${dest.slug}`}
                className="mt-1 inline-block text-xs font-bold text-[#1d4ed8] hover:underline"
              >
                Xem trang điểm đến →
              </Link>
            ) : null}
          </div>
        ) : null}

        {!editing ? (
          <div>
            <p className="text-[13px] font-bold text-slate-900">Gợi ý thay thế (AI)</p>
            <ul className="mt-1.5 space-y-1.5">
              {alternatives.length === 0 ? (
                <li className="rounded-xl bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                  Liên kết điểm đến để nhận gợi ý lân cận.
                </li>
              ) : (
                alternatives.slice(0, 3).map(({ d, km, avg: a, count: c }) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-1.5">
                    {d.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.images[0]} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                        <MapPin className="size-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-800">{d.name}</span>
                      <span className="block text-[11px] text-slate-400">Khoảng cách: {fmtKm(km)}</span>
                      <Stars value={a} count={c} className="text-[11px]" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuickAdd(d)}
                      title="Thêm vào sau hoạt động này"
                      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#1d4ed8]/30 px-2 py-1.5 text-[11px] font-bold text-[#1d4ed8] transition hover:bg-[#1d4ed8]/5"
                    >
                      <Plus className="size-3" />
                      Thêm nhanh
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {!editing ? (
        <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50"
          >
            <Pencil className="size-3.5" />
            Chỉnh sửa
          </button>
          <button
            type="button"
            onClick={() => alternatives[0] && onReplace(alternatives[0].d)}
            disabled={!alternatives.length}
            className="flex items-center justify-center gap-1 rounded-xl border border-[#1d4ed8]/30 py-2 text-[13px] font-bold text-[#1d4ed8] transition hover:bg-[#1d4ed8]/5 disabled:opacity-40"
          >
            <RefreshCw className="size-3.5" />
            Thay thế
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 py-2 text-[13px] font-bold text-rose-500 transition hover:bg-rose-50"
          >
            <Trash2 className="size-3.5" />
            Xóa
          </button>
        </div>
      ) : null}
    </aside>
  );
}
