"use client";

import * as React from "react";
import {
  BedDouble,
  CloudSun,
  Flame,
  Heart,
  Landmark,
  Layers,
  MapPin,
  Mountain,
  Route as RouteIcon,
  SlidersHorizontal,
  Star,
  Tent,
  UtensilsCrossed,
  Bookmark,
  Waves,
  X,
} from "lucide-react";
import type { Destination, Province } from "@/lib/api/types";
import { classNames } from "@/lib/utils";

export type PriceTier = "all" | "$" | "$$" | "$$$" | "$$$$";
export type DurationOpt = "all" | "day" | "days23" | "package";
export type AudienceOpt = "all" | "family" | "couple" | "solo" | "team";
export type CategoryTile = "all" | "bien" | "nui" | "vanhoa" | "amthuc" | "phieuluu";

export interface LayerVisibility {
  poi: boolean;
  routes: boolean;
  suppliers: boolean;
  heatmap: boolean;
  weather: boolean;
}

export interface LayerOpacity {
  poi: number;
  routes: number;
  suppliers: number;
  heat: number;
}

interface LeftPanelProps {
  layers: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  opacity: LayerOpacity;
  onOpacity: (key: keyof LayerOpacity, value: number) => void;
  provinceIds: string[];
  onToggleProvince: (id: string) => void;
  provinces: Province[];
  category: CategoryTile;
  onCategory: (c: CategoryTile) => void;
  price: PriceTier;
  onPrice: (p: PriceTier) => void;
  duration: DurationOpt;
  onDuration: (d: DurationOpt) => void;
  audience: AudienceOpt;
  onAudience: (a: AudienceOpt) => void;
  minRating: number | null;
  onMinRating: (r: number | null) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  saved: Destination[];
  onSelectId: (id: string) => void;
}

const LAYER_ROWS: Array<{
  key: keyof LayerVisibility;
  opacityKey?: keyof LayerOpacity;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  live: boolean;
  pendingHint?: string;
}> = [
  { key: "poi", opacityKey: "poi", label: "Điểm đến (POI)", icon: MapPin, live: true },
  { key: "routes", opacityKey: "routes", label: "Tuyến du lịch", icon: Tent, live: true },
  { key: "suppliers", opacityKey: "suppliers", label: "Nhà cung cấp", icon: BedDouble, live: false, pendingHint: "Chưa có tọa độ" },
  { key: "heatmap", opacityKey: "heat", label: "Heatmap (mật độ review)", icon: Flame, live: true },
  { key: "weather", label: "Thời tiết / Mùa", icon: CloudSun, live: false, pendingHint: "Sắp có" },
];

const CATEGORY_TILES: Array<{
  value: Exclude<CategoryTile, "all">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "bien", label: "Biển", icon: Waves },
  { value: "nui", label: "Núi", icon: Mountain },
  { value: "vanhoa", label: "Văn hóa", icon: Landmark },
  { value: "amthuc", label: "Ẩm thực", icon: UtensilsCrossed },
  { value: "phieuluu", label: "Phiêu lưu", icon: RouteIcon },
];

/**
 * Floating left column: layers card (tabs Layers/Saved) above the
 * always-visible filters card.
 */
