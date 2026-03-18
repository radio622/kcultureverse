import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co", // Spotify 아티스트 이미지
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co", // Spotify 모자이크 이미지
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org", // TMDb (기존 유지)
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "**.mzstatic.com", // iTunes Fallback 이미지 허용
      },
    ],
  },
};

export default nextConfig;
