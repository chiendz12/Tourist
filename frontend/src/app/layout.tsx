import "./globals.css";
import * as React from "react";
import { Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/shell";
import { SiteFooter } from "@/components/layout/footer";

const display = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "VietJourney — Bản đồ du lịch Việt Nam",
  description:
    "Lên kế hoạch tuyến, khám phá điểm đến, đặt tour và lưu chỗ nghỉ cho hành trình Việt Nam của bạn.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={display.variable}>
      <body>
        <Providers>
          <SiteHeader />
          <main className="min-h-[100dvh]">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
