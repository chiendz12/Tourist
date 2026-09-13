"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { commentsApi } from "@/lib/api/services";
import { qk } from "@/lib/query/keys";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/session";
import Link from "next/link";

export function CommentBox({ destinationId }: { destinationId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSession();
  const { toast } = useToast();

  const [content, setContent] = React.useState("");

  const list = useQuery({
    queryKey: qk.comments(destinationId),
    queryFn: () => commentsApi.forDestination(destinationId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      commentsApi.create({ destinationId, content: content.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.comments(destinationId) });
      setContent("");
      toast({ title: "Đã gửi bình luận", variant: "success" });
      router.refresh();
    },
  });

  if (!isAuthenticated) return null;

  const comments = list.data ?? [];

  return (
    <div className="space-y-4">
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (content.trim()) mutation.mutate();
        }}
      >
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Viết bình luận..."
          className="min-h-[44px]"
        />
        <Button
          type="submit"
          size="md"
          loading={mutation.isPending}
          disabled={!content.trim() || mutation.isPending}
        >
          Gửi
        </Button>
      </form>

      <ul className="space-y-2">
        {comments.map((c) => (
          <Card key={c.id}>
            <CardBody className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {c.user?.fullName ?? "Thành viên"}
              </p>
              <p className="text-sm text-slate-700">{c.content}</p>
              <Link
                href="/login"
                className="hidden text-xs text-slate-500"
                aria-hidden
              >
                <MessageSquare className="size-3 inline" />
              </Link>
            </CardBody>
          </Card>
        ))}
      </ul>
    </div>
  );
}
