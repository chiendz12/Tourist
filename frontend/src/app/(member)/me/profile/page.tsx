import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Heart,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import {
  authApi,
  destinationsApi,
  favoritesApi,
  itinerariesApi,
} from "@/lib/api/services";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { LogoutButton } from "@/components/member/logout-button";
import { formatTripDate } from "@/components/itinerary/types";

const ROLE_VI: Record<string, string> = {
  STUDENT: "Học viên",
  LEADER: "Nhóm trưởng",
  LECTURER: "Giảng viên",
  SUPER_ADMIN: "Quản trị viên",
  MEMBER: "Thành viên",
  GUEST: "Khách",
};

/**
 * User profile: identity card, account details, activity stats,
 * recent trips and security actions.
 */
export default async function ProfilePage() {
  const me = await authApi.me().catch(() => null);
  if (!me) redirect("/login?next=/me/profile");

  const [trips, favorites] = await Promise.all([
    itinerariesApi.mine().catch(() => []),
    favoritesApi.list().catch(() => []),
  ]);
  const saved = await Promise.all(
    favorites.slice(0, 4).map((f) => destinationsApi.get(f.destinationId).catch(() => null)),
  ).then((list) => list.filter((d) => d !== null));

  const initial = (me.fullName ?? me.email).trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-5">
      <Link
        href="/me"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        Chuyến đi của tôi
      </Link>

      <section className="mt-4 overflow-hidden rounded-3xl bg-slate-900 text-white shadow-sm">
        <div
          className="h-28 bg-gradient-to-r from-[#1d4ed8] via-sky-500 to-emerald-400"
          aria-hidden
        />
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <span className="-mt-8 grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#1d4ed8] text-3xl font-black ring-4 ring-slate-900">
            {me.avatarUrl ? (
              <Image src={me.avatarUrl} alt="" width={80} height={80} className="size-full object-cover" unoptimized />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0 flex-1 pb-0.5">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold">
              {me.fullName}
              {me.emailVerified ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
                  <BadgeCheck className="size-3.5" />
                  Đã xác thực
                </span>
              ) : null}
            </h1>
            <p className="mt-0.5 text-sm text-slate-300">
              @{me.username} · {ROLE_VI[me.role] ?? me.role}
            </p>
          </div>
          <span
            className={
              me.isActive
                ? "rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-300"
                : "rounded-full bg-rose-400/15 px-3 py-1.5 text-xs font-bold text-rose-300"
            }
          >
            {me.isActive ? "Đang hoạt động" : "Tạm khóa"}
          </span>
        </div>
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardBody>
              <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <UserIcon className="size-4 text-slate-400" />
                Thông tin tài khoản
              </h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Mail, k: "Email", v: me.email },
                  { icon: UserIcon, k: "Tên tài khoản", v: `@${me.username}` },
                  { icon: Phone, k: "Điện thoại", v: me.phone || "—" },
                  { icon: ShieldCheck, k: "Vai trò", v: ROLE_VI[me.role] ?? me.role },
                  {
                    icon: CalendarDays,
                    k: "Tham gia",
                    v: new Date(me.createdAt).toLocaleDateString("vi-VN"),
                  },
                  { icon: BadgeCheck, k: "Mã người dùng", v: `${me.id.slice(0, 8)}…` },
                ].map((row) => (
                  <div key={row.k} className="rounded-xl bg-slate-50 px-3.5 py-3">
                    <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <row.icon className="size-3.5" />
                      {row.k}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-bold text-slate-800" title={row.v ?? undefined}>
                      {row.v}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs leading-relaxed text-sky-700">
                Đổi tên, số điện thoại và mật khẩu hiện chưa hỗ trợ tự phục vụ — vui lòng
                liên hệ quản trị viên để cập nhật.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Chuyến đi gần đây</h2>
                <Link href="/me" className="text-xs font-bold text-[#1d4ed8] hover:underline">
                  Xem tất cả →
                </Link>
              </div>
              {trips.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Chưa có chuyến đi nào.{" "}
                  <Link href="/itinerary/new" className="font-bold text-[#1d4ed8] hover:underline">
                    Tạo chuyến mới →
                  </Link>
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {trips.slice(0, 5).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/itinerary/new?id=${t.id}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">{t.name}</span>
                          <span className="block text-xs text-slate-500">
                            Cập nhật {formatTripDate(t)}
                          </span>
                        </span>
                        <ArrowLeft className="size-4 rotate-180 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <h2 className="text-base font-bold text-slate-900">Tổng quan</h2>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <dd className="text-2xl font-black text-slate-900">{trips.length}</dd>
                  <dt className="text-xs text-slate-500">Chuyến đi</dt>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <dd className="text-2xl font-black text-slate-900">{favorites.length}</dd>
                  <dt className="text-xs text-slate-500">Đã lưu</dt>
                </div>
              </dl>
              <Link href="/itinerary/new" className={buttonClass({ className: "mt-3 w-full" })}>
                Tạo chuyến mới
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                  <Heart className="size-4 text-rose-500" />
                  Mới lưu
                </h2>
                <Link href="/me?tab=wishlist" className="text-xs font-bold text-[#1d4ed8] hover:underline">
                  Tất cả →
                </Link>
              </div>
              {saved.length === 0 ? (
                <p className="mt-2 text-[13px] text-slate-500">Chưa lưu điểm đến nào.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {saved.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/destinations/${d.slug}`}
                        className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-slate-50"
                      >
                        <MapPin className="size-3.5 shrink-0 text-slate-300" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-700">
                          {d.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">Bảo mật</h2>
              <LogoutButton className={buttonClass({ variant: "outline", className: "w-full" })} />
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <BadgeCheck className="size-3.5" />
                Phiên đăng nhập được bảo vệ bằng cookie httpOnly
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="neutral">{ROLE_VI[me.role] ?? me.role}</Badge>
                {me.emailVerified ? <Badge variant="verify">Email đã xác thực</Badge> : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
