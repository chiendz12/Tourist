"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { useSession } from "@/lib/auth/session";

export default function LoginPage() {
  return (
    <AuthShell
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để xem lộ trình và đặt chỗ của bạn."
      footer={
        <p>
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="font-bold text-[#1d4ed8] hover:underline"
          >
            Tạo tài khoản
          </Link>
        </p>
      }
    >
      <React.Suspense fallback={<LoginSkeleton />}>
        <LoginForm />
      </React.Suspense>
    </AuthShell>
  );
}

function LoginSkeleton() {
  return <div className="h-32 w-full animate-pulse rounded-md bg-slate-100" />;
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/me";
  const { isAuthenticated, isLoading } = useSession();

  // Already signed in (e.g. bounced here with a valid session): go straight
  // to the destination instead of sitting on the form.
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(next);
  }, [isAuthenticated, isLoading, next, router]);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string } | string;
        };
        const msg =
          (typeof data.error === "object" && data.error?.message) ||
          data.error ||
          "Đăng nhập thất bại";
        setError(String(msg));
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
        Đăng nhập
      </Button>
    </form>
  );
}
