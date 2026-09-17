"use client";

import * as React from "react";
import { ArrowLeftRight, Loader2, LocateFixed, Navigation, Search, X } from "lucide-react";
import { mapboxApi } from "@/lib/api/services";
import type { Destination } from "@/lib/api/types";
import { NEXT_PUBLIC_MAPBOX_TOKEN } from "@/lib/env";
import { searchPlaces, type PlaceResult } from "@/lib/mapbox-geocode";
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
  /** Ordered road names the route passes through (deduped). */
  roads: string[];
}

interface RawStep {
  name?: string;
}

interface RawLeg {
  steps?: RawStep[];
}

interface RawRoute {
  geometry?: { coordinates?: [number, number][] };
  distance?: number;
  duration?: number;
  legs?: RawLeg[];
}

/** Ordered road names from legs/steps, consecutive duplicates removed. */
function roadNames(r: RawRoute): string[] {
  const out: string[] = [];
  for (const leg of r.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const name = step.name?.trim();
      if (!name) continue;
      if (out.length === 0 || out[out.length - 1] !== name) out.push(name);
    }
  }
  return out;
}

function toFetched(r: RawRoute): FetchedRoute | null {
  if (!r?.geometry?.coordinates?.length) return null;
  return {
    coordinates: r.geometry.coordinates,
    distanceM: Number(r.distance),
    durationS: Number.isFinite(Number(r.duration)) ? Math.round(Number(r.duration)) : null,
    roads: roadNames(r),
  };
}

/**
 * Road routes between two points: backend directions first (server token),
 * direct Mapbox call with the public token as fallback (e.g. signed-out).
 * Returns all alternative routes (best first), or null when none exists.
 */
export async function fetchRoute(from: DirPoint, to: DirPoint): Promise<FetchedRoute[] | null> {
  const coords = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];
  try {
    const body = await mapboxApi.directions(from, to);
    const routes = (body.routes ?? []).map(toFetched).filter((r): r is FetchedRoute => r != null);
    if (routes.length) return routes;
  } catch {
    /* fall through to direct call */
  }
  if (!NEXT_PUBLIC_MAPBOX_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords
        .map(([lng, lat]) => `${lng},${lat}`)
        .join(";")}?geometries=geojson&overview=full&alternatives=true&steps=true&access_token=${encodeURIComponent(
        NEXT_PUBLIC_MAPBOX_TOKEN,
      )}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { routes?: RawRoute[] };
    const routes = (body.routes ?? []).map(toFetched).filter((r): r is FetchedRoute => r != null);
    return routes.length ? routes : null;
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
  /** All alternative routes (best first). */
  routes: FetchedRoute[];
  /** Index of the selected route. */
  choice: number;
  onChoice: (index: number) => void;
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
  routes,
  choice,
  onChoice,
  settled,
}: DirectionsPanelProps) {
  const selected = routes[Math.min(choice, Math.max(routes.length - 1, 0))] ?? null;
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
        ) : selected ? (
          <div>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <strong className="text-base font-black tabular-nums text-slate-900">
                {formatDistance(selected.distanceM)}
              </strong>
              <span className="font-semibold text-slate-500">{formatDuration(selected.durationS)} lái xe</span>
            </p>
            {selected.roads.length ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                <span className="font-bold text-slate-600">Đi qua: </span>
                {selected.roads.join(" → ")}
              </p>
            ) : null}
            {routes.length > 1 ? (
              <ul className="mt-1.5 space-y-1">
                {routes.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onChoice(i)}
                      aria-pressed={i === Math.min(choice, routes.length - 1)}
                      className={classNames(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition",
                        i === Math.min(choice, routes.length - 1)
                          ? "bg-[#1d4ed8]/10 font-bold text-[#1d4ed8]"
                          : "font-medium text-slate-600 hover:bg-slate-100",
                      )}
                    >
                      <span
                        className={classNames(
                          "size-2 shrink-0 rounded-full",
                          i === 0 ? "bg-emerald-500" : "bg-slate-300",
                        )}
                      />
                      <span className="flex-1">
                        {i === 0 ? "Tuyến tốt nhất" : `Tuyến thay thế ${i}`}
                      </span>
                      <span className="font-bold tabular-nums">{formatDistance(r.distanceM)}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {formatDuration(r.durationS)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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
  const [ext, setExt] = React.useState<PlaceResult[]>([]);
  const [pending, setPending] = React.useState(false);
  const seqRef = React.useRef(0);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  const needle = q.trim();

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open ]);

  // Debounced external search (DB + OSM + Mapbox fan-out): the curated
  // `candidates` alone miss real-world places like "Học viện Tài chính".
  // State only changes inside async callbacks, never synchronously here.
  React.useEffect(() => {
    if (needle.length < 2) return;
    const seq = ++seqRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const r = await searchPlaces(needle);
        if (seqRef.current === seq) setExt(r);
      } catch {
        /* keep previous results */
      } finally {
        if (seqRef.current === seq) setPending(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [needle]);

  const searching = pending && needle.length >= 2;
  const lowered = needle.toLowerCase();
  const local = React.useMemo(() => {
    if (!lowered) return candidates.slice(0, 6);
    return candidates.filter((d) => `${d.name} ${d.address ?? ""}`.toLowerCase().includes(lowered)).slice(0, 6);
  }, [candidates, lowered]);

  // Local curated hits first, then external results not duplicating them.
  const matches = React.useMemo(() => {
    const seen = new Set(
      local.map((d) => `${d.name.toLowerCase()}|${d.lng.toFixed(3)},${d.lat.toFixed(3)}`),
    );    const out: Array<{ key: string; label: string; sub: string; point: DirPoint }> = local.map((d) => ({
      key: d.id,
      label: d.name,
      sub: d.address || `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`,
      point: { lng: d.lng, lat: d.lat, label: d.name },
    }));
    const external = needle.length >= 2 ? ext : [];
    for (const p of external) {
      const key = `${p.name.toLowerCase()}|${p.lng.toFixed(3)},${p.lat.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key: p.id,
        label: p.name,
        sub: p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
        point: { lng: p.lng, lat: p.lat, label: p.name },
      });
      if (out.length >= 10) break;
    }
    return out;
  }, [local, ext, needle]);

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
              setPending(e.target.value.trim().length >= 2);
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
          {matches.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                onChange(m.point);
                setOpen(false);
                setQ("");
              }}
              className="block w-full truncate px-3 py-2 text-left text-[13px] hover:bg-slate-50"
            >
              <span className="block truncate font-bold text-slate-800">{m.label}</span>
              <span className="block truncate text-xs tabular-nums text-slate-400">{m.sub}</span>
            </button>
          ))}
          {searching ? (
            <p className="px-3 py-2 text-xs text-slate-400">Đang tìm địa điểm…</p>
          ) : !userPosition && matches.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-400">Không có địa điểm khớp.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
