"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classNames } from "@/lib/utils";

export function CarouselRow({
  children,
  className,
  /** Render large arrows overlapping the row edges (testimonials style). */
  sideArrows = false,
}: {
  children: React.ReactNode;
  className?: string;
  sideArrows?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.9, 720), behavior: "smooth" });
  };

  const arrowClass = sideArrows
    ? "pointer-events-auto grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-colors hover:text-slate-900"
    : "pointer-events-auto grid size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-slate-900";

  const arrows = (
    <>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Trước"
        className={arrowClass}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Sau"
        className={arrowClass}
      >
        <ChevronRight className="size-4" />
      </button>
    </>
  );

  return (
    <div className={classNames("relative", className)}>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {sideArrows ? (
        <>
          <div className="pointer-events-none absolute -left-5 top-1/2 hidden -translate-y-1/2 md:block">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Trước"
              className={arrowClass}
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
          <div className="pointer-events-none absolute -right-5 top-1/2 hidden -translate-y-1/2 md:block">
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Sau"
              className={arrowClass}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute -top-11 right-0 hidden gap-2 md:flex">
          {arrows}
        </div>
      )}
    </div>
  );
}
