"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Loader2,
  Map as MapIcon,
  Pencil,
  Plane,
  Road,
  Save,
  Share2,
  Star,
  Wallet,
  X,
} from "lucide-react";
import {
  destinationsApi,
  itinerariesApi,
  ratingsApi,
  toursApi,
} from "@/lib/api/services";
import type { Destination, ItinerarySummary, Rating } from "@/lib/api/types";
import { MAP_DEFAULTS } from "@/lib/env";
import { classNames } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/session";
import { MapView } from "@/components/map/map-view";
import { ClickMarker } from "@/components/map/click-marker";
import { MapLayers } from "@/components/map/map-layers";
import { RouteLines } from "@/components/map/route-lines";
import { Timeline, type ResolvedDest } from "@/components/itinerary/timeline";
import { ActivityPanel, type Alternative } from "@/components/itinerary/activity-panel";
import {
  clearDraft,
  exportCsv,
  fmtHours,
  fmtKm,
  formatVnd,
  haversineKm,
  migratePayload,
  newActivity,
  newDay,
  readDraft,
  toPayload,
  tripCost,
  tripDistanceKm,
  tripTimeMs,
  writeDraft,
  type Activity,
  type DayPlan,
} from "@/components/itinerary/types";

type SaveState = "idle" | "saving" | "saved" | "error";

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯđ]/g, (c) => (c === "đ" ? "d" : "")).replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Figma itinerary builder: title bar, stat strip, day timeline, live map
 * with route line, AI suggestions and the activity detail panel.
 */
