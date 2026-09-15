"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/services";
import { useToast } from "@/components/ui/toast";

/** Duyệt / Từ chối a pending self-registration, then refresh the list. */
export function UserApprovalButtons({ id, fullName }: { id: string; fullName: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const review = useMutation({
    mutationFn: (action: "APPROVE" | "REJECT") => adminApi.reviewUser(id, action),
    onSuccess: (_, action) => {
      toast({
        title: action === "APPROVE" ? `Đã duyệt ${fullName}` : `Đã từ chối ${fullName}`,
        variant: "success",
      });
      router.refresh();
    },
    onError: (e) => {
      toast({
        title: "Thao tác thất bại",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    },
  });

  return (
    <span className="flex shrink-0 gap-1.5">
      <button
        type="button"
        disabled={review.isPending}
        onClick={() => review.mutate("APPROVE")}
        className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40"
      >
        Duyệt
      </button>
      <button
        type="button"
        disabled={review.isPending}
        onClick={() => review.mutate("REJECT")}
        className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
      >
        Từ chối
      </button>
    </span>
  );
}
