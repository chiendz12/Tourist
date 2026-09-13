"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { ratingsApi } from "@/lib/api/services";
import { qk } from "@/lib/query/keys";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/session";
import Link from "next/link";
import { classNames } from "@/lib/utils";

export function ReviewForm({ destinationId }: { destinationId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSession();
  const { toast } = useToast();

  const [score, setScore] = React.useState(5);
  const [review, setReview] = React.useState("");

  const mutation = useMutation({
    mutationFn: () =>
      ratingsApi.create({
        destinationId,
        score,
        review: review.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.ratings(destinationId) });
      setReview("");
      toast({
        title: "Đã gửi đánh giá",
        variant: "success",
      });
      router.refresh();
    },
    onError: () => {
      toast({
        title: "Không gửi được",
        description: "Vui lòng đăng nhập hoặc thử lại sau.",
        variant: "error",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Đăng nhập
        </Link>{" "}
        để viết đánh giá cho điểm đến này.
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setScore(i)}
            aria-label={`${i} sao`}
            className="p-1"
          >
            <Star
              className={classNames(
                "size-5 transition-colors",
                i <= score
                  ? "fill-amber-500 text-amber-500"
                  : "fill-transparent text-slate-300",
              )}
            />
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor={`review-${destinationId}`}>Nhận xét (tuỳ chọn)</Label>
        <Input
          id={`review-${destinationId}`}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn..."
        />
      </div>
      <Button
        type="submit"
        size="sm"
        loading={mutation.isPending}
        disabled={mutation.isPending}
      >
        Gửi đánh giá
      </Button>
    </form>
  );
}
