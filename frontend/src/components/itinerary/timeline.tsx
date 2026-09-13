"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  MapPin,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { TimePicker } from "@/components/itinerary/time-picker";
import { destinationsApi } from "@/lib/api/services";
import { MAP_DEFAULTS } from "@/lib/env";
import { classNames } from "@/lib/utils";
import {
  DONUT_COLORS,
  KIND_META,
  costByCategory,
  dayCost,
  dayDistanceKm,
  fmtHours,
  fmtKm,
  formatVnd,
  newActivity,
  type Activity,
  type ActivityKind,
  type DayPlan,
} from "@/components/itinerary/types";

export interface ResolvedDest {
  name: string;
  image?: string;
  address?: string;
}

interface TimelineProps {
  days: DayPlan[];
  activeDay: number | "overview";
  onActiveDay: (d: number | "overview") => void;
  onAddDay: () => void;
  onRemoveDay: (idx: number) => void;
  collapsed: Set<number>;
  onToggleCollapse: (idx: number) => void;
  selected: { dayIdx: number; id: string } | null;
  onSelect: (dayIdx: number, id: string) => void;
  onAddActivity: (dayIdx: number, activity: Activity) => void;
  resolveDest: (id?: string) => ResolvedDest | undefined;
}

/**
 * Left column: day tabs, expandable day timelines with activity cards,
 * inline add-activity form and the cost summary donut.
 */
