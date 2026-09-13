import { BedDouble, CarFront, MapPin, Sparkles, UtensilsCrossed } from "lucide-react";
import type { ItinerarySummary } from "@/lib/api/types";
import { formatVnd } from "@/lib/utils";

export type ActivityKind = "destination" | "transport" | "food" | "stay" | "activity";

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  destinationId?: string;
  lng?: number;
  lat?: number;
  start: string;
  end: string;
  cost: number;
  note: string;
  distanceKm?: number;
}

export interface DayPlan {
  key: string;
  activities: Activity[];
}

export const KIND_META: Record<
  ActivityKind,
  { label: string; plural: string; color: string; bg: string; icon: typeof MapPin }
> = {
  destination: { label: "Điểm đến", plural: "Vé tham quan", color: "#1d4ed8", bg: "#eff4ff", icon: MapPin },
  transport: { label: "Di chuyển", plural: "Di chuyển", color: "#475569", bg: "#f1f5f9", icon: CarFront },
  food: { label: "Ăn uống", plural: "Ăn uống", color: "#ea580c", bg: "#fff4ec", icon: UtensilsCrossed },
  stay: { label: "Nghỉ ngơi", plural: "Lưu trú", color: "#7c3aed", bg: "#f5efff", icon: BedDouble },
  activity: { label: "Hoạt động", plural: "Hoạt động khác", color: "#db2777", bg: "#fdf0f6", icon: Sparkles },
};

export const DONUT_COLORS: Record<string, string> = {
  "Di chuyển": "#3b82f6",
  "Lưu trú": "#1e3a8a",
  "Ăn uống": "#f97316",
  "Vé tham quan": "#8b5cf6",
  "Hoạt động khác": "#ec4899",
};

export function newActivity(kind: ActivityKind, title = ""): Activity {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, kind, title, start: "08:00", end: "09:00", cost: 0, note: "" };
}

export function newDay(): DayPlan {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, activities: [] };
}

export function haversineKm(
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

export function fmtKm(km: number): string {
  return km >= 100 ? `${Math.round(km).toLocaleString("vi-VN")} km` : `${km.toFixed(1)} km`;
}

export function fmtHours(hours: number): string {
  if (hours <= 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Straightforward sums: every cost is a plain trip cost as entered. */
export function dayCost(day: DayPlan): number {
  return day.activities.reduce((s, a) => s + (Number(a.cost) || 0), 0);
}

export function tripCost(days: DayPlan[]): number {
  return days.reduce((s, d) => s + dayCost(d), 0);
}

/** Sum of haversine legs between consecutive geocoded activities. */
export function tripDistanceKm(days: DayPlan[]): number {
  let total = 0;
  for (const day of days) {
    const pts = day.activities.filter(
      (a): a is Activity & { lng: number; lat: number } =>
        Number.isFinite(a.lng) && Number.isFinite(a.lat),
    );
    for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1], pts[i]);
  }
  return total;
}

/** Distance label for a day header (first→last stop). */
export function dayDistanceKm(day: DayPlan): number {
  const pts = day.activities.filter(
    (a): a is Activity & { lng: number; lat: number } =>
      Number.isFinite(a.lng) && Number.isFinite(a.lat),
  );
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1], pts[i]);
  return total;
}

