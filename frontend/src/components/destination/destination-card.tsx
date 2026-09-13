import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import type { Destination } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Stars } from "@/components/shared/stars";

export type CardBadge = "verify" | "hot" | "new" | null;

export function DestinationCard({
  destination,
  badge,
  rating,
  ratingCount,
  province,
  href,
  className,
}: {
  destination: Destination;
  /** Override the top-left badge. Defaults to verify when published. */
  badge?: CardBadge;
  rating?: number | null;
  ratingCount?: number;
  province?: string;
  /** Override the card link (defaults to the detail page). */
  href?: string;
  className?: string;
}) {
  const image = destination.images?.[0];
  const resolved: CardBadge =
    badge !== undefined
      ? badge
      : destination.status === "PUBLISHED"
        ? "verify"
        : null;

  return (
    <Card
      className={`group w-[220px] shrink-0 snap-start overflow-hidden transition-shadow hover:shadow-md md:w-[240px] ${className ?? ""}`}
    >
      <Link
        href={href ?? `/destinations/${destination.id}`}
        className="block"
        aria-label={destination.name}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
          {image ? (
            <Image
              src={image}
              alt={destination.name}
              fill
              sizes="240px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              unoptimized={/^https?:\/\/(upload\.wikimedia\.org|picsum\.photos)/.test(image)}
            />
          ) : null}
          {resolved === "verify" ? (
            <Badge variant="verify" className="absolute left-3 top-3 shadow-sm">
              Đã verify
            </Badge>
          ) : null}
          {resolved === "hot" ? (
            <Badge variant="hot" className="absolute left-3 top-3 shadow-sm">
              Hot
            </Badge>
          ) : null}
          {resolved === "new" ? (
            <Badge variant="new" className="absolute left-3 top-3 shadow-sm">
              New
            </Badge>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-10">
            <h3 className="line-clamp-1 font-semibold text-white">
              {destination.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/85">
              <MapPin className="size-3" />
              {province ?? destination.address ?? ""}
            </p>
          </div>
        </div>
        <div className="px-1 py-2.5">
          <Stars value={rating ?? null} count={ratingCount} />
        </div>
      </Link>
    </Card>
  );
}
