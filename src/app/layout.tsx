import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

// Space Grotesk: 영문 제목/로고용 (우주 테마에 어울리는 기하학적 폰트)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Inter: 영문 본문용 (가독성 최우수 UI 폰트)
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KCultureVerse — K-Culture 유니버스 맵",
    template: "%s | KCultureVerse",
  },
  description:
    "K-Culture의 인물(배우, 가수, 감독)과 작품(영화, 드라마, 앨범)이 어떻게 연결되어 있는지 3D 우주 지도로 탐험해보세요.",
  keywords: ["K-Culture", "K-Pop", "K-Drama", "한국 드라마", "한류", "인물 관계도", "그래프"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://kcultureverse.vercel.app",
    siteName: "KCultureVerse",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        {/* 우주 배경 그라디언트 (시각적 장식) */}
        <div className="starfield" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
