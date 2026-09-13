"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      email: String(form.get("email") ?? ""),
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? "") || undefined,
    };

    try {
      const res = await fetch("/session/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string } | string;
        };
        const msg =
          (typeof data.error === "object" && data.error?.message) ||
          data.error ||
          "Tạo tài khoản thất bại";
        setError(String(msg));
        return;
      }
      router.replace("/me");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      subtitle="Tạo tài khoản để lưu chỗ và theo dõi lộ trình của bạn."
      footer={
        <p>
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-bold text-[#1d4ed8] hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      }
    >
          <form className="space-y-3" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="fullName">Họ và tên</Label>
              <Input id="fullName" name="fullName" autoComplete="name" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <Label htmlFor="username">Tên tài khoản</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                minLength={3}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Điện thoại (tuỳ chọn)</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" />
            </div>
            <div>
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
              Tạo tài khoản
            </Button>
          </form>
    </AuthShell>
  );
}
