"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Lock, LockOpen } from "lucide-react";
import { adminApi } from "@/lib/api/services";
import { useToast } from "@/components/ui/toast";

export function StatCard({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${tint}`}>
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

export function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg viewBox="0 0 52 52" width={size} height={size} className="-rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e8eef5" strokeWidth="7" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="#22c55e"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${frac * c} ${c}`}
      />
    </svg>
  );
}

/** Client CSV download for any JSON-serializable rows. */
export function ExportButton({
  filename,
  rows,
  label,
}: {
  filename: string;
  rows: Array<Record<string, unknown>>;
  label: string;
}) {
  const download = () => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv =
      "﻿" +
      [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = filename;
    el.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={download}
      disabled={!rows.length}
      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-bold text-slate-600 shadow-sm transition hover:text-slate-900 disabled:opacity-40"
    >
      <Download className="size-4" />
      {label}
    </button>
  );
}

/** Lock/unlock a user account with refresh. */
export function LockButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  const toggle = async () => {
    setPending(true);
    try {
      await adminApi.updateUser(id, { isActive: !isActive });
      toast({
        title: isActive ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản",
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Thao tác thất bại",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
      className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
    >
      {isActive ? <LockOpen className="size-4" /> : <Lock className="size-4 text-rose-500" />}
    </button>
  );
}
