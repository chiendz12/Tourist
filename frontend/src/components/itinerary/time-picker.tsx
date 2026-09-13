"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Clock3 } from "lucide-react";
import { classNames } from "@/lib/utils";

const STEPS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

/**
 * 24h time picker rendered in a portal so the option list always floats
 * above scrollable columns instead of being clipped by them.
 */
export function TimePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  // Portal target exists only on the client; subscribe-free mount check
  // (no setState-in-effect needed).
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Subscription effect: state only changes on scroll/resize/key events,
  // never synchronously during the effect body.
  React.useEffect(() => {
    if (!open) return;
    // Follow the button on scroll/resize; close only when it leaves the
    // viewport or on Escape. (Closing on scroll was the old behavior — it
    // also swallowed the list's own auto-scroll and killed the dropdown
    // the instant it opened.)
    const reposition = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) {
        setOpen(false);
        return;
      }
      if (rect.bottom < -40 || rect.top > window.innerHeight + 40) {
        setOpen(false);
        return;
      }
      setAnchor(rect);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", reposition, { capture: true, passive: true });
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const below = anchor ? window.innerHeight - anchor.bottom > 260 : true;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = btnRef.current?.getBoundingClientRect();
          if (rect) setAnchor(rect);
          setOpen(true);
        }}
        aria-label={ariaLabel ?? "Chọn giờ"}
        aria-expanded={open}
        className={classNames(
          "flex h-9 w-full items-center gap-1.5 rounded-lg border bg-white px-2 text-xs tabular-nums transition",
          open
            ? "border-[#1d4ed8] text-slate-900 ring-1 ring-[#1d4ed8]/30"
            : "border-slate-200 text-slate-700 hover:border-slate-300",
        )}
      >
        <Clock3 className="size-3.5 shrink-0 text-slate-400" />
        <span className="flex-1 text-left font-semibold">{value || "--:--"}</span>
      </button>
      {open && mounted && anchor
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Đóng chọn giờ"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[70] cursor-default bg-transparent"
              />
              <div
                role="listbox"
                aria-label={ariaLabel ?? "Chọn giờ"}
                className="fixed z-[71] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10"
                style={{
                  left: Math.max(8, Math.min(anchor.left, window.innerWidth - 216)),
                  top: below ? anchor.bottom + 6 : undefined,
                  bottom: below ? undefined : window.innerHeight - anchor.top + 6,
                  width: Math.max(anchor.width, 208),
                }}
              >
                <TimeList
                  value={value}
                  onPick={(t) => {
                    onChange(t);
                    setOpen(false);
                  }}
                />
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function TimeList({ value, onPick }: { value: string; onPick: (t: string) => void }) {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Center the selected row by scrolling ONLY this list — scrollIntoView
    // would also yank ancestor scrollers and the page.
    const box = listRef.current;
    const active = box?.querySelector<HTMLElement>("[data-active='true']");
    if (box && active) {
      box.scrollTop = Math.max(active.offsetTop - box.clientHeight / 2 + active.clientHeight / 2, 0);
    }
  }, []);

  return (
    <div ref={listRef} className="max-h-60 overflow-y-auto p-1.5">
      {STEPS.map((t) => {
        const active = t === value;
        return (
          <button
            key={t}
            type="button"
            role="option"
            aria-selected={active}
            data-active={active}
            onClick={() => onPick(t)}
            className={classNames(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm tabular-nums transition",
              active
                ? "bg-[#1d4ed8] font-bold text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t}
            {active ? <Check className="size-4" /> : null}
          </button>
        );
      })}
    </div>
  );
}
