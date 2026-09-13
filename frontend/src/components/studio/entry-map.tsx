"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import { Layers, MapPin, Search, X } from "lucide-react";
import { MapView } from "@/components/map/map-view";
import { MapLayers } from "@/components/map/map-layers";
import { HeroMapPreview } from "@/components/map/hero-map-preview";
import { searchPlaces, type PlaceResult } from "@/lib/mapbox-geocode";
import type { Destination } from "@/lib/api/types";
import { classNames } from "@/lib/utils";

interface EntryMapProps {
  lat: number | null;
  lng: number | null;
  name: string;
  statusLabel: string;
  pickMode: boolean;
  onPick: (lng: number, lat: number, source: "click" | "drag") => void;
  showSurrounding: boolean;
  onToggleSurrounding: () => void;
  surrounding: Destination[];
  /** Fired when a search result is picked (fills name/address/coords). */
  onSelectPlace?: (place: PlaceResult) => void;
}

const FALLBACK: [number, number] = [107.1839, 20.9101];

/**
 * Right-hand map of the student entry page: draggable red pin, click to
 * place, approved surroundings, coordinate card and mini preview.
 */
export function EntryMap({
  lat,
  lng,
  name,
  statusLabel,
  pickMode,
  onPick,
  showSurrounding,
  onToggleSurrounding,
  surrounding,
  onSelectPlace,
}: EntryMapProps) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const searchSeq = React.useRef(0);
  const mapRef = React.useRef<mapboxgl.Map | null>(null);
  const markerRef = React.useRef<mapboxgl.Marker | null>(null);
  const onPickRef = React.useRef(onPick);
  const pickRef = React.useRef(pickMode);
  React.useEffect(() => {
    onPickRef.current = onPick;
    pickRef.current = pickMode;
  });

  const center: [number, number] =
    lng != null && lat != null ? [lng, lat] : FALLBACK;

  const searchTimer = React.useRef(0);
  const onSearchChange = (v: string) => {
    setQ(v);
    window.clearTimeout(searchTimer.current);
    if (v.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    searchTimer.current = window.setTimeout(async () => {
      const r = await searchPlaces(v);
      if (searchSeq.current === seq) {
        setResults(r);
        setSearching(false);
      }
    }, 350);
  };

  const selectPlace = (p: PlaceResult) => {
    setQ("");
    setResults([]);
    onPickRef.current(Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6)), "click");
    try {
      mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 14, duration: 1200 });
    } catch {
      /* map gone */
    }
    onSelectPlace?.(p);
  };

  const handleReady = (map: mapboxgl.Map) => {
    mapRef.current = map;
    try {
      map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), "top-right");
    } catch {
      /* controls unavailable */
    }

    const el = document.createElement("div");
    el.innerHTML =
      '<svg width="36" height="48" viewBox="0 0 36 48" fill="none"><path d="M18 1C9.7 1 3 7.7 3 16c0 10.5 12.3 26.4 13.6 28 .7.9 2.1.9 2.8 0C20.7 42.4 33 26.5 33 16 33 7.7 26.3 1 18 1Z" fill="#e11d48" stroke="#fff" stroke-width="2"/><circle cx="18" cy="16" r="6" fill="#fff"/></svg>';
    el.style.cursor = "grab";
    const marker = new mapboxgl.Marker({ element: el, draggable: true, anchor: "bottom" });
    markerRef.current = marker;
    if (lng != null && lat != null) marker.setLngLat([lng, lat]).addTo(map);
    else marker.setLngLat(FALLBACK).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      onPickRef.current(Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6)), "drag");
    });
    marker.getElement().addEventListener("click", (e) => {
      e.stopPropagation();
      const p = marker.getLngLat();
      new mapboxgl.Popup({ offset: 24, closeButton: false })
        .setLngLat(p)
        .setHTML(
          `<div style="font-family:inherit;min-width:150px"><strong style="font-size:13px;color:#0f172a">${escapeHtml(name || "Điểm mới")}</strong><br />` +
            `<span style="font-size:12px;color:#16a34a;font-weight:700">${escapeHtml(statusLabel)}</span><br />` +
            `<span style="font-size:12px;color:#64748b">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</span></div>`,
        )
        .addTo(map);
    });

    map.on("click", (e) => {
      // Click-to-place only in pick mode (toggled by "Chọn trên bản đồ").
      if (!pickRef.current) return;
      onPickRef.current(Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6)), "click");
    });
  };

  // Keep the pin glued to the form coordinates.
  React.useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    try {
      if (lng != null && lat != null) {
        marker.setLngLat([lng, lat]);
        if (!marker._map) marker.addTo(map);
      } else if (marker._map) {
        marker.remove();
      }
    } catch {
      /* map gone */
    }
  }, [lng, lat]);

  const placed = lng != null && lat != null;

  return (
    <div className="relative size-full min-h-[420px] bg-[#e8f1fd]">
      <MapView className="absolute inset-0" center={center} zoom={11} onReady={handleReady}>
        {showSurrounding ? <MapLayers destinations={surrounding} /> : null}
      </MapView>

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-white/95 py-2 pl-2.5 pr-3 shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
        <button
          type="button"
          role="switch"
          aria-checked={showSurrounding}
          onClick={onToggleSurrounding}
          className={classNames(
            "relative h-5 w-9 shrink-0 rounded-full transition",
            showSurrounding ? "bg-[#1d4ed8]" : "bg-slate-300",
          )}
        >
          <span
            className={classNames(
              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
              showSurrounding ? "left-[18px]" : "left-0.5",
            )}
          />
        </button>
        <span className="text-xs font-semibold text-slate-600">
          Hiển thị điểm đã duyệt xung quanh
        </span>
      </div>

      <div className="absolute left-3 top-[60px] w-72 max-w-[calc(100%-24px)]">
        <div className="flex items-center gap-2 rounded-xl bg-white/95 py-2 pl-3 pr-2 shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm địa điểm…"
            aria-label="Tìm địa điểm trên bản đồ"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400"
          />
          {searching ? (
            <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#1d4ed8]" />
          ) : q ? (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => {
                setQ("");
                setResults([]);
              }}
              className="grid size-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {results.length > 0 ? (
          <ul className="mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectPlace(p)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[#1d4ed8]" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="block truncate text-[13px] font-bold text-slate-800">{p.name}</span>
                      <span className="shrink-0 rounded bg-slate-100 px-1 py-px text-[10px] font-bold text-slate-400">
                        {p.source === "VietJourney" ? "VJ" : p.source === "OpenStreetMap" ? "OSM" : "Map"}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-slate-400">{p.address}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggleSurrounding}
        title="Lớp bản đồ"
        className="absolute right-3 top-24 grid size-9 place-items-center rounded-lg bg-white text-slate-600 shadow-lg ring-1 ring-slate-900/5 transition hover:text-slate-900"
      >
        <Layers className="size-4" />
      </button>

      <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3.5 py-2.5 shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
        <p className="text-xs font-semibold text-slate-500">Tọa độ đã chọn</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm font-black tabular-nums text-slate-900">
          {placed ? `${lat!.toFixed(4)}, ${lng!.toFixed(4)}` : "—"}
          {placed ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600">
              ✓ Đã cập nhật
            </span>
          ) : null}
        </p>
      </div>

      <div className="absolute bottom-3 right-3 hidden w-32 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-900/5 sm:block">
        <div className="h-20">
          <HeroMapPreview />
        </div>
        <p className="py-1 text-center text-[11px] font-semibold text-slate-500">Bản đồ</p>
      </div>

      {pickMode ? (
        <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-900/80 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur">
          Nhấn vào bản đồ để đặt ghim
        </p>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
