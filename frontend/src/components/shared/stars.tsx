import { Star } from "lucide-react";
import { classNames } from "@/lib/utils";

export function Stars({
  value,
  count,
  className,
}: {
  value: number | null;
  count?: number;
  className?: string;
}) {
  if (value === null || Number.isNaN(value)) return null;
  return (
    <span className={classNames("inline-flex items-center gap-1 text-xs", className)}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" />
      <strong className="font-semibold text-slate-800">{value.toFixed(1)}</strong>
      {typeof count === "number" ? (
        <span className="text-slate-500">({count})</span>
      ) : null}
    </span>
  );
}