export function Timeline(props: TimelineProps) {
  const { days, activeDay } = props;
  const [adding, setAdding] = React.useState(false);
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  const total = days.reduce((s, d) => s + dayCost(d), 0);
  const cats = costByCategory(days);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-900/5">
        <button
          type="button"
          onClick={props.onAddDay}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[#1d4ed8] px-2.5 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
        >
          <Plus className="size-3.5" />
          Thêm ngày
        </button>
        {days.map((d, i) => (
          <span
            key={d.key}
            className={classNames(
              "flex shrink-0 items-center rounded-lg text-[13px] font-semibold transition",
              activeDay === i ? "text-[#1d4ed8]" : "text-slate-500",
            )}
          >
            <button
              type="button"
              onClick={() => props.onActiveDay(i)}
              className={classNames(
                "px-3 py-2 transition hover:text-slate-800",
                activeDay === i && "underline underline-offset-8",
              )}
            >
              Ngày {i + 1}
            </button>
            {activeDay === i && days.length > 1 ? (
              <button
                type="button"
                onClick={() => props.onRemoveDay(i)}
                title={`Xóa Ngày ${i + 1}`}
                aria-label={`Xóa Ngày ${i + 1}`}
                className="mr-1 grid size-5 place-items-center rounded-full text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
        {days.length > 4 ? <span className="shrink-0 px-1 text-slate-300">…</span> : null}
        <button
          type="button"
          onClick={() => props.onActiveDay("overview")}
          className={classNames(
            "shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold transition",
            activeDay === "overview" ? "text-[#1d4ed8] underline underline-offset-8" : "text-slate-500 hover:text-slate-800",
          )}
        >
          Tổng quan
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
        {activeDay === "overview"
          ? days.map((d, i) => (
              <DayRow
                key={d.key}
                index={i}
                day={d}
                collapsed
                onToggle={() => props.onActiveDay(i)}
                onSelect={(id) => {
                  props.onActiveDay(i);
                  props.onSelect(i, id);
                }}
                resolveDest={props.resolveDest}
              />
            ))
          : days[activeDay] && (
              <>
                <DayCard
                  index={activeDay}
                  day={days[activeDay]}
                  collapsed={props.collapsed.has(activeDay)}
                  onToggle={() => props.onToggleCollapse(activeDay)}
                  selectedId={props.selected?.dayIdx === activeDay ? props.selected.id : null}
                  onSelect={(id) => props.onSelect(activeDay, id)}
                  resolveDest={props.resolveDest}
                />
                {adding ? (
                  <AddActivityForm
                    onCancel={() => setAdding(false)}
                    onAdd={(a) => {
                      props.onAddActivity(activeDay, a);
                      setAdding(false);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-white/60 py-2.5 text-[13px] font-bold text-[#1d4ed8] transition hover:border-[#1d4ed8]/40 hover:bg-[#1d4ed8]/5"
                  >
                    <Plus className="size-4" />
                    Thêm hoạt động
                  </button>
                )}
                {days.map((d, i) =>
                  i === activeDay ? null : (
                    <DayRow
                      key={d.key}
                      index={i}
                      day={d}
                      collapsed
                      onToggle={() => props.onActiveDay(i)}
                      onSelect={(id) => {
                        props.onActiveDay(i);
                        props.onSelect(i, id);
                      }}
                      resolveDest={props.resolveDest}
                    />
                  ),
                )}
              </>
            )}
      </div>

      <div className="shrink-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold text-slate-900">Tổng chi phí lộ trình</p>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="text-xs font-bold text-[#1d4ed8] hover:underline"
          >
            Chi tiết chi phí →
          </button>
        </div>
        <p className="mt-1 text-xl font-black text-slate-900">{formatVnd(total)}</p>
        <div className="mt-2 flex items-center gap-3">
          <Donut cats={cats} total={total} />
          <ul className="min-w-0 flex-1 space-y-1">
            {cats.map((c) => {
              const pct = total ? Math.round((c.value / total) * 100) : 0;
              return (
                <li key={c.label} className="flex items-center gap-1.5 text-xs">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[c.label] ?? "#94a3b8" }} />
                  <span className="flex-1 truncate text-slate-500">{c.label}</span>
                  <span className="font-bold text-slate-700">
                    {pct}% <span className="font-normal text-slate-400">({formatVnd(c.value)})</span>
                  </span>
                </li>
              );
            })}
            {cats.length === 0 ? (
              <li className="text-xs text-slate-400">Chưa có chi phí nào được nhập.</li>
            ) : null}
          </ul>
        </div>
        {showBreakdown ? (
          <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
            {days.map((d, i) => (
              <li key={d.key} className="flex justify-between text-xs text-slate-500">
                <span>Ngày {i + 1} · {d.activities.length} hoạt động</span>
                <span className="font-bold text-slate-700">{formatVnd(dayCost(d))}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function dayTitle(day: DayPlan, index: number, resolveDest: (id?: string) => ResolvedDest | undefined): string {
  const names = day.activities
    .map((a) => a.title || (a.destinationId ? resolveDest(a.destinationId)?.name : undefined))
    .filter(Boolean) as string[];
  const route = names.length >= 2 ? `${names[0]} → ${names[names.length - 1]}` : names[0] ?? `Ngày ${index + 1}`;
  return `Ngày ${index + 1} – ${route}`;
}

function DayRow({
  index,
  day,
  collapsed,
  onToggle,
  onSelect,
  resolveDest,
}: {
  index: number;
  day: DayPlan;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  resolveDest: (id?: string) => ResolvedDest | undefined;
}) {
  void onSelect;
  void resolveDest;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-2xl bg-white px-3.5 py-3 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:shadow"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-500">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800">
        {dayTitle(day, index, resolveDest)}
      </span>
      <span className="shrink-0 text-xs text-slate-400">Chi phí: {formatVnd(dayCost(day))}</span>
      <ChevronDown className={classNames("size-4 shrink-0 text-slate-400 transition-transform", !collapsed && "rotate-180")} />
    </button>
  );
}

function DayCard({
  index,
  day,
  collapsed,
  onToggle,
  selectedId,
  onSelect,
  resolveDest,
}: {
  index: number;
  day: DayPlan;
  collapsed: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  resolveDest: (id?: string) => ResolvedDest | undefined;
}) {
  const dist = dayDistanceKm(day);
  const driveH = dist / 45;
  if (collapsed) {
    return (
      <DayRow index={index} day={day} collapsed onToggle={onToggle} onSelect={onSelect} resolveDest={resolveDest} />
    );
  }
  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[#1d4ed8]/30 text-[11px] font-bold text-[#1d4ed8]">
          ○
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">
            {dayTitle(day, index, resolveDest)}
            {dist > 0 ? <span className="font-semibold text-slate-400"> ({fmtKm(dist)})</span> : null}
          </span>
          <span className="mt-0.5 block text-xs text-slate-400">
            {dist > 0 ? `${fmtHours(driveH)} di chuyển · ` : ""}Chi phí: {formatVnd(dayCost(day))}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 rotate-180 text-slate-400" />
      </button>

      {day.activities.length === 0 ? (
        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-400">
          Ngày trống — nhấn “Thêm hoạt động” để lên lịch.
        </p>
      ) : (
        <ol className="mt-2 space-y-0">
          {day.activities.map((a) => {
            const meta = KIND_META[a.kind];
            const Icon = meta.icon;
            const title = a.title || (a.destinationId ? resolveDest(a.destinationId)?.name : undefined) || "Hoạt động";
            const selected = selectedId === a.id;
            return (
              <li key={a.id} className="relative flex gap-2.5 pb-1.5 last:pb-0">
                <span className="flex w-10 shrink-0 flex-col items-center">
                  <span className="text-[11px] tabular-nums text-slate-400">{a.start}</span>
                  <span className="my-1 grid size-6 place-items-center rounded-full border bg-white" style={{ borderColor: `${meta.color}55` }}>
                    <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  </span>
                  <span className="w-px flex-1 bg-slate-200" />
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className={classNames(
                    "mb-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                    selected
                      ? "border-[#1d4ed8] shadow-md ring-1 ring-[#1d4ed8]/30"
                      : "border-slate-100 hover:border-slate-200 hover:shadow-sm",
                  )}
                  style={selected ? undefined : { background: `${meta.bg}55` }}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: meta.bg, color: meta.color }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-slate-800">{title}</span>
                    <span className="block text-xs text-slate-400">{meta.label}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] tabular-nums text-slate-500">
                      {a.start} - {a.end}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                      {a.kind === "transport" && a.distanceKm
                        ? fmtKm(a.distanceKm)
                        : a.cost > 0
                          ? formatVnd(a.cost)
                          : "Miễn phí"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function AddActivityForm({
  onAdd,
  onCancel,
}: {
  onAdd: (a: Activity) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = React.useState<ActivityKind>("destination");
  const [title, setTitle] = React.useState("");
  const [q, setQ] = React.useState("");
  const [start, setStart] = React.useState("08:00");
  const [end, setEnd] = React.useState("09:00");
  const [cost, setCost] = React.useState("");
  const deferredQ = React.useDeferredValue(q);

  const search = useQuery({
    queryKey: ["destinations", "builder-pick", deferredQ],
    queryFn: () =>
      destinationsApi.bbox({
        minLng: MAP_DEFAULTS.center[0] - 12,
        minLat: MAP_DEFAULTS.center[1] - 10,
        maxLng: MAP_DEFAULTS.center[0] + 12,
        maxLat: MAP_DEFAULTS.center[1] + 10,
        limit: 8,
        q: deferredQ || undefined,
      }),
    enabled: deferredQ.trim().length >= 2 && kind !== "transport",
  });

  const submit = (dest?: { id: string; name: string; lng: number; lat: number }) => {
    const base = newActivity(kind, title.trim() || dest?.name || KIND_META[kind].label);
    onAdd({
      ...base,
      title: title.trim() || dest?.name || KIND_META[kind].label,
      destinationId: dest?.id,
      lng: dest?.lng,
      lat: dest?.lat,
      start,
      end,
      cost: Number(cost.replace(/[^\d]/g, "")) || 0,
    });
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-[#1d4ed8]/30 bg-white p-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(KIND_META) as ActivityKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={classNames(
              "rounded-lg px-2 py-1.5 text-xs font-bold transition",
              kind === k ? "bg-[#1d4ed8] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            )}
          >
            {KIND_META[k].label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tên hoạt động…"
        className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-[#1d4ed8]"
      />
      {kind !== "transport" ? (
        <div className="relative mt-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Gắn điểm đến (gõ ≥ 2 ký tự)…"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          {(search.data ?? []).length > 0 ? (
            <ul className="absolute inset-x-0 z-10 mt-1 max-h-44 overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
              {(search.data ?? []).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => submit({ id: d.id, name: d.name, lng: d.lng, lat: d.lat })}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-slate-50"
                  >
                    <MapPin className="size-3.5 shrink-0 text-slate-300" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-700">
                      {d.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <TimePicker value={start} onChange={setStart} ariaLabel="Giờ bắt đầu" />
        <TimePicker value={end} onChange={setEnd} ariaLabel="Giờ kết thúc" />
        <label className="flex items-center gap-1 rounded-lg border border-slate-200 px-2">
          <Wallet className="size-3.5 shrink-0 text-slate-300" />
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Chi phí"
            inputMode="numeric"
            className="h-9 w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
        </label>
      </div>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => submit()}
          className="flex-1 rounded-lg bg-[#1d4ed8] py-2 text-[13px] font-bold text-white transition hover:bg-blue-700"
        >
          Thêm
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-bold text-slate-500 transition hover:bg-slate-50"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

function Donut({ cats, total }: { cats: Array<{ label: string; value: number }>; total: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const segs = cats.map((c, i, arr) => {
    const frac = total ? c.value / total : 0;
    const offset = arr
      .slice(0, i)
      .reduce((s, x) => s + (total ? x.value / total : 0), 0);
    return { ...c, frac, offset };
  });
  return (
    <svg viewBox="0 0 84 84" className="size-20 shrink-0 -rotate-90">
      <circle cx="42" cy="42" r={R} fill="none" stroke="#eef2f7" strokeWidth="12" />
      {segs.map((c) => (
        <circle
          key={c.label}
          cx="42"
          cy="42"
          r={R}
          fill="none"
          stroke={DONUT_COLORS[c.label] ?? "#94a3b8"}
          strokeWidth="12"
          strokeDasharray={`${Math.max(c.frac * C - 1.5, 0)} ${C}`}
          strokeDashoffset={-c.offset * C}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}
