import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",          // Spotify CDN 아티스트 이미지
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",      // Spotify 모자이크 이미지
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",      // TMDb
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "**.mzstatic.com",     // iTunes / Apple Music 이미지
      },
      {
        protocol: "https",
        hostname: "lastfm.freetls.fastly.net", // Last.fm 아티스트 이미지 (fallback)
      },
      {
        protocol: "https",
        hostname: "*.discogs.com",       // Discogs 아티스트 이미지 (fallback)
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org", // Wikimedia / Wikipedia 이미지
      },
    ],
    // 최적화 품질
    formats: ["image/avif", "image/webp"],
    // 로컬 캐시 TTL (1일)
    minimumCacheTTL: 86400,
  },
  // 실험적: 큰 pre-baked JSON 읽기 최적화
  experimental: {
    optimizeServerReact: true,
  },
};

export default nextConfig;
