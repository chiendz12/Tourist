"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  MAP_DEFAULTS,
  MAP_STYLE,
  NEXT_PUBLIC_MAPBOX_TOKEN,
} from "@/lib/env";
import { classNames } from "@/lib/utils";

/**
 * Lightweight Mapbox wrapper used by all map pages. Exposes a context with
 * the live map instance so children can render layers and popups.
 */
interface MapViewProps {
  className?: string;
  /** Called once when the map's `load` event has fired. */
  onReady?: (map: mapboxgl.Map) => void;
  /** Initial center override. */
  center?: [number, number];
  /** Initial zoom override. */
  zoom?: number;
  /** Mapbox style URL. */
  style?: string;
  children?: React.ReactNode;
}

const MapCtx = React.createContext<mapboxgl.Map | null>(null);

export function MapView({
  className,
  onReady,
  center,
  zoom,
  style,
  children,
}: MapViewProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const instanceRef = React.useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = React.useState<mapboxgl.Map | null>(null);
  const onReadyRef = React.useRef(onReady);

  React.useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  React.useEffect(() => {
    if (!containerRef.current || !NEXT_PUBLIC_MAPBOX_TOKEN) return;
    // Ref guard (not state): StrictMode remounts must reuse the same
    // instance instead of creating a second map in one container, which
    // leaves children holding a removed map whose style is gone.
    if (instanceRef.current) {
      setMap(instanceRef.current);
      return;
    }

    const instance = new mapboxgl.Map({
      container: containerRef.current,
      style: style ?? MAP_STYLE,
      center: center ?? MAP_DEFAULTS.center,
      zoom: zoom ?? MAP_DEFAULTS.zoom,
      accessToken: NEXT_PUBLIC_MAPBOX_TOKEN,
    });
    instanceRef.current = instance;
    instance.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    instance.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }),
      "bottom-left",
    );
    let raf = 0;
    instance.once("load", () => {
      // Defer the state commit out of the effect body so React doesn't see
      // a synchronous ref-driven update during the initial mount. Publish
      // the ref (not the closed-over instance) so a removed map is never
      // handed to children after a rapid unmount/remount.
      raf = requestAnimationFrame(() => {
        if (instanceRef.current) setMap(instanceRef.current);
      });
      onReadyRef.current?.(instance);
    });

    return () => {
      cancelAnimationFrame(raf);
      setMap(null);
      instanceRef.current = null;
      try {
        instance.remove();
      } catch {
        /* already removed */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div
        className={classNames(
          "flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500",
          className,
        )}
      >
        Bản đồ chưa được cấu hình (thiếu NEXT_PUBLIC_MAPBOX_TOKEN).
      </div>
    );
  }

  return (
    <MapCtx.Provider value={map}>
      <div ref={containerRef} className={classNames("h-full w-full", className)} />
      {children}
    </MapCtx.Provider>
  );
}

export function useMap(): mapboxgl.Map | null {
  return React.useContext(MapCtx);
}