export function ItineraryBuilder({
  initialTrip,
  requestedId = null,
}: {
  initialTrip: ItinerarySummary | null;
  /** ?id= from the URL, even when the server record no longer exists. */
  requestedId?: string | null;
}) {
  const router = useRouter();
  const { user } = useSession();
  const { toast } = useToast();

  const [name, setName] = React.useState(initialTrip?.name ?? "Chuyến đi mới");
  const [tripId, setTripId] = React.useState<string | null>(initialTrip?.id ?? null);
  const init = React.useMemo(() => migratePayload(initialTrip), [initialTrip]);
  const [days, setDays] = React.useState<DayPlan[]>(init.days);
  const [travelers, setTravelers] = React.useState(init.travelers);
  const [activeDay, setActiveDay] = React.useState<number | "overview">(0);
  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set());
  const [selected, setSelected] = React.useState<{ dayIdx: number; id: string } | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [dirty, setDirty] = React.useState(false);
  const [style, setStyle] = React.useState<"light" | "satellite">("light");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [destCache, setDestCache] = React.useState<Map<string, Destination>>(new Map());
  const [ratingCache, setRatingCache] = React.useState<Map<string, { avg: number; count: number }>>(new Map());

  const markDirty = () => {
    setDirty(true);
  };

  // Enrich linked destinations (names, coords, images) for display + map.
  const linkedIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const d of days) for (const a of d.activities) if (a.destinationId) ids.add(a.destinationId);
    return [...ids];
  }, [days]);

  React.useEffect(() => {
    const missing = linkedIds.filter((id) => !destCache.has(id)).slice(0, 24);
    if (!missing.length) return;
    // Cache fill on new links: the effect's whole job is fetching.
    void (async () => {
      const results = await Promise.allSettled(missing.map((id) => destinationsApi.get(id).catch(() => null)));
      setDestCache((prev) => {
        const next = new Map(prev);
        missing.forEach((id, i) => {
          if (results[i].status === "fulfilled" && results[i].value) next.set(id, results[i].value);
        });
        return next;
      });
      const ratings = await Promise.allSettled(missing.map((id) => ratingsApi.forDestination(id).catch(() => [])));
      setRatingCache((prev) => {
        const next = new Map(prev);
        missing.forEach((id, i) => {
          if (ratings[i].status !== "fulfilled") return;
          const r = ratings[i].value;
          if (r.length) next.set(id, { avg: r.reduce((s, x) => s + x.score, 0) / r.length, count: r.length });
        });
        return next;
      });
    })();
  }, [linkedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveDest = React.useCallback(
    (id?: string): ResolvedDest | undefined => {
      if (!id) return undefined;
      const d = destCache.get(id);
      return d ? { name: d.name, image: d.images?.[0], address: d.address ?? undefined } : undefined;
    },
    [destCache],
  );

  // Restore an unsaved local draft newer than the server copy (reload
  // safety). Once per component lifetime; later parent refetches (e.g.
  // after the URL gains ?id=) must not re-apply stale drafts. Falls back
  // to the requested id so drafts survive even if the server record is
  // gone (DB reset, reseed) while ?id= is still in the URL.
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const id = initialTrip?.id ?? requestedId ?? null;
    const draft = readDraft(id);
    if (!draft) return;
    const hasContent =
      draft.name.trim() !== "" ||
      draft.days.some((d) => d.activities.length > 0);
    if (!hasContent && !initialTrip) return;
    const serverTime = initialTrip ? tripTimeMs(initialTrip) : 0;
    if (!initialTrip || draft.at > serverTime) {
      // Mount-restore is the sanctioned exception: it runs once and only
      // replays state the server hasn't seen yet.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDays(draft.days);
      setName(draft.name);
      setTravelers(draft.travelers ?? 2);
      // Push the restored draft to the server on the next autosave tick.
      markDirty();
      toast({ title: "Đã khôi phục bản nháp", description: "Các thay đổi chưa kịp lưu đã được lấy lại.", variant: "info" });
    }
  }, [initialTrip, requestedId, toast]);

  // Instant local backup on every edit: even a reload before the debounced
  // server save loses nothing. No setState here, just storage.
  React.useEffect(() => {
    writeDraft(tripId, { at: Date.now(), name, travelers, days });
  }, [days, name, travelers, tripId]);

  // Manual-only persist: the server is touched solely through the Lưu
  // button (or Publish, which flushes first). Reload safety comes from the
  // instant localStorage drafts, never from background requests.
  const lastSaveError = React.useRef(false);
  const saveNow = React.useCallback(
    async (announce = false): Promise<{ ok: boolean; id: string | null }> => {
      try {
        const payload = toPayload(days, travelers);
        let id = tripId;
        if (id) {
          // NOTE: the per-id local draft is deliberately kept — the
          // timestamp comparison arbitrates on reload, so a later
          // server-side data loss can still be recovered from.
          await itinerariesApi.update(id, { name, payload });
        } else {
          const created = (await itinerariesApi.create({ name, payload })) as { id: string };
          clearDraft(null);
          if (requestedId) clearDraft(requestedId);
          setTripId(created.id);
          id = created.id;
          // Give the trip a URL so every future reload loads from server.
          router.replace(`/itinerary/new?id=${created.id}`);
        }
        setDirty(false);
        setSaveState("saved");
        lastSaveError.current = false;
        if (announce) {
          toast({ title: "Đã lưu chuyến đi", description: "Mọi thay đổi đã được lưu.", variant: "success" });
        }
        return { ok: true, id };
      } catch (e) {
        setSaveState("error");
        // Loud failure: a silent pill is how data loss goes unnoticed.
        // Toast once per failure streak, not on every retry.
        if (!lastSaveError.current) {
          lastSaveError.current = true;
          toast({
            title: "Lưu thất bại",
            description:
              e instanceof Error ? e.message : "Kiểm tra mạng và đăng nhập rồi thử lại.",
            variant: "error",
          });
        }
        return { ok: false, id: tripId };
      }
    },
    [days, name, travelers, tripId, router, toast, requestedId],
  );

  // Unsaved-but-meaningful content gates the Lưu button so blank visits can
  // never mint junk "Chuyến đi mới" rows on the server: a custom name or at
  // least one activity is required for brand-new trips.
  const hasContent =
    days.some((d) => d.activities.length > 0) ||
    (name.trim() !== "" && name.trim() !== "Chuyến đi mới");
  const saveStatus: "saving" | "error" | "unsaved" | "saved" | "pristine" =
    saveState === "saving"
      ? "saving"
      : saveState === "error"
        ? "error"
        : dirty
          ? "unsaved"
          : tripId != null
            ? "saved"
            : "pristine";
  const canSave =
    (saveStatus === "unsaved" || saveStatus === "error") &&
    (tripId != null || hasContent);

  const patchDays = (fn: (prev: DayPlan[]) => DayPlan[]) => {
    setDays((prev) => fn(prev));
    markDirty();
  };

  const selectedActivity: (Activity & { dayIdx: number }) | null = React.useMemo(() => {
    if (!selected) return null;
    const a = days[selected.dayIdx]?.activities.find((x) => x.id === selected.id);
    return a ? { ...a, dayIdx: selected.dayIdx } : null;
  }, [days, selected]);

  const selectActivity = (dayIdx: number, id: string) => {
    setSelected({ dayIdx, id });
    setPanelOpen(true);
  };

  const patchSelected = (patch: Partial<Activity>) => {
    if (!selected) return;
    patchDays((prev) =>
      prev.map((d, i) =>
        i === selected.dayIdx
          ? { ...d, activities: d.activities.map((a) => (a.id === selected.id ? { ...a, ...patch } : a)) }
          : d,
      ),
    );
  };

  const deleteSelected = () => {
    if (!selected) return;
    patchDays((prev) =>
      prev.map((d, i) =>
        i === selected.dayIdx ? { ...d, activities: d.activities.filter((a) => a.id !== selected.id) } : d,
      ),
    );
    setSelected(null);
    setPanelOpen(false);
  };

  const replaceSelected = (dest: Destination) => {
    if (!selected) return;
    setDestCache((prev) => new Map(prev).set(dest.id, dest));
    patchSelected({ destinationId: dest.id, title: dest.name, lng: dest.lng, lat: dest.lat });
    toast({ title: "Đã thay thế", description: `Hoạt động mới: ${dest.name}`, variant: "success" });
  };

  const quickAddAfter = (dest: Destination, afterId?: string) => {
    setDestCache((prev) => new Map(prev).set(dest.id, dest));
    const activity: Activity = {
      ...newActivity("destination", dest.name),
      destinationId: dest.id,
      lng: dest.lng,
      lat: dest.lat,
      start: selectedActivity?.end ?? "08:00",
      end: selectedActivity?.end ?? "09:00",
    };
    const dayIdx = selected?.dayIdx ?? (typeof activeDay === "number" ? activeDay : 0);
    patchDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIdx) return d;
        const at = afterId ? d.activities.findIndex((a) => a.id === afterId) : -1;
        const next = [...d.activities];
        next.splice(at >= 0 ? at + 1 : next.length, 0, activity);
        return { ...d, activities: next };
      }),
    );
    setSelected({ dayIdx, id: activity.id });
    setPanelOpen(true);
  };

  // Map stops: activities with coordinates (own or resolved).
  const stops = React.useMemo(() => {
    const out: Array<Destination & { __activityId: string }> = [];
    days.forEach((d) =>
      d.activities.forEach((a) => {
        const linked = a.destinationId ? destCache.get(a.destinationId) : undefined;
        const lng = a.lng ?? linked?.lng;
        const lat = a.lat ?? linked?.lat;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        out.push({
          id: a.id,
          name: a.title || linked?.name || "Hoạt động",
          slug: a.id,
          category: "OTHER",
          images: linked?.images?.slice(0, 1) ?? [],
          status: "PUBLISHED",
          createdById: "builder",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lng: lng!,
          lat: lat!,
          location: { type: "Point", coordinates: [lng!, lat!] },
          __activityId: a.id,
        } as Destination & { __activityId: string });
      }),
    );
    return out;
  }, [days, destCache]);

  const routePath = React.useMemo(
    () =>
      stops.length >= 2
        ? [{ id: "builder-route", name, path: { type: "LineString", coordinates: stops.map((s) => [s.lng, s.lat] as [number, number]) }, status: "PUBLISHED", createdById: "", createdAt: "", updatedAt: "" } as never]
        : [],
    [stops, name],
  );

  const total = tripCost(days);
  const distKm = tripDistanceKm(
    days.map((d) => ({
      ...d,
      activities: d.activities.map((a) => {
        const linked = a.destinationId ? destCache.get(a.destinationId) : undefined;
        return { ...a, lng: a.lng ?? linked?.lng, lat: a.lat ?? linked?.lat };
      }),
    })),
  );
  const ratedStops = stops
    .map((s) => {
      const act = days.flatMap((d) => d.activities).find((a) => a.id === (s as { __activityId: string }).__activityId);
      const r = act?.destinationId ? ratingCache.get(act.destinationId) : undefined;
      return r;
    })
    .filter((r): r is { avg: number; count: number } => !!r);
  const expectedRating = ratedStops.length ? ratedStops.reduce((s, r) => s + r.avg, 0) / ratedStops.length : 0;
  const expectedCount = ratedStops.reduce((s, r) => s + r.count, 0);

  // AI suggestions: nearby the selected (or active day midpoint) stop.
  const suggestCenter = React.useMemo(() => {
    const act = selectedActivity;
    const linked = act?.destinationId ? destCache.get(act.destinationId) : undefined;
    const lng = act?.lng ?? linked?.lng;
    const lat = act?.lat ?? linked?.lat;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng: lng!, lat: lat! };
    const dayIdx = typeof activeDay === "number" ? activeDay : 0;
    const pts = (days[dayIdx]?.activities ?? [])
      .map((a) => {
        const l = a.destinationId ? destCache.get(a.destinationId) : undefined;
        return { lng: a.lng ?? l?.lng, lat: a.lat ?? l?.lat };
      })
      .filter((p): p is { lng: number; lat: number } => Number.isFinite(p.lng) && Number.isFinite(p.lat));
    if (!pts.length) return null;
    const mid = pts[Math.floor(pts.length / 2)];
    return mid;
  }, [selectedActivity, destCache, days, activeDay]);

  const nearby = useQuery({
    queryKey: ["destinations", "builder-ai", suggestCenter],
    queryFn: () =>
      suggestCenter
        ? destinationsApi.nearby({ lng: suggestCenter.lng, lat: suggestCenter.lat, radius: 60000, limit: 8 })
        : Promise.resolve([]),
    enabled: !!suggestCenter,
  });

  const alternatives: Alternative[] = React.useMemo(() => {
    const currentId = selectedActivity?.destinationId;
    return (nearby.data ?? [])
      .filter((d) => d.id !== currentId)
      .slice(0, 6)
      .map((d) => ({
        d,
        km: suggestCenter ? haversineKm(suggestCenter, { lng: d.lng, lat: d.lat }) : 0,
        avg: ratingCache.get(d.id)?.avg ?? 0,
        count: ratingCache.get(d.id)?.count ?? 0,
      }));
  }, [nearby.data, selectedActivity, suggestCenter, ratingCache]);

  const selectedDest: Destination | null = selectedActivity?.destinationId
    ? (destCache.get(selectedActivity.destinationId) ?? null)
    : null;
  const selectedRating = selectedActivity?.destinationId
    ? (ratingCache.get(selectedActivity.destinationId) ?? null)
    : null;
  const selectedRatings = useQuery({
    queryKey: ["ratings", "builder-selected", selectedActivity?.destinationId],
    queryFn: () =>
      selectedActivity?.destinationId
        ? ratingsApi.forDestination(selectedActivity.destinationId)
        : Promise.resolve([]),
    enabled: !!selectedActivity?.destinationId,
  });
  const selectedReview: Rating | null =
    (selectedRatings.data ?? []).find((r) => r.review?.trim()) ?? null;

  const publish = async () => {
    // Publishing is an explicit user action, so it flushes pending edits
    // first — never publishes stale content, never fires in the background.
    const saved = await saveNow();
    const id = saved.id;
    if (!saved.ok || !id) return;
    try {
      const created = (await toursApi.create({
        name,
        code: `${slugify(name) || "tour"}-${id.slice(0, 8)}`,
        description: `${days.length} ngày · ${stops.length} điểm đến`,
        days: Math.max(days.length, 1),
        basePrice: total,
        currency: "VND",
        paxCount: travelers,
      })) as { id: string };
      toast({ title: "Đã xuất bản", description: "Tour công khai đã được tạo.", variant: "success" });
      router.push(`/tours/${created.id}`);
    } catch (e) {
      toast({ title: "Xuất bản thất bại", description: e instanceof Error ? e.message : undefined, variant: "error" });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Đã sao chép liên kết", variant: "success" });
    } catch {
      /* clipboard unavailable */
    }
  };

  const dayIdx = typeof activeDay === "number" ? activeDay : 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100">
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link href="/me" className="flex shrink-0 items-center gap-1.5" aria-label="VietJourney">
          <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white">
            <MapIcon className="size-4" />
          </span>
          <span className="hidden text-base font-extrabold tracking-tight xl:block">
            <span className="text-slate-900">Viet</span>
            <span className="text-[#1d4ed8]">Journey</span>
          </span>
        </Link>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            markDirty();
          }}
          aria-label="Tên hành trình"
          className="h-9 min-w-40 flex-1 rounded-lg px-2 text-[15px] font-bold text-slate-900 outline-none hover:bg-slate-50 focus:bg-slate-50 focus:ring-1 focus:ring-[#1d4ed8]/30"
        />
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Đang lưu…
            </>
          ) : saveStatus === "saved" ? (
            <>
              <Check className="size-3.5 text-emerald-500" /> Đã lưu
            </>
          ) : saveStatus === "error" ? (
            <span className="text-rose-500">Lưu thất bại</span>
          ) : saveStatus === "unsaved" ? (
            <span className="text-amber-500">● Chưa lưu</span>
          ) : (
            <>
              <Check className="size-3.5 text-slate-300" /> Chưa lưu
            </>
          )}
        </span>
        <span className="hidden w-2 lg:block" />
        <button
          type="button"
          title={
            saveStatus === "error"
              ? "Lưu lại (lần trước thất bại)"
              : saveStatus === "unsaved"
                ? "Lưu chuyến đi ngay"
                : saveStatus === "saved"
                  ? "Mọi thay đổi đã được lưu — không có gì để lưu"
                  : "Thêm tên hoặc hoạt động trước khi lưu"
          }
          disabled={!canSave}
          onClick={() => {
            void saveNow(true);
          }}
          className={buttonClass({
            variant: "outline",
            size: "sm",
            className: saveStatus === "saved" ? "border-emerald-200 text-emerald-600" : undefined,
          })}
        >
          {saveStatus === "saving" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saveStatus === "saved" ? (
            <Check className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          {saveStatus === "saved" ? "Đã lưu" : "Lưu"}
        </button>
        <Link href="/map" className={buttonClass({ variant: "outline", size: "sm" })}>
          <MapIcon className="size-4" />
          Xem bản đồ
        </Link>
        <span className="relative">
          <button type="button" onClick={() => setExportOpen((v) => !v)} className={buttonClass({ variant: "outline", size: "sm" })}>
            <Download className="size-4" />
            Xuất
            <ChevronDown className="size-3.5" />
          </button>
          {exportOpen ? (
            <>
              <button type="button" aria-label="Đóng menu" onClick={() => setExportOpen(false)} className="fixed inset-0 z-10 cursor-default" />
              <span className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    exportCsv(name, days);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Tải CSV lịch trình
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    void copyLink();
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Sao chép liên kết
                </button>
              </span>
            </>
          ) : null}
        </span>
        <button type="button" onClick={publish} className={buttonClass({ size: "sm" })}>
          Xuất bản tour
        </button>
        <button type="button" onClick={copyLink} className={buttonClass({ variant: "outline", size: "sm" })}>
          <Share2 className="size-4" />
          Chia sẻ
        </button>
        <span className="grid size-9 place-items-center rounded-full bg-[#1d4ed8] text-sm font-bold text-white">
          {user?.fullName?.trim()?.charAt(0)?.toUpperCase() ?? "K"}
        </span>
      </div>

      {/* Stat strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-b border-slate-200 bg-white px-4 py-2.5 text-sm">
        <span className="flex items-center gap-1.5 text-slate-500">
          <CalendarDays className="size-4 text-[#1d4ed8]" />
          <strong className="text-slate-900">{days.length} ngày</strong>
        </span>
        <span className="hidden h-6 w-px bg-slate-200 sm:block" />
        <span className="flex items-center gap-1.5 text-slate-500">
          <Wallet className="size-4 text-[#1d4ed8]" />
          Tổng chi phí ước tính <strong className="text-slate-900">{formatVnd(total)}</strong>
        </span>
        <span className="hidden h-6 w-px bg-slate-200 sm:block" />
        <span className="flex items-center gap-1.5 text-slate-500">
          <Road className="size-4 text-[#1d4ed8]" />
          Tổng quãng đường <strong className="text-slate-900">{distKm > 0 ? fmtKm(distKm) : "—"}</strong>
        </span>
        <span className="hidden h-6 w-px bg-slate-200 sm:block" />
        <span className="flex items-center gap-1.5 text-slate-500">
          <Star className="size-4 fill-amber-400 text-amber-400" />
          Rating dự kiến{" "}
          <strong className="text-slate-900">
            {expectedRating ? `${expectedRating.toFixed(1)}/5` : "—"}
          </strong>
          <span className="text-xs">({expectedCount} đánh giá)</span>
        </span>
        <span className="ml-auto flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
          {saveState === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {saveStatus === "saving" ? (
            <span className="flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" />
              Đang lưu thay đổi…
            </span>
          ) : saveStatus === "error" ? (
            <span className="text-rose-600">Lưu thất bại — bấm Lưu để thử lại</span>
          ) : saveStatus === "unsaved" ? (
            <span className="text-amber-600">Có thay đổi chưa lưu</span>
          ) : (
            "Tất cả thay đổi đã được lưu"
          )}
        </span>
      </div>

      {/* 3 columns */}
      <div className="grid min-h-0 flex-1 gap-3 p-3 sm:p-4 lg:grid-cols-[440px_minmax(0,1fr)_330px]">
        <section className="flex min-h-0 flex-col overflow-hidden">
          <Timeline
            days={days}
            activeDay={activeDay}
            onActiveDay={setActiveDay}
            onAddDay={() => {
              patchDays((prev) => [...prev, newDay()]);
              setActiveDay(days.length);
            }}
            onRemoveDay={(idx) => {
              patchDays((prev) => prev.filter((_, i) => i !== idx));
              if (selected?.dayIdx === idx) {
                setSelected(null);
                setPanelOpen(false);
              } else if (selected && selected.dayIdx > idx) {
                setSelected({ ...selected, dayIdx: selected.dayIdx - 1 });
              }
              setActiveDay((prev) => {
                if (prev === "overview") return prev;
                if (prev === idx) return Math.max(idx - 1, 0);
                return prev > idx ? prev - 1 : prev;
              });
              setCollapsed((prev) => {
                const next = new Set<number>();
                prev.forEach((i) => {
                  if (i !== idx) next.add(i > idx ? i - 1 : i);
                });
                return next;
              });
            }}
            collapsed={collapsed}
            onToggleCollapse={(idx) =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                return next;
              })
            }
            selected={selected}
            onSelect={selectActivity}
            onAddActivity={(dayIdx, a) => {
              patchDays((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, activities: [...d.activities, a] } : d)));
              setSelected({ dayIdx, id: a.id });
              setPanelOpen(true);
            }}
            resolveDest={resolveDest}
          />
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="relative min-h-[380px] flex-1 overflow-hidden rounded-2xl bg-[#e8f1fd] ring-1 ring-slate-900/5">
            <MapView
              className="absolute inset-0"
              center={MAP_DEFAULTS.center}
              zoom={MAP_DEFAULTS.zoom}
              style={style === "satellite" ? "mapbox://styles/mapbox/satellite-v9" : undefined}
            >
              <ClickMarker />
              <MapLayers destinations={stops} onSelectId={(id) => {
                const found = days.flatMap((d, dayIdx) => d.activities.map((a) => ({ a, dayIdx }))).find((x) => x.a.id === id);
                if (found) selectActivity(found.dayIdx, found.a.id);
              }} />
              <RouteLines routes={routePath} opacity={0.9} />
            </MapView>
            <Link
              href="/map"
              className="absolute left-3 top-3 flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-[13px] font-bold text-slate-700 shadow-lg ring-1 ring-slate-900/5 backdrop-blur transition hover:text-slate-900"
            >
              <MapIcon className="size-4" />
              Mở bản đồ đầy đủ
            </Link>
            <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3.5 py-2.5 text-[13px] shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
              <p className="font-bold text-slate-900">Tổng quan lộ trình</p>
              <dl className="mt-1 space-y-0.5 text-slate-500">
                <div className="flex justify-between gap-6">
                  <dt>Tổng quãng đường</dt>
                  <dd className="font-bold text-slate-800">{distKm > 0 ? fmtKm(distKm) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt>Thời gian di chuyển</dt>
                  <dd className="font-bold text-slate-800">{distKm > 0 ? fmtHours(distKm / 45) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt>Tổng chi phí</dt>
                  <dd className="font-bold text-slate-800">{formatVnd(total)}</dd>
                </div>
              </dl>
            </div>
            <div className="absolute bottom-3 right-3 flex overflow-hidden rounded-xl bg-white/95 text-xs font-bold shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
              {(["light", "satellite"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={classNames(
                    "px-3 py-2 transition",
                    style === s ? "bg-[#1d4ed8]/10 text-[#1d4ed8]" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {s === "light" ? "Bản đồ" : "Vệ tinh"}
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 rounded-2xl bg-sky-50/70 p-3 ring-1 ring-sky-100">
            <div className="flex items-center justify-between px-1">
              <p className="text-[13px] font-bold text-[#1d4ed8]">
                Gợi ý AI cho Ngày {dayIdx + 1}
              </p>
              <Link href="/destinations" className="text-xs font-bold text-[#1d4ed8] hover:underline">
                Xem tất cả ›
              </Link>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {alternatives.slice(0, 3).map(({ d, km }) => {
                const r = ratingCache.get(d.id);
                return (
                  <div key={d.id} className="rounded-xl bg-white p-2 shadow-sm">
                    <div className="flex gap-2">
                      {d.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.images[0]} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                          <Plane className="size-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-slate-800">{d.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {d.address ?? "Điểm đến nổi bật"}
                        </p>
                        <p className="text-xs text-slate-400">Khoảng cách: {fmtKm(km)}</p>
                        {r ? (
                          <p className="flex items-center gap-0.5 text-xs text-slate-500">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {r.avg.toFixed(1)} ({r.count})
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quickAddAfter(d, selected?.id)}
                      className="mt-1.5 w-full rounded-lg border border-[#1d4ed8]/30 py-1.5 text-xs font-bold text-[#1d4ed8] transition hover:bg-[#1d4ed8]/5"
                    >
                      Thêm nhanh
                    </button>
                  </div>
                );
              })}
              {alternatives.length === 0 ? (
                <p className="col-span-3 rounded-xl bg-white px-3 py-4 text-center text-xs text-slate-400">
                  Thêm điểm đến có vị trí để nhận gợi ý lân cận.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="hidden min-h-0 flex-col lg:flex">
          {selectedActivity && panelOpen ? (
            <ActivityPanel
              key={selectedActivity.id}
              activity={selectedActivity}
              dest={selectedDest}
              avg={selectedRating?.avg ?? 0}
              count={selectedRating?.count ?? 0}
              review={selectedReview}
              alternatives={alternatives}
              onClose={() => {
                setSelected(null);
                setPanelOpen(false);
              }}
              onChange={patchSelected}
              onDelete={deleteSelected}
              onReplace={replaceSelected}
              onQuickAdd={(d) => quickAddAfter(d, selected?.id)}
            />
          ) : (
            <div className="grid flex-1 place-items-center rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/5">
              <div>
                <Pencil className="mx-auto size-8 text-slate-200" />
                <p className="mt-2 text-sm font-bold text-slate-700">Chọn một hoạt động</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Nhấn vào timeline để xem chi tiết, ghi chú và gợi ý thay thế.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Mobile: selected activity opens the panel as an overlay */}
      {selectedActivity && panelOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 p-4 lg:hidden">
          <div className="mx-auto flex h-full max-w-md flex-col">
            <button
              type="button"
              aria-label="Đóng"
              onClick={() => {
                setSelected(null);
                setPanelOpen(false);
              }}
              className="mb-2 grid size-8 place-items-center self-end rounded-full bg-white text-slate-600 shadow"
            >
              <X className="size-4" />
            </button>
            <div className="flex min-h-0 flex-1 flex-col [&>aside]:max-h-full [&>aside]:w-full [&>aside]:flex-1">
              <ActivityPanel
                key={selectedActivity.id}
                activity={selectedActivity}
                dest={selectedDest}
                avg={selectedRating?.avg ?? 0}
                count={selectedRating?.count ?? 0}
                review={selectedReview}
                alternatives={alternatives}
                onClose={() => {
                  setSelected(null);
                  setPanelOpen(false);
                }}
                onChange={patchSelected}
                onDelete={deleteSelected}
                onReplace={replaceSelected}
                onQuickAdd={(d) => quickAddAfter(d, selected?.id)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
