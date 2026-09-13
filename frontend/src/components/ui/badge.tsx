import * as React from "react";
import { classNames } from "@/lib/utils";

type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "verify"
  | "hot"
  | "new";

const VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
  verify: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  hot: "bg-orange-500 text-white",
  new: "bg-sky-500 text-white",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
