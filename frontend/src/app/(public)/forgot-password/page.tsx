"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    toast({
      title: "Giao diện đã sẵn sàng",
      description:
        "Tính năng đặt lại mật khẩu sẽ được bật sau khi backend bổ sung API email.",
      variant: "info",
    });
  }

  return (
    <AuthShell
      title="Quên mật khẩu?"
      subtitle="Nhập email của bạn để nhận hướng dẫn đặt lại mật khẩu."
      footer={
        <Link
          href="/login"
          className="font-bold text-[#1d4ed8] hover:underline"
        >
          ← Quay lại đăng nhập
        </Link>
      }
    >
          {submitted ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Yêu cầu đã được ghi nhận. Khi backend bổ sung email, hướng dẫn sẽ
              được gửi đến {email}.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={onSubmit}>
              <div>
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                Gửi yêu cầu
              </Button>
            </form>
          )}
    </AuthShell>
  );
}
