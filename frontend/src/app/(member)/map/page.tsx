"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutList } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { MapView, useMap } from "@/components/map/map-view";
import { ClickMarker } from "@/components/map/click-marker";
import { MapLayers, type MarkerRating } from "@/components/map/map-layers";
import { RouteLines } from "@/components/map/route-lines";
import { HeatmapLayer } from "@/components/map/heatmap-layer";
import { MapTopbar, type MapMode } from "@/components/map/interactive/map-topbar";
import { SearchPin } from "@/components/map/search-pin";
import { searchPlaces, type PlaceResult, type SearchBias } from "@/lib/mapbox-geocode";
import { useToast } from "@/components/ui/toast";
import {
  LeftPanel,
  type AudienceOpt,
  type CategoryTile,
  type DurationOpt,
  type LayerOpacity,
  type LayerVisibility,
  type PriceTier,
} from "@/components/map/interactive/left-panel";
import { DestinationModal } from "@/components/map/interactive/destination-modal";
import { DirectionsLine } from "@/components/map/directions-line";
import {
  DirectionsPanel,
  fetchRoute,
  type DirPoint,
} from "@/components/map/directions-panel";
import { Tray } from "@/components/map/interactive/tray";
import {
  destinationsApi,
  favoritesApi,
  provincesApi,
  ratingsApi,
  routesApi,
  toursApi,
} from "@/lib/api/services";
import type {
  AgeGroup,
  Destination,
  DestinationCategory,
} from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";

const CENTER: [number, number] = [108.3, 15.4];
const ZOOM = 6;

const CATEGORY_SETS: Record<Exclude<CategoryTile, "all">, DestinationCategory[]> = {
  bien: ["NATURE"],
  nui: ["NATURE"],
  vanhoa: ["CULTURE", "HISTORY", "RELIGION"],
  amthuc: ["CUISINE"],
  phieuluu: ["ENTERTAINMENT"],
};

function ticketValue(ticket: Destination["ticketPrice"]): number {
  if (ticket == null) return 0;
  const digits = String(ticket).replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits);
}

function priceMatch(value: number, tier: PriceTier): boolean {
  switch (tier) {
    case "all":
      return true;
    case "$":
      return value === 0;
    case "$$":
      return value > 0 && value < 100000;
    case "$$$":
      return value >= 100000 && value < 500000;
    case "$$$$":
      return value >= 500000;
  }
}

const FALLBACK_IMG: Record<string, string> = {
  "figma-my-khe": "https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=800&auto=format&fit=crop",
  "figma-hoi-an": "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop",
  "figma-ponagar": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=800&auto=format&fit=crop",
  "figma-hon-mun": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800&auto=format&fit=crop",
  "figma-da-nang": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop",
  "figma-quy-nhon": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop",
};

/** Figma demo markers used while the API is unreachable. */
function fallbackMarkers(): Destination[] {
  const now = new Date().toISOString();
  const rows: Array<[string, string, DestinationCategory, number, number, string, number, number]> = [
    ["figma-my-khe", "Bãi biển Mỹ Khê", "NATURE", 108.244, 16.051, "Phước Mỹ, Sơn Trà, Đà Nẵng", 4.6, 256],
    ["figma-hoi-an", "Phố cổ Hội An", "CULTURE", 108.327, 15.878, "Hội An, Quảng Nam", 4.8, 512],
    ["figma-ponagar", "Tháp Bà Ponagar", "HISTORY", 109.196, 12.265, "Nha Trang, Khánh Hòa", 4.5, 189],
    ["figma-hon-mun", "Hòn Mun", "NATURE", 109.301, 12.171, "Nha Trang, Khánh Hòa", 4.7, 143],
    ["figma-da-nang", "Bà Nà Hills", "ENTERTAINMENT", 107.996, 15.997, "Hòa Vang, Đà Nẵng", 4.6, 377],
    ["figma-quy-nhon", "Eo Gió Quy Nhơn", "NATURE", 109.257, 13.422, "Nhơn Lý, Quy Nhơn", 4.5, 98],
  ];
  return rows.map(([id, name, category, lng, lat, address, rating, count]) => ({
    id,
    name,
    slug: id,
    description: "Được Forbes bình chọn là một trong những bãi biển đẹp nhất hành tinh.",
    category,
    address,
    provinceId: null,
    images: [FALLBACK_IMG[id]],
    openingHours: null,
    ticketPrice: null,
    status: "PUBLISHED",
    createdById: "figma",
    createdAt: now,
    updatedAt: now,
    lng,
    lat,
    location: { type: "Point", coordinates: [lng, lat] },
    __rating: { avg: rating, count },
  })) as Destination[];
}

