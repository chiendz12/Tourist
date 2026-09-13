import * as React from "react";
import { classNames } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1d4ed8] text-white hover:bg-[#1e40af] active:translate-y-px disabled:bg-blue-300",
  secondary:
    "bg-slate-900 text-white hover:bg-slate-800 active:translate-y-px disabled:bg-slate-400",
  ghost:
    "bg-transparent text-slate-900 hover:bg-slate-100 active:translate-y-px disabled:text-slate-400",
  outline:
    "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 active:translate-y-px disabled:text-slate-400 disabled:border-slate-200",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:translate-y-px disabled:bg-red-300",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-11 px-5 text-base rounded-xl",
};

/**
 * Shared button styling for anchors that must look like buttons. A real
 * <button> must never be nested inside a <Link>/<a> (invalid HTML that
 * breaks hydration), so navigational buttons use this with <Link>.
 */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return classNames(
    "inline-flex items-center justify-center gap-2 font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClass({ variant, size, className })}
        {...rest}
      >
        {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
        {children}
      </button>
    );
  },
);
