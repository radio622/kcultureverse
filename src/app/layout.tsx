import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: {
    default: "K-Culture Universe — 음악 우주를 탐험하세요",
    template: "%s | K-Culture Universe",
  },
  description: "K-culture 아티스트들의 관계망을 별자리처럼 탐험하는 인터랙티브 음악 지도.",
  metadataBase: new URL("https://kcultureverse.vercel.app"),
  openGraph: {
    type: "website",
    siteName: "K-Culture Universe",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060a14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {/* 전역 ErrorBoundary — 렌더링 오류 시 우주 테마 에러 UI 표시 */}
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