function audienceMatch(t: { paxCount: number; targetAgeGroups: AgeGroup[] }, a: AudienceOpt): boolean {
  switch (a) {
    case "all":
      return true;
    case "family":
      return t.targetAgeGroups.includes("CHILD");
    case "couple":
      return t.paxCount <= 12 && !t.targetAgeGroups.includes("CHILD");
    case "solo":
      return t.paxCount >= 6 && t.paxCount <= 20;
    case "team":
      return t.paxCount >= 15;
  }
}
function durationMatch(days: number, d: DurationOpt): boolean {
  switch (d) {
    case "all":
      return true;
    case "day":
      return days <= 1;
    case "days23":
      return days >= 2 && days <= 3;
    case "package":
      return days >= 4;
  }
}

/** Module-level navigation (kept out of the component for the hooks lint). */
function goToTours(q: string) {
  window.location.href = `/tours${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`;
}

/**
 * Fullscreen interactive map: toolbar, layers/filters column, clustered
 * markers, detail card and today's itinerary tray.
 */
export default function MapPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mapRef = React.useRef<mapboxgl.Map | null>(null);

  const [q, setQ] = React.useState("");
  const deferredQ = React.useDeferredValue(q);
  const [mode, setMode] = React.useState<MapMode>(() =>
    typeof window !== "undefined" && window.localStorage.getItem("vj-map-mode") === "training"
      ? "training"
      : "public",
  );
  const [filtersOpen, setFiltersOpen] = React.useState(true);
  const [layers, setLayers] = React.useState<LayerVisibility>({
    poi: true,
    routes: true,
    suppliers: true,
    heatmap: false,
    weather: false,
  });
  const [opacity, setOpacity] = React.useState<LayerOpacity>({
    poi: 1,
    routes: 0.8,
    suppliers: 1,
    heat: 0.5,
  });
  const [provinceIds, setProvinceIds] = React.useState<string[]>([]);
  const [category, setCategory] = React.useState<CategoryTile>("all");
  const [price, setPrice] = React.useState<PriceTier>("all");
  const [duration, setDuration] = React.useState<DurationOpt>("all");
  const [audience, setAudience] = React.useState<AudienceOpt>("all");
  const [minRating, setMinRating] = React.useState<number | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [stopIds, setStopIds] = React.useState<string[]>([]);
  const [userPosition, setUserPosition] = React.useState<{ lng: number; lat: number } | null>(null);
  const [searchPin, setSearchPin] = React.useState<PlaceResult | null>(null);
  // Viewport bias for place search (mirrors osm.org): viewbox for OSM,
  // map center as proximity for Mapbox. Rounded so panning doesn't spam.
  const [mapBias, setMapBias] = React.useState<SearchBias | null>(null);
  const mapBiasKey = mapBias
    ? `${mapBias.viewbox ?? ""}|${
        mapBias.proximity ? `${mapBias.proximity.lng.toFixed(1)},${mapBias.proximity.lat.toFixed(1)}` : ""
      }`
    : "";
  const [dirOpen, setDirOpen] = React.useState(false);
  const [dirFrom, setDirFrom] = React.useState<DirPoint | null>(null);
  const [dirTo, setDirTo] = React.useState<DirPoint | null>(null);
  const [extraStops, setExtraStops] = React.useState<Map<string, Destination>>(new Map());
  const [ratingCache, setRatingCache] = React.useState<Map<string, MarkerRating>>(
    () =>
      new Map(
        fallbackMarkers().map((d) => [
          d.id,
          (d as unknown as { __rating: MarkerRating }).__rating,
        ]),
      ),
  );

  React.useEffect(() => {
    window.localStorage.setItem("vj-map-mode", mode);
  }, [mode]);

  React.useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPosition({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      () => {},
      { timeout: 8000 },
    );
  }, []);

  const provinces = useQuery({
    queryKey: ["provinces", "public"],
    queryFn: () => provincesApi.list(),
  });
  const bbox = useQuery({
    queryKey: ["destinations", "map", { q: deferredQ }],
    queryFn: () =>
      destinationsApi.bbox({
        minLng: 100,
        minLat: 8,
        maxLng: 112,
        maxLat: 24,
        limit: 300,
        q: deferredQ || undefined,
      }),
  });
  const routes = useQuery({
    queryKey: ["routes", "map-lines"],
    queryFn: () => routesApi.list({ limit: 30 }),
  });
  const tours = useQuery({
    queryKey: ["tours", "map-tab"],
    queryFn: () => toursApi.list({ limit: 30 }),
  });
  const favorites = useQuery({
    queryKey: ["favorites", "mine"],
    queryFn: () => favoritesApi.list(),
    enabled: !!user,
  });

  // In-app directions: destination comes from a marker/modal/pin click,
  // origin defaults to the user's location when known.
  const openDirections = React.useCallback(
    (point: DirPoint) => {
      setDirTo(point);
      setDirFrom((prev) =>
        prev ?? (userPosition ? { ...userPosition, label: "Vị trí của tôi" } : null),
      );
      setDirOpen(true);
      setSelectedId(null);
    },
    [userPosition],
  );

  const [dirChoice, setDirChoice] = React.useState(0);

  const closeDirections = React.useCallback(() => {
    setDirOpen(false);
    setDirFrom(null);
    setDirTo(null);
    setDirChoice(0);
  }, []);

  const routeQuery = useQuery({
    queryKey: [
      "directions",
      dirFrom ? `${dirFrom.lng.toFixed(5)},${dirFrom.lat.toFixed(5)}` : null,
      dirTo ? `${dirTo.lng.toFixed(5)},${dirTo.lat.toFixed(5)}` : null,
    ],
    queryFn: () => fetchRoute(dirFrom!, dirTo!),
    enabled: dirOpen && !!dirFrom && !!dirTo,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // All alternative routes (best first). The choice resets whenever the
  // endpoints change so it never points past the new list.
  const dirRoutes = React.useMemo(() => routeQuery.data ?? [], [routeQuery.data]);
  React.useEffect(() => {
    setDirChoice(0);
  }, [
    dirFrom ? `${dirFrom.lng.toFixed(5)},${dirFrom.lat.toFixed(5)}` : null,
    dirTo ? `${dirTo.lng.toFixed(5)},${dirTo.lat.toFixed(5)}` : null,
  ]);
  const safeChoice = Math.min(dirChoice, Math.max(dirRoutes.length - 1, 0));

  // Stable identity: DirectionsLine refits the camera when this object
  // changes, so it must not be rebuilt inline on every render — otherwise
  // each render re-fires fitBounds and the map feels frozen while the
  // directions panel is open.
  const dirRoute = React.useMemo(
    () =>
      dirRoutes[safeChoice]?.coordinates?.length
        ? { coordinates: dirRoutes[safeChoice].coordinates }
        : null,
    [dirRoutes, safeChoice],
  );
  const dirAlternatives = React.useMemo(
    () =>
      dirRoutes
        .filter((_, i) => i !== safeChoice && dirRoutes[i].coordinates?.length)
        .map((r) => ({ coordinates: r.coordinates })),
    [dirRoutes, safeChoice],
  );

  const toggleFav = useMutation({    mutationFn: async (destinationId: string) => {
      const ids = new Set((favorites.data ?? []).map((f) => f.destinationId));
      if (ids.has(destinationId)) await favoritesApi.remove(destinationId);
      else await favoritesApi.add(destinationId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["favorites", "mine"] }),
  });

  const markers = React.useMemo(
    () => (bbox.data?.length ? bbox.data : fallbackMarkers()),
    [bbox.data],
  );

  // Lazy rating cache for the rating filter + popup cards.
  const ensureRatings = React.useCallback(
    async (ids: string[]) => {
      const missing = ids.filter((id) => !ratingCache.has(id) && !id.startsWith("figma-"));
      if (!missing.length) return;
      const capped = missing.slice(0, 60);
      const results = await Promise.allSettled(
        capped.map((id) => ratingsApi.forDestination(id).catch(() => [])),
      );
      setRatingCache((prev) => {
        const next = new Map(prev);
        capped.forEach((id, i) => {
          if (results[i].status !== "fulfilled") return;
          const r = results[i].value;
          if (r.length) next.set(id, { avg: r.reduce((s, x) => s + x.score, 0) / r.length, count: r.length });
        });
        return next;
      });
    },
    [ratingCache],
  );

  React.useEffect(() => {
    if (minRating == null) return;
    // Fetch-on-filter-change: populating the rating cache is the effect's
    // entire purpose, so the set-state-in-effect rule does not apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ensureRatings(markers.map((m) => m.id));
  }, [minRating, markers, ensureRatings]);

  const ratingOf = React.useCallback(
    (d: Destination): MarkerRating | undefined => {
      const cached = ratingCache.get(d.id);
      if (cached) return cached;
      const embedded = (d as unknown as { __rating?: MarkerRating }).__rating;
      return embedded;
    },
    [ratingCache],
  );

  const visible = React.useMemo(
    () =>
      markers.filter((d) => {
        if (provinceIds.length && (!d.provinceId || !provinceIds.includes(d.provinceId))) return false;
        if (category !== "all" && !CATEGORY_SETS[category].includes(d.category)) return false;
        if (!priceMatch(ticketValue(d.ticketPrice), price)) return false;
        if (minRating != null) {
          const r = ratingOf(d);
          if (!r || r.avg < minRating) return false;
        }
        return true;
      }),
    [markers, provinceIds, category, price, minRating, ratingOf],
  );

  const filteredTours = React.useMemo(() => {
    const list = tours.data?.data ?? [];
    const note: string[] = [];
    if (duration !== "all")
      note.push(duration === "day" ? "1 ngày" : duration === "days23" ? "2-3 ngày" : "Trọn gói");
    if (audience !== "all")
      note.push({ family: "Gia đình", couple: "Cặp đôi", solo: "Solo", team: "Teambuilding" }[audience]);
    return {
      list: list.filter((t) => durationMatch(t.days, duration) && audienceMatch(t, audience)),
      note: note.length ? `Lọc tour: ${note.join(" · ")}` : null,
    };
  }, [tours.data, duration, audience]);

  const favIds = React.useMemo(
    () => new Set((favorites.data ?? []).map((f) => f.destinationId)),
    [favorites.data],
  );
  const saved = React.useMemo(() => markers.filter((d) => favIds.has(d.id)), [markers, favIds]);
  const stops = React.useMemo(
    () =>
      stopIds
        .map((id) => markers.find((d) => d.id === id) ?? extraStops.get(id))
        .filter((d): d is Destination => !!d),
    [stopIds, markers, extraStops],
  );

  // Resolve tray stops that aren't on the map (e.g. tour waypoints).
  React.useEffect(() => {
    const missing = stopIds.filter(
      (id) => !markers.some((m) => m.id === id) && !extraStops.has(id),
    );
    if (!missing.length) return;
    // Async resolution lands after the effect; the rule only guards sync calls.
    void (async () => {
      const results = await Promise.allSettled(missing.slice(0, 20).map((id) => destinationsApi.get(id)));
      setExtraStops((prev) => {
        const next = new Map(prev);
        missing.forEach((id, i) => {
          if (results[i].status === "fulfilled" && results[i].value) next.set(id, results[i].value);
        });
        return next;
      });
    })();
  }, [stopIds, markers]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeFilterCount =
    provinceIds.length +
    (category !== "all" ? 1 : 0) +
    (price !== "all" ? 1 : 0) +
    (duration !== "all" ? 1 : 0) +
    (audience !== "all" ? 1 : 0) +
    (minRating != null ? 1 : 0);

  const submitSearch = () => {
    if (mode === "training") {
      goToTours(q);
      return;
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return;
    // Only trust backend markers when they actually came back for this
    // query — otherwise `visible[0]` is an unrelated demo fallback (e.g.
    // Đà Nẵng) while the user asked for Hà Nội. Require a text match.
    const local =
      (bbox.data?.length ?? 0) > 0
        ? visible.find((m) => `${m.name} ${m.address ?? ""}`.toLowerCase().includes(needle))
        : undefined;
    if (local) {
      setSearchPin(null);
      setSelectedId(local.id);
      mapRef.current?.flyTo({ center: [local.lng, local.lat], zoom: 11, duration: 1200 });
      return;
    }
    // No curated marker matches — fall back to the external place result
    // (OSM/Mapbox), e.g. streets and POIs missing from our database.
    const ext = placeResults[0];
    if (ext) {
      pickPlace(ext);
      return;
    }
    if (!placeSearch.isFetching) {
      toast({ title: "Không tìm thấy địa điểm nào", variant: "error" });
    }
  };

  /** External place search (DB + OSM + Mapbox) for real-world addresses. */
  const placeSearch = useQuery({
    queryKey: ["map", "place-search", deferredQ.trim().toLowerCase(), mapBiasKey],
    queryFn: () => searchPlaces(deferredQ.trim(), mapBias ?? undefined),
    enabled: mode === "public" && deferredQ.trim().length >= 2,
    staleTime: 60_000,
  });
  const placeResults = placeSearch.data ?? [];

  const pickPlace = React.useCallback(
    (p: PlaceResult) => {
      // VietJourney hits open the full destination modal instead of a pin.
      if (p.id.startsWith("vj-")) {
        const destId = p.id.slice(3);
        if (markers.some((m) => m.id === destId)) {
          setSearchPin(null);
          setSelectedId(destId);
          const m = markers.find((m) => m.id === destId);
          if (m) mapRef.current?.flyTo({ center: [m.lng, m.lat], zoom: 11, duration: 1200 });
          return;
        }
      }
      setSelectedId(null);
      setSearchPin(p);
    },
    [markers],
  );

  const handleMapReady = (map: mapboxgl.Map) => {
    mapRef.current = map;
    try {
      map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "top-right",
      );
      map.addControl(new RoutesToggleControl(() => toggleLayer("routes")), "top-right");
    } catch {
      /* controls unavailable */
    }
  };

  const toggleLayer = (key: keyof LayerVisibility) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="relative h-dvh overflow-hidden bg-slate-100">
      <MapView className="absolute inset-0" center={CENTER} zoom={ZOOM} onReady={handleMapReady}>
        <ViewportTracker onChange={setMapBias} />
        <ClickMarker onDirections={openDirections} />
        <SearchPin place={searchPin} onDirections={openDirections} onClose={() => setSearchPin(null)} />
        <DirectionsLine
          route={dirRoute}
          alternatives={dirAlternatives}
          from={dirOpen ? dirFrom : null}
          to={dirOpen ? dirTo : null}
        />
        {layers.poi ? (
          <MapLayers
            destinations={visible}
            opacity={opacity.poi}
            ratingById={ratingCache}
            onSelectId={setSelectedId}
          />
        ) : null}
        {layers.routes ? (
          <RouteLines routes={routes.data?.data ?? []} opacity={opacity.routes} />
        ) : null}
        {layers.heatmap ? (
          <HeatmapLayer destinations={visible} opacity={opacity.heat} />
        ) : null}
      </MapView>

      <MapTopbar
        q={q}
        onQChange={setQ}
        onSubmitSearch={submitSearch}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        mode={mode}
        onMode={setMode}
        searchResults={mode === "public" ? placeResults : []}
        searching={placeSearch.isFetching}
        onPickPlace={pickPlace}
      />

      {filtersOpen ? (
        <div className="absolute bottom-24 left-3 top-[72px] z-10 hidden sm:block md:left-4">
          <LeftPanel
            layers={layers}
            onToggleLayer={toggleLayer}
            opacity={opacity}
            onOpacity={(key, value) => setOpacity((prev) => ({ ...prev, [key]: value }))}
            provinceIds={provinceIds}
            onToggleProvince={(id) =>
              setProvinceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            provinces={provinces.data ?? []}
            category={category}
            onCategory={setCategory}
            price={price}
            onPrice={setPrice}
            duration={duration}
            onDuration={setDuration}
            audience={audience}
            onAudience={setAudience}
            minRating={minRating}
            onMinRating={setMinRating}
            onResetFilters={() => {
              setProvinceIds([]);
              setCategory("all");
              setPrice("all");
              setDuration("all");
              setAudience("all");
              setMinRating(null);
            }}
            activeFilterCount={activeFilterCount}
            saved={saved}
            onSelectId={setSelectedId}
          />
        </div>
      ) : null}

      {selectedId ? (
        <DestinationModal
          key={selectedId}
          id={selectedId}
          provinces={provinces.data ?? []}
          tours={filteredTours.list}
          fallback={markers.find((m) => m.id === selectedId) ?? null}
          fallbackRating={ratingCache.get(selectedId)}
          userPosition={userPosition}
          onClose={() => setSelectedId(null)}
          onAddStop={(destinationId) =>
            setStopIds((prev) => (prev.includes(destinationId) ? prev : [...prev, destinationId]))
          }
          onAddTourStops={(ids) => setStopIds((prev) => Array.from(new Set([...prev, ...ids])))}
          isStop={stopIds.includes(selectedId)}
          isFav={favIds.has(selectedId)}
          onToggleFavorite={() => toggleFav.mutate(selectedId)}
          onDirections={openDirections}
        />
      ) : null}

      {dirOpen ? (
        <DirectionsPanel
          from={dirFrom}
          to={dirTo}
          onFrom={setDirFrom}
          onTo={setDirTo}
          onSwap={() => {
            setDirFrom(dirTo);
            setDirTo(dirFrom);
          }}
          onClose={closeDirections}
          candidates={visible}
          userPosition={userPosition}
          loading={routeQuery.isFetching}
          routes={dirRoutes}
          choice={safeChoice}
          onChoice={setDirChoice}
          settled={routeQuery.isFetched && !routeQuery.isFetching}
        />
      ) : null}

      <Link
        href="/destinations"
        className="absolute bottom-24 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1.5 rounded-xl bg-white/95 px-3.5 py-2.5 text-[13px] font-semibold text-slate-600 shadow-lg ring-1 ring-slate-900/5 backdrop-blur transition hover:text-slate-900 md:flex"
      >
        <LayoutList className="size-4" />
        Chuyển sang List + Map
      </Link>

      <Tray
        stops={stops}
        provinces={provinces.data ?? []}
        onRemove={(id) => setStopIds((prev) => prev.filter((s) => s !== id))}
        onAddMore={() => setFiltersOpen(true)}
      />

      {bbox.isPending ? (
        <p className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          Đang tải điểm đến…
        </p>
      ) : null}
    </div>
  );
}

/** Reports the map viewport (for search biasing) on every finished move. */
function ViewportTracker({ onChange }: { onChange: (bias: SearchBias) => void }) {
  const map = useMap();
  const cbRef = React.useRef(onChange);
  React.useEffect(() => {
    cbRef.current = onChange;
  }, [onChange ]);
  React.useEffect(() => {
    if (!map) return;
    const report = () => {
      try {
        const b = map.getBounds();
        const c = map.getCenter();
        if (!b) return;
        const r = (n: number) => Number(n.toFixed(2));
        cbRef.current({
          viewbox: `${r(b.getWest())},${r(b.getNorth())},${r(b.getEast())},${r(b.getSouth())}`,
          proximity: { lng: r(c.lng), lat: r(c.lat) },
        });
      } catch {
        /* map gone */
      }
    };
    report();
    map.on("moveend", report);
    return () => {
      map.off("moveend", report);
    };
  }, [map]);
  return null;
}

/** Blue route-toggle button stacked with the map controls. */
class RoutesToggleControl {
  private onToggle: () => void;
  private container: HTMLElement | null = null;

  constructor(onToggle: () => void) {
    this.onToggle = onToggle;
  }

  onAdd() {
    const el = document.createElement("button");
    el.type = "button";
    el.title = "Bật/tắt tuyến du lịch";
    el.className = "mapboxgl-ctrl-icon vj-routes-toggle";
    el.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/></svg>';
    el.style.background = "#1d4ed8";
    el.style.borderRadius = "8px";
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onToggle();
    });
    const wrap = document.createElement("div");
    wrap.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
    wrap.appendChild(el);
    this.container = wrap;
    return wrap;
  }

  onRemove() {
    this.container?.parentNode?.removeChild(this.container);
    this.container = null;
  }
}
