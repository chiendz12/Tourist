"use client";

import * as React from "react";
import { classNames } from "@/lib/utils";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "info" | "success" | "error";
}

interface ToastApi {
  toast: (t: Omit<Toast, "id">) => void;
}

const Ctx = React.createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const api = React.useMemo<ToastApi>(
    () => ({
      toast: (t) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setToasts((prev) => [...prev, { id, ...t }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id));
        }, 4000);
      },
    }),
    [],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={classNames(
              "pointer-events-auto max-w-sm rounded-lg border bg-white px-4 py-3 shadow-lg",
              t.variant === "error" && "border-red-200",
              t.variant === "success" && "border-emerald-200",
              (!t.variant || t.variant === "info") && "border-slate-200",
            )}
            role="status"
          >
            <p className="text-sm font-semibold text-slate-900">{t.title}</p>
            {t.description ? (
              <p className="mt-0.5 text-xs text-slate-600">{t.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
