import * as React from "react";
import { classNames } from "@/lib/utils";

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames("p-5 border-b border-slate-100", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <h3
      className={classNames(
        "text-base font-semibold tracking-tight text-slate-900",
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames("p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        "p-4 border-t border-slate-100 flex items-center justify-end gap-2",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
