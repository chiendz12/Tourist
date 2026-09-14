"use client";

import * as React from "react";
import { ArrowLeftRight, Loader2, LocateFixed, Navigation, Search, X } from "lucide-react";
import { mapboxApi } from "@/lib/api/services";
import type { Destination } from "@/lib/api/types";
import { NEXT_PUBLIC_MAPBOX_TOKEN } from "@/lib/env";
import { classNames } from "@/lib/utils";

export interface DirPoint {
  lng: number;
  lat: number;
  label: string;
}

export interface FetchedRoute {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number | null;
}

/**
 * Road route between two points: backend directions first (server token),
 * direct Mapbox call with the public token as fallback (e.g. signed-out).
 * Returns null when no road route exists.
 */
export async function fetchRoute(from: DirPoint, to: DirPoint): Promise<FetchedRoute | null> {
  const coords = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];
  try {
    const body = await mapboxApi.directions(from, to);
    const r = body.routes?.[0];
    if (r?.geometry?.coordinates?.length) {
      return {
        coordinates: r.geometry.coordinates,
        distanceM: Number(r.distance),
        durationS: Number.isFinite(Number(r.duration)) ? Math.round(Number(r.duration)) : null,
      };
    }
  } catch {
    /* fall through to direct call */
  }
  if (!NEXT_PUBLIC_MAPBOX_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords
        .map(([lng, lat]) => `${lng},${lat}`)
        .join(";")}?geometries=geojson&overview=full&access_token=${encodeURIComponent(
        NEXT_PUBLIC_MAPBOX_TOKEN,
      )}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }>;
    };
    const r = body.routes?.[0];
    if (!r?.geometry?.coordinates?.length) return null;
    return {
      coordinates: r.geometry.coordinates,
      distanceM: Number(r.distance),
      durationS: Number.isFinite(Number(r.duration)) ? Math.round(Number(r.duration)) : null,
    };
  } catch {
    return null;
  }
}

export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDuration(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "—";
  const min = Math.round(s / 60);
  if (min < 60) return `${Math.max(min, 1)} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

interface DirectionsPanelProps {
  from: DirPoint | null;
  to: DirPoint | null;
  onFrom: (p: DirPoint | null) => void;
  onTo: (p: DirPoint | null) => void;
  onSwap: () => void;
  onClose: () => void;
  /** Marker candidates for the pickers (visible destinations). */
  candidates: Destination[];
  userPosition: { lng: number; lat: number } | null;
  loading: boolean;
  route: FetchedRoute | null;
  settled: boolean;
}

/**
 * Floating directions card: origin/destination pickers (own location +
 * marker search), swap, and the road-route summary. The route itself is
 * drawn by DirectionsLine.
 */
export function DirectionsPanel({
  from,
  to,
  onFrom,
  onTo,
  onSwap,
  onClose,
  candidates,
  userPosition,
  loading,
  route,
  settled,
}: DirectionsPanelProps) {
  return (
    <div className="absolute left-3 top-[72px] z-20 w-[min(92vw,360px)] rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-slate-900/10 backdrop-blur md:left-4">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#1d4ed8]/10 text-[#1d4ed8]">
          <Navigation className="size-4" />
        </span>
        <p className="flex-1 text-sm font-black text-slate-900">Chỉ đường trên bản đồ</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chỉ đường"
          className="grid size-7 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-2.5 flex items-stretch gap-1.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <PointPicker
            accent="green"
            placeholder="Điểm đi — tìm địa điểm…"
            value={from}
            onChange={onFrom}
            candidates={candidates}
            userPosition={userPosition}
          />
          <PointPicker
            accent="red"
            placeholder="Điểm đến — tìm địa điểm…"
            value={to}
            onChange={onTo}
            candidates={candidates}
            userPosition={userPosition}
          />
        </div>
        <button
          type="button"
          onClick={onSwap}
          disabled={!from && !to}
          aria-label="Đổi chiều"
          title="Đổi chiều"
          className="grid w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        >
          <ArrowLeftRight className="size-4" />
        </button>
      </div>

      <div className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
        {loading ? (
          <p className="flex items-center gap-2 font-semibold text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Đang tìm đường…
          </p>
        ) : route ? (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <strong className="text-base font-black tabular-nums text-slate-900">
              {formatDistance(route.distanceM)}
            </strong>
            <span className="font-semibold text-slate-500">{formatDuration(route.durationS)} lái xe</span>
          </p>
        ) : settled ? (
          <p className="font-semibold text-rose-600">Không tìm được đường đi cho 2 điểm này.</p>
        ) : (
          <p className="font-medium text-slate-400">Chọn điểm đi và điểm đến để xem đường đi.</p>
        )}
      </div>
    </div>
  );
}

function PointPicker({
  accent,
  placeholder,
  value,
  onChange,
  candidates,
  userPosition,
}: {
  accent: "green" | "red";
  placeholder: string;
  value: DirPoint | null;
  onChange: (p: DirPoint | null) => void;
  candidates: Destination[];
  userPosition: { lng: number; lat: number } | null;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open ]);

  const needle = q.trim().toLowerCase();
  const matches = React.useMemo(() => {
    if (!needle) return candidates.slice(0, 6);
    return candidates.filter((d) => `${d.name} ${d.address ?? ""}`.toLowerCase().includes(needle)).slice(0, 6);
  }, [candidates, needle]);

  const dot = accent === "green" ? "bg-emerald-500" : "bg-rose-500";

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 focus-within:border-[#1d4ed8]">
        <span className={classNames("size-2.5 shrink-0 rounded-full", dot)} />
        {value ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="min-w-0 flex-1 truncate text-left text-[13px] font-bold text-slate-800"
            title={value.label}
          >
            {value.label}
          </button>
        ) : (
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="h-6 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400"
          />
        )}
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            aria-label="Xóa điểm"
            className="grid size-6 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <Search className="size-3.5 shrink-0 text-slate-400" />
        )}
      </div>
      {open ? (
        <div className="absolute inset-x-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
          {userPosition ? (
            <button
              type="button"
              onClick={() => {
                onChange({ ...userPosition, label: "Vị trí của tôi" });
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-bold text-[#1d4ed8] hover:bg-slate-50"
            >
              <LocateFixed className="size-4 shrink-0" />
              Vị trí của tôi
            </button>
          ) : null}
          {matches.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                onChange({ lng: d.lng, lat: d.lat, label: d.name });
                setOpen(false);
                setQ("");
              }}
              className="block w-full truncate px-3 py-2 text-left text-[13px] hover:bg-slate-50"
            >
              <span className="block truncate font-bold text-slate-800">{d.name}</span>
              {d.address ? <span className="block truncate text-xs text-slate-400">{d.address}</span> : null}
            </button>
          ))}
          {!userPosition && matches.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-400">Không có địa điểm khớp.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
