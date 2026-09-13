"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  Briefcase,
  Clock3,
  Heart,
  Home,
  Map as MapIcon,
  Pencil,
  Settings,
  Sparkles,
} from "lucide-react";
import type { CurrentUser } from "@/lib/api/types";
import { classNames } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const CAMP_IMG =
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=600&auto=format&fit=crop";

/**
 * Dark sidebar of the member dashboard: profile, section nav, settings
 * and the upgrade promo.
 */
export function MemberSidebar({ user }: { user: CurrentUser | null }) {
  const search = useSearchParams();
  const tab = search.get("tab") ?? "planning";
  const { toast } = useToast();
  const initial = (user?.fullName ?? user?.email ?? "K").trim().charAt(0).toUpperCase();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const item = (
    href: string,
    icon: React.ReactNode,
    label: string,
    active = false,
    onClick?: () => void,
    badge?: string,
  ) => (
    <Link
      key={label}
      href={href}
      onClick={onClick}
      className={classNames(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
        active ? "bg-[#1d4ed8] text-white shadow" : "text-slate-300 hover:bg-white/5 hover:text-white",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-300">
          {badge}
        </span>
      ) : null}
    </Link>
  );

  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-[#0a1628] p-4 text-white">
      <Link href="/" className="flex items-center gap-2 px-1.5">
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white shadow-sm">
          <MapIcon className="size-4" />
        </span>
        <span className="text-lg font-extrabold tracking-tight">
          <span className="text-white">Viet</span>
          <span className="text-sky-400">Journey</span>
        </span>
      </Link>

      <div className="mt-5 flex items-center gap-3 px-1.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1d4ed8] text-lg font-black">
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">
            {user?.fullName ?? "Du khách"}
          </span>
          <span className="mt-0.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
            {user?.role === "SUPER_ADMIN"
              ? "Admin"
              : user?.role === "LECTURER"
                ? "Giảng viên"
                : user?.role === "LEADER"
                  ? "Nhóm trưởng"
                  : user?.role === "STUDENT"
                    ? "Học viên"
                    : "Member"}
          </span>
        </span>
      </div>

      <nav className="mt-5 space-y-1">
        {item("/", <Home className="size-[18px]" />, "Trang chủ")}
        {item("/map", <MapIcon className="size-[18px]" />, "Bản đồ cá nhân")}
        {item("/me?tab=planning", <Briefcase className="size-[18px]" />, "Chuyến đi của tôi", tab === "planning")}
        {user && ["STUDENT", "LEADER", "LECTURER", "SUPER_ADMIN"].includes(user.role)
          ? item("/studio/enter", <Pencil className="size-[18px]" />, "Nhập dữ liệu")
          : null}
        <button
          type="button"
          onClick={() => scrollTo("saved")}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <Bookmark className="size-[18px]" />
          <span className="flex-1">Điểm đã lưu</span>
        </button>
        {item("/me?tab=wishlist", <Heart className="size-[18px]" />, "Yêu thích", tab === "wishlist")}
        <span
          title="Sắp hỗ trợ"
          className="flex cursor-default items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-500"
        >
          <Clock3 className="size-[18px]" />
          <span className="flex-1">Lịch sử đánh giá</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">
            Sắp có
          </span>
        </span>
      </nav>

      <div className="mt-6 space-y-1 border-t border-white/10 pt-4">
        <span
          title="Sắp hỗ trợ"
          className="flex cursor-default items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400"
        >
          <Settings className="size-[18px]" />
          Cài đặt tài khoản
        </span>
      </div>

      <div className="mt-auto pt-6">
        <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CAMP_IMG} alt="Cắm trại dưới bầu trời sao" className="h-32 w-full object-cover" loading="lazy" />
          <div className="p-3.5">
            <p className="flex items-center gap-1 text-sm font-bold">
              Nâng cấp tài khoản
              <Sparkles className="size-3.5 text-amber-400" />
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Mở khóa nhiều tính năng cao cấp hơn
            </p>
            <button
              type="button"
              onClick={() =>
                toast({
                  title: "Sắp ra mắt",
                  description: "Gói tài khoản cao cấp đang được hoàn thiện.",
                  variant: "info",
                })
              }
              className="mt-2.5 w-full rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white transition hover:bg-emerald-400"
            >
              Nâng cấp ngay
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
