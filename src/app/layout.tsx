import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "100 900",
  preload: false,
});
export const metadata: Metadata = {
  title: { default: "Digital Square · Workspace", template: "%s · Digital Square" },
  description: "Digital Square 사내 통합 업무관리 시스템",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${pretendard.className} antialiased`}>{children}</body>
    </html>
  );
}