export function LeftPanel(props: LeftPanelProps) {
  const [tab, setTab] = React.useState<"layers" | "saved">("layers");
  const filtersRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <div className="pointer-events-auto flex max-h-full w-[292px] shrink-0 flex-col gap-3 overflow-y-auto">
      <section className="shrink-0 rounded-2xl bg-white/95 shadow-xl ring-1 ring-slate-900/5 backdrop-blur">
        <div className="flex items-center gap-1 border-b border-slate-100 px-3 pt-1">
          <PanelTab
            active={tab === "layers"}
            onClick={() => setTab("layers")}
            icon={<Layers className="size-4" />}
            label="Layers"
          />
          <button
            type="button"
            onClick={() =>
              filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }
            className="flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 py-2.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-800"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {props.activeFilterCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-[#1d4ed8] text-[10px] font-bold text-white">
                {props.activeFilterCount}
              </span>
            ) : null}
          </button>
          <PanelTab
            active={tab === "saved"}
            onClick={() => setTab("saved")}
            icon={<Bookmark className="size-4" />}
            label="Saved"
          />
        </div>

        <div className="max-h-[38dvh] overflow-y-auto p-3">
          {tab === "layers" ? (
            <>
              <p className="flex items-center gap-1 px-1 text-xs font-bold text-slate-700">
                Hiển thị trên bản đồ
                <span className="grid size-3.5 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-500" title="Bật/tắt và chỉnh độ trong suốt từng lớp dữ liệu">
                  i
                </span>
              </p>
              <ul className="mt-1 space-y-3">
                {LAYER_ROWS.map((row) => {
                  const on = props.layers[row.key];
                  const pct =
                    row.opacityKey != null
                      ? Math.round(props.opacity[row.opacityKey] * 100)
                      : row.key === "weather"
                        ? 60
                        : 100;
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        onClick={() => props.onToggleLayer(row.key)}
                        title={row.live ? undefined : row.pendingHint}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <span
                          className={classNames(
                            "grid size-4 shrink-0 place-items-center rounded border text-[10px] font-bold text-white",
                            on ? "border-[#1d4ed8] bg-[#1d4ed8]" : "border-slate-300 bg-white",
                          )}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <row.icon
                          className={classNames(
                            "size-4 shrink-0",
                            on ? "text-slate-600" : "text-slate-300",
                          )}
                        />
                        <span
                          className={classNames(
                            "flex-1 truncate text-[13px]",
                            on ? "font-medium text-slate-700" : "text-slate-400",
                          )}
                        >
                          {row.label}
                          {row.live ? null : (
                            <span className="ml-1 text-[10px] text-slate-400">
                              ({row.pendingHint})
                            </span>
                          )}
                        </span>
                        <span className="text-xs tabular-nums text-slate-400">{pct}%</span>
                      </button>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={row.opacityKey != null ? Math.round(props.opacity[row.opacityKey] * 100) : pct}
                        disabled={row.opacityKey == null || !on}
                        onChange={(e) =>
                          row.opacityKey != null &&
                          props.onOpacity(row.opacityKey, Number(e.target.value) / 100)
                        }
                        aria-label={`Độ trong suốt ${row.label}`}
                        className="mt-1.5 w-full accent-[#1d4ed8] disabled:accent-slate-300"
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <SavedList saved={props.saved} onSelectId={props.onSelectId} />
          )}
        </div>
      </section>

      <section
        ref={filtersRef}
        className="shrink-0 rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-slate-900/5 backdrop-blur"
      >
        <div className="flex items-center justify-between px-1">
          <p className="flex items-center gap-1 text-[13px] font-bold text-slate-800">
            <span className="text-slate-400">∨</span> Filters
          </p>
          <button
            type="button"
            onClick={props.onResetFilters}
            className="text-xs font-semibold text-[#1d4ed8] hover:underline"
          >
            Đặt lại
          </button>
        </div>

        <div className="mt-2.5 space-y-3.5">
          <div>
            <p className="px-1 text-xs font-semibold text-slate-500">Theo tỉnh / vùng</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {props.provinceIds.map((id) => {
                const p = props.provinces.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => props.onToggleProvince(id)}
                    className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                  >
                    {p.name}
                    <X className="size-3" />
                  </button>
                );
              })}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) props.onToggleProvince(e.target.value);
                  e.target.value = "";
                }}
                aria-label="Thêm tỉnh"
                className="rounded-full bg-white py-1 pl-2 pr-1 text-xs font-semibold text-[#1d4ed8] ring-1 ring-slate-200 outline-none"
              >
                <option value="">+ Thêm</option>
                {props.provinces
                  .filter((p) => !props.provinceIds.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <p className="px-1 text-xs font-semibold text-slate-500">Loại hình du lịch</p>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {CATEGORY_TILES.map((c) => {
                const active = props.category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => props.onCategory(active ? "all" : c.value)}
                    className={classNames(
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition",
                      active
                        ? "border-[#1d4ed8] bg-[#1d4ed8] text-white shadow"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <c.icon className="size-4" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-1 text-xs font-semibold text-slate-500">Mức giá</p>
            <div className="mt-1.5 flex gap-1.5">
              {(["$", "$$", "$$$", "$$$$"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => props.onPrice(props.price === tier ? "all" : tier)}
                  className={classNames(
                    "flex-1 rounded-lg border px-1 py-1.5 text-xs font-bold transition",
                    props.price === tier
                      ? "border-[#1d4ed8] bg-[#1d4ed8] text-white shadow"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="px-1 text-xs font-semibold text-slate-500">Thời gian lý tưởng</p>
            <div className="mt-1.5 flex gap-1.5">
              {(
                [
                  { value: "day", label: "1 ngày" },
                  { value: "days23", label: "2-3 ngày" },
                  { value: "package", label: "Trọn gói" },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => props.onDuration(props.duration === o.value ? "all" : o.value)}
                  className={classNames(
                    "flex-1 rounded-lg border px-1 py-1.5 text-xs font-medium transition",
                    props.duration === o.value
                      ? "border-[#1d4ed8] bg-[#1d4ed8] text-white shadow"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="px-1 text-xs font-semibold text-slate-500">Đối tượng</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  { value: "family", label: "Gia đình" },
                  { value: "couple", label: "Cặp đôi" },
                  { value: "solo", label: "Solo" },
                  { value: "team", label: "Teambuilding" },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => props.onAudience(props.audience === o.value ? "all" : o.value)}
                  className={classNames(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                    props.audience === o.value
                      ? "border-[#1d4ed8] bg-[#1d4ed8] text-white shadow"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="px-1 text-xs font-semibold text-slate-500">Rating</p>
            <label className="mt-1.5 flex w-32 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <select
                value={props.minRating == null ? "all" : String(props.minRating)}
                onChange={(e) =>
                  props.onMinRating(e.target.value === "all" ? null : Number(e.target.value))
                }
                aria-label="Đánh giá tối thiểu"
                className="w-full bg-transparent text-xs font-semibold text-slate-600 outline-none"
              >
                <option value="all">Tất cả</option>
                <option value="4">Từ 4.0+</option>
                <option value="4.5">Từ 4.5+</option>
              </select>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}

function PanelTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[13px] font-semibold transition",
        active
          ? "border-[#1d4ed8] text-[#1d4ed8]"
          : "border-transparent text-slate-500 hover:text-slate-800",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SavedList({
  saved,
  onSelectId,
}: {
  saved: Destination[];
  onSelectId: (id: string) => void;
}) {
  if (!saved.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
        <Heart className="size-8 text-slate-200" />
        <p className="text-sm font-semibold text-slate-700">Chưa có địa điểm đã lưu</p>
        <p className="text-xs text-slate-500">
          Nhấn trái tim ở bất kỳ điểm đến nào để lưu lại tại đây.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {saved.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onSelectId(d.id)}
            className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition hover:bg-slate-100"
          >
            {d.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.images[0]}
                alt=""
                className="size-11 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                <MapPin className="size-4" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-slate-800">
                {d.name}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {d.address ?? "VietJourney"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export const CATEGORY_LABEL: Record<string, string> = {
  NATURE: "Thiên nhiên",
  HISTORY: "Lịch sử",
  CULTURE: "Văn hóa",
  CUISINE: "Ẩm thực",
  ENTERTAINMENT: "Giải trí",
  RELIGION: "Tâm linh",
  OTHER: "Khác",
};
