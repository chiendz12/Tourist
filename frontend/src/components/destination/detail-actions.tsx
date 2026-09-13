"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Link2, Check, Map as MapIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favoritesApi } from "@/lib/api/services";
import { useSession } from "@/lib/auth/session";
import { classNames } from "@/lib/utils";

/**
 * Header actions on the destination page: save-to-favorites and copy-link.
 */
export function DetailActions({ destinationId }: { destinationId: string }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [copied, setCopied] = React.useState(false);

  const favorites = useQuery({
    queryKey: ["favorites", "mine"],
    queryFn: () => favoritesApi.list(),
    enabled: !!user,
  });
  const isFav = (favorites.data ?? []).some(
    (f) => f.destinationId === destinationId,
  );

  const toggle = useMutation({
    mutationFn: async () => {
      if (isFav) await favoritesApi.remove(destinationId);
      else await favoritesApi.add(destinationId);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["favorites", "mine"] }),
  });

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => toggle.mutate()}
        disabled={!user || toggle.isPending}
        title={user ? "Lưu yêu thích" : "Đăng nhập để lưu yêu thích"}
        className={classNames(
          "grid size-10 place-items-center rounded-full border transition",
          isFav
            ? "border-rose-200 bg-rose-50 text-rose-500"
            : "border-slate-200 bg-white text-slate-500 hover:text-rose-500",
        )}
      >
        <Heart className={classNames("size-5", isFav && "fill-rose-500")} />
      </button>
      <button
        type="button"
        onClick={share}
        title="Sao chép liên kết"
        className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
      >
        {copied ? (
          <Check className="size-5 text-emerald-600" />
        ) : (
          <Link2 className="size-5" />
        )}
      </button>
      <Link
        href="/map"
        className="hidden items-center gap-1.5 rounded-full bg-[#1d4ed8] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 sm:flex"
      >
        <MapIcon className="size-4" />
        Mở bản đồ
      </Link>
    </span>
  );
}
