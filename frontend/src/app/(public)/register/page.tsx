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
  const [role, setRole] = React.useState<"STUDENT" | "LECTURER">("STUDENT");
  const [pending, setPending] = React.useState(false);

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
      role,
    };

    try {
      const res = await fetch("/session/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string } | string;
        pending?: boolean;
      };
      if (!res.ok) {
        const msg =
          (typeof data.error === "object" && data.error?.message) ||
          data.error ||
          "Tạo tài khoản thất bại";
        setError(String(msg));
        return;
      }
      if (data.pending) {
        // No session is created: the account waits for reviewer approval.
        setPending(true);
        return;
      }
      router.replace("/me");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) {
    return (
      <AuthShell
        title="Đăng ký thành công"
        subtitle="Tài khoản của bạn đang chờ phê duyệt."
        footer={
          <p>
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-bold text-[#1d4ed8] hover:underline">
              Đăng nhập
            </Link>
          </p>
        }
      >
        <div className="rounded-xl bg-amber-50 px-4 py-5 text-center ring-1 ring-amber-200">
          <p className="text-sm font-bold text-amber-800">
            {role === "LECTURER"
              ? "Tài khoản giảng viên đang chờ quản trị viên duyệt."
              : "Tài khoản sinh viên đang chờ giảng viên hoặc quản trị viên duyệt."}
          </p>
          <p className="mt-1.5 text-[13px] text-amber-700">
            Bạn sẽ nhận được email thông báo ngay khi tài khoản được phê duyệt, sau đó hãy đăng nhập.
          </p>
        </div>
      </AuthShell>
    );
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
              <Label>Bạn đăng ký với vai trò</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Vai trò">
                {(
                  [
                    { value: "STUDENT", label: "Sinh viên", sub: "GV hoặc admin duyệt" },
                    { value: "LECTURER", label: "Giảng viên", sub: "Chỉ admin duyệt" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={role === opt.value}
                    onClick={() => setRole(opt.value)}
                    className={
                      role === opt.value
                        ? "rounded-xl border-2 border-[#1d4ed8] bg-[#1d4ed8]/5 px-3 py-2.5 text-left transition"
                        : "rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-slate-300"
                    }
                  >
                    <span className="block text-sm font-bold text-slate-900">{opt.label}</span>
                    <span className="block text-xs text-slate-500">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
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
