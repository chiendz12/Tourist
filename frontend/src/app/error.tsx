"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary. Keeps the site header/footer and shows the
 * real error message so failures can be reported instead of going blank.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[vietjourney] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-xl place-items-center px-5 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-500">
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">
        Trang này không tải được
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Nhấn thử lại, hoặc quay về trang chủ. Nếu lỗi lặp lại, hãy gửi mã lỗi
        bên dưới cho đội phát triển.
      </p>
      <p className="mt-3 max-w-full overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
        {error.message || "Unknown error"}
        {error.digest ? ` · digest ${error.digest}` : ""}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-xl bg-[#1d4ed8] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          <RotateCcw className="size-4" />
          Thử lại
        </button>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Home className="size-4" />
          Trang chủ
        </Link>
      </div>
    </div>
  );
}