export function costByCategory(days: DayPlan[]): Array<{ label: string; value: number }> {
  const map = new Map<string, number>();
  for (const day of days)
    for (const a of day.activities) {
      const label = KIND_META[a.kind].plural;
      map.set(label, (map.get(label) ?? 0) + (Number(a.cost) || 0));
    }
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

/** Serialize days back to the itinerary payload (keeps legacy stop ids). */
export function toPayload(days: DayPlan[], travelers: number) {
  return {
    travelers,
    days: days.map((d, i) => ({
      day: i + 1,
      stops: d.activities.map((a) => a.destinationId).filter((id): id is string => !!id),
      activities: d.activities,
    })),
  };
}

/** Comparable timestamp for a trip (updatedAt may be absent on old rows). */
export function tripTimeMs(t: { updatedAt?: string; createdAt: string }): number {
  const raw = t.updatedAt ?? t.createdAt;
  const ms = Date.parse(raw ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

/** Display date for a trip, never "Invalid Date". */
export function formatTripDate(t: { updatedAt?: string; createdAt: string }): string {
  const raw = t.updatedAt ?? t.createdAt;
  const ms = Date.parse(raw ?? "");
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString("vi-VN") : "—";
}

/** First linked destination across legacy stops and activity links. */
export function firstStopId(days: Array<{ stops?: string[]; activities?: Array<{ destinationId?: string }> }>): string | undefined {
  for (const d of days) {
    const legacy = d.stops?.find(Boolean);
    if (legacy) return legacy;
    const linked = d.activities?.map((a) => a.destinationId).find(Boolean);
    if (linked) return linked;
  }
  return undefined;
}

/** Legacy payloads ({days:[{stops:[ids]}]}) become destination activities. */
export function migratePayload(trip: ItinerarySummary | null): { days: DayPlan[]; travelers: number } {
  const raw = trip?.payload as
    | { days?: Array<{ stops?: string[]; activities?: Activity[] }>; travelers?: number }
    | null
    | undefined;
  if (!raw?.days?.length) return { days: [newDay()], travelers: raw?.travelers ?? 2 };
  return {
    travelers: raw.travelers ?? 2,
    days: raw.days.map((d) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      activities: Array.isArray(d.activities) && d.activities.length
        ? d.activities.map((a) => ({
            id: a.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            kind: a.kind ?? "destination",
            title: a.title ?? "",
            destinationId: a.destinationId,
            lng: a.lng,
            lat: a.lat,
            start: a.start ?? "08:00",
            end: a.end ?? "09:00",
            cost: Number(a.cost) || 0,
            note: a.note ?? "",
            distanceKm: a.distanceKm,
          }))
        : (d.stops ?? []).map(
            (id): Activity => ({
              id: `${Date.now()}-${id.slice(0, 6)}`,
              kind: "destination",
              title: "",
              destinationId: id,
              start: "08:00",
              end: "09:00",
              cost: 0,
              note: "",
            }),
          ),
    })),
  };
}

const DRAFT_PREFIX = "vj-itinerary-draft:";
const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000;

export interface StoredDraft {
  at: number;
  name: string;
  travelers: number;
  days: DayPlan[];
}

function draftKey(id: string | null): string {
  return `${DRAFT_PREFIX}${id ?? "new"}`;
}

function isStoredDraft(v: unknown): v is StoredDraft {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.at === "number" &&
    typeof d.name === "string" &&
    Array.isArray(d.days) &&
    d.days.every(
      (day) =>
        day &&
        typeof day === "object" &&
        Array.isArray((day as { activities?: unknown }).activities),
    )
  );
}

/** Read a locally cached draft (client only, expiry-checked). */
export function readDraft(id: string | null): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredDraft(parsed)) return null;
    if (Date.now() - parsed.at > DRAFT_TTL_MS) {
      window.localStorage.removeItem(draftKey(id));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Persist a draft synchronously (cheap JSON, safe to call on each edit). */
export function writeDraft(id: string | null, draft: StoredDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(id), JSON.stringify(draft));
  } catch {
    /* storage full or unavailable */
  }
}

export function clearDraft(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(id));
  } catch {
    /* ignore */
  }
}

export function exportCsv(name: string, days: DayPlan[]): void {
  const rows = [["Ngày", "Bắt đầu", "Kết thúc", "Hoạt động", "Loại", "Chi phí (VND)", "Ghi chú"]];
  days.forEach((d, i) =>
    d.activities.forEach((a) =>
      rows.push([
        `Ngày ${i + 1}`,
        a.start,
        a.end,
        a.title,
        KIND_META[a.kind].label,
        String(a.cost || 0),
        (a.note ?? "").replace(/\n/g, " "),
      ]),
    ),
  );
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `${name || "lo-trinh"}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

export { formatVnd };
