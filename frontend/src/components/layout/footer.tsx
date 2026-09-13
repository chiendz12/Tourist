"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin } from "lucide-react";

const COLS: Array<{ heading: string; items: Array<{ label: string; href: string }> }> = [
  {
    heading: "Khám phá",
    items: [
      { label: "Điểm đến", href: "/destinations" },
      { label: "Bản đồ", href: "/map" },
      { label: "Tuyến du lịch", href: "/routes" },
      { label: "Tour nổi bật", href: "/tours" },
    ],
  },
  {
    heading: "Hỗ trợ",
    items: [
      { label: "Hướng dẫn sử dụng", href: "/blog" },
      { label: "Câu hỏi thường gặp", href: "/blog" },
      { label: "Liên hệ", href: "/" },
      { label: "Góp ý", href: "/" },
    ],
  },
  {
    heading: "Về chúng tôi",
    items: [
      { label: "Giới thiệu", href: "/" },
      { label: "Điều khoản sử dụng", href: "/" },
      { label: "Chính sách bảo mật", href: "/" },
      { label: "Quy chế hoạt động", href: "/" },
    ],
  },
  {
    heading: "Liên hệ",
    items: [
      { label: "Email: support@vietjourney.vn", href: "/" },
      { label: "Hotline: 1900 1234", href: "/" },
      { label: "Địa chỉ: Hà Nội, Việt Nam", href: "/" },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  // Fullscreen apps (map, member/staff dashboards, entry) have their own chrome.
  const fullscreen =
    pathname === "/map" ||
    pathname === "/me" ||
    pathname === "/studio/enter" ||
    pathname === "/studio/lecturer" ||
    pathname === "/studio/admin" ||
    pathname === "/studio/approvals" ||
    pathname === "/studio/classes";
  if (fullscreen) return null;
  return (
    <footer className="mt-24 bg-[#0a1628] text-slate-300">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_3fr]">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 text-white">
              <MapPin className="size-4" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              <span className="text-white">Viet</span>
              <span className="text-sky-400">Journey</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            Nền tảng bản đồ du lịch thông minh đầu tiên tại Việt Nam dành cho
            cộng đồng yêu du lịch.
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            {["f", "ig", "yt", "tt"].map((s) => (
              <span
                key={s}
                className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-bold text-slate-300"
              >
                {s === "f" ? "f" : s === "ig" ? "◉" : s === "yt" ? "▶" : "♪"}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {COLS.map((col) => (
            <div key={col.heading}>
              <p className="text-sm font-semibold text-white">{col.heading}</p>
              <ul className="mt-3 space-y-2">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 text-xs text-slate-500">
          <span>© 2024 VietJourney. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
