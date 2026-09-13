import { Compass, MapPin, Star } from "lucide-react";
import { Logo } from "@/components/layout/logo";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Split-screen auth layout: dark brand panel on the left, form card on the
 * right. Used by login / register / forgot-password.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 lg:block">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #1d4ed8 0, transparent 45%), radial-gradient(circle at 85% 80%, #0ea5e9 0, transparent 40%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Logo />
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
              <Compass className="size-4" />
              VietJourney
            </p>
            <p className="mt-3 max-w-md font-display text-4xl font-bold leading-tight">
              Khám phá Việt Nam theo cách của bạn
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              Hàng trăm điểm đến đã kiểm chứng, lộ trình thông minh và cộng
              đồng du khách đồng hành cùng bạn trên mọi nẻo đường.
            </p>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-4">
              {[
                ["500+", "Điểm đến"],
                ["12k+", "Du khách"],
                ["4.8", "Đánh giá"],
              ].map(([v, k]) => (
                <div key={k} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                  <dt className="sr-only">{k}</dt>
                  <dd className="flex items-center gap-1 text-xl font-black">
                    {k === "Điểm đến" ? (
                      <MapPin className="size-4 text-sky-300" />
                    ) : k === "Du khách" ? (
                      <Compass className="size-4 text-sky-300" />
                    ) : (
                      <Star className="size-4 fill-amber-400 text-amber-400" />
                    )}
                    {v}
                  </dd>
                  <dd className="mt-0.5 text-xs text-slate-300">{k}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-xs text-slate-400">
            © 2026 VietJourney — Bản đồ du lịch Việt Nam
          </p>
        </div>
      </div>

      <div className="grid place-items-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5 sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-5">{children}</div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
