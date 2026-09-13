"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Plus, X } from "lucide-react";
import type { Destination, Province } from "@/lib/api/types";

interface TrayProps {
  stops: Destination[];
  provinces: Province[];
  onRemove: (id: string) => void;
  onAddMore: () => void;
}

/**
 * Bottom itinerary tray: label block, stop cards, dashed add card and
 * the full-builder button, per the Figma map screen.
 */
export function Tray({ stops, provinces, onRemove, onAddMore }: TrayProps) {
  if (!stops.length) return null;
  const provinceOf = (d: Destination) =>
    provinces.find((p) => p.id === d.provinceId)?.name ??
    d.address ??
    "VietJourney";
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 p-3 sm:px-4 sm:pb-4">
      <div className="mx-auto flex max-w-6xl items-stretch gap-2.5 overflow-x-auto rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-slate-900/5 backdrop-blur">
        <div className="flex w-36 shrink-0 flex-col justify-center px-1">
          <p className="text-[13px] font-bold leading-tight text-slate-900">
            Lộ trình của bạn hôm nay
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{stops.length} điểm đến</p>
        </div>
        {stops.map((s) => (
          <div
            key={s.id}
            className="relative flex w-52 shrink-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2"
          >
            {s.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.images[0]}
                alt=""
                className="size-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                <MapPin className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-slate-800">
                {s.name}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {provinceOf(s)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              aria-label={`Xóa ${s.name}`}
              className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-white text-slate-400 shadow ring-1 ring-slate-200 transition hover:text-slate-700"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddMore}
          className="flex w-36 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-[#1d4ed8] transition hover:border-[#1d4ed8]/50 hover:bg-[#1d4ed8]/5"
        >
          <Plus className="size-4" />
          Thêm điểm đến
        </button>
        <Link
          href="/itinerary/new"
          className="flex w-48 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-4 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        >
          Mở đầy đủ lộ trình
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
