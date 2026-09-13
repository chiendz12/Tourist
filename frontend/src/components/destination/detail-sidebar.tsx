"use client";

import Link from "next/link";
import { MapPin, Navigation, Plus } from "lucide-react";
import type { Destination } from "@/lib/api/types";
import { MapView } from "@/components/map/map-view";
import { ClickMarker } from "@/components/map/click-marker";
import { MapLayers } from "@/components/map/map-layers";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";

/**
 * Sticky sidebar of the destination page: booking card plus a mini map.
 */
export function DetailSidebar({ destination }: { destination: Destination }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <Card>
        <CardBody className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Giá vé
            </p>
            <p className="mt-0.5 text-xl font-black text-slate-900">
              {destination.ticketPrice
                ? String(destination.ticketPrice)
                : "Miễn phí"}
            </p>
          </div>
          <Link
            href="/itinerary/new"
            className={buttonClass({ size: "lg", className: "w-full" })}
          >
            <Plus className="size-4" />
            Thêm vào chuyến đi
          </Link>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClass({ variant: "outline", className: "w-full" })}
          >
            <Navigation className="size-4" />
            Chỉ đường
          </a>
          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            Tọa độ: {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Vị trí trên bản đồ</h3>
          <div className="h-48 overflow-hidden rounded-xl">
            <MapView
              className="size-full"
              center={[destination.lng, destination.lat]}
              zoom={13}
            >
              <ClickMarker />
              <MapLayers destinations={[destination]} />
            </MapView>
          </div>
          <Link
            href="/map"
            className="block text-center text-xs font-bold text-[#1d4ed8] hover:underline"
          >
            Xem bản đồ tương tác lớn →
          </Link>
        </CardBody>
      </Card>
    </aside>
  );
}
