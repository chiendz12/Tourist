"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { itinerariesApi } from "@/lib/api/services";
import { clearDraft } from "@/components/itinerary/types";
import { useToast } from "@/components/ui/toast";

/**
 * ⋮ menu on member trip cards: edit in the builder, or two-step delete
 * (server record + local draft, then refresh the list).
 */
export function TripMenu({ tripId, tripName }: { tripId: string; tripName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);





  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) setConfirming(false);
          setOpen((v) => !v);
        }}
        aria-label={`Tùy chọn cho ${tripName}`}
        className="grid size-7 place-items-center rounded-full bg-black/40 text-lg leading-none text-white backdrop-blur transition hover:bg-black/60"
      >
        ⋮
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <span className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
            <Link
              href={`/itinerary/new?id=${tripId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil className="size-3.5" />
              Chỉnh sửa
            </Link>
            {confirming ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void (async () => {
                    try {
                      await itinerariesApi.remove(tripId);
                      clearDraft(tripId);
                      toast({ title: "Đã xóa chuyến đi", description: tripName, variant: "success" });
                      setOpen(false);
                      router.refresh();
                    } catch (e) {
                      toast({
                        title: "Xóa thất bại",
                        description: e instanceof Error ? e.message : undefined,
                        variant: "error",
                      });
                    } finally {
                      setPending(false);
                    }
                  })();
                }}
                className="flex w-full items-center gap-2 bg-rose-50 px-3.5 py-2 text-left text-[13px] font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Xác nhận xóa?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] font-semibold text-rose-500 transition hover:bg-rose-50"
              >
                <Trash2 className="size-3.5" />
                Xóa
              </button>
            )}
          </span>
        </>
      ) : null}
    </span>
  );
}
