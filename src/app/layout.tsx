import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KCultureVerse — K-Culture Universe",
    template: "%s | KCultureVerse",
  },
  description: "K-POP 아티스트의 우주를 탐험하세요. 연결된 아티스트들을 궤도로 시각화합니다.",
  metadataBase: new URL("https://kcultureverse.vercel.app"),
  openGraph: {
    type: "website",
    siteName: "KCultureVerse",
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
      <body>{children}</body>
    </html>
  );
}
