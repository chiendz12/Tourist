"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Heart, Plus } from "lucide-react";
import { favoritesApi } from "@/lib/api/services";
import { classNames } from "@/lib/utils";

/** Heart toggle for saved-place cards (add/remove favorite + refresh). */
export function SaveButton({
  destinationId,
  isFav,
  variant = "heart",
}: {
  destinationId: string;
  isFav: boolean;
  variant?: "heart" | "add";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  const toggle = async () => {
    setPending(true);
    try {
      if (isFav || added) await favoritesApi.remove(destinationId);
      else {
        await favoritesApi.add(destinationId);
        setAdded(true);
      }
      router.refresh();
    } catch {
      /* toast handled by caller page states */
    } finally {
      setPending(false);
    }
  };

  if (variant === "add") {
    const done = isFav || added;
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={classNames(
          "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50",
          done
            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : "border-[#1d4ed8]/30 text-[#1d4ed8] hover:bg-[#1d4ed8]/5",
        )}
      >
        {done ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
        {done ? "Đã thêm" : "Thêm vào chuyến"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={isFav ? "Bỏ lưu" : "Lưu yêu thích"}
      className="grid size-8 place-items-center rounded-full bg-white/90 text-slate-500 shadow transition hover:text-rose-500 disabled:opacity-50"
    >
      <Heart className={classNames("size-4", (isFav || added) && "fill-rose-500 text-rose-500")} />
    </button>
  );
}
