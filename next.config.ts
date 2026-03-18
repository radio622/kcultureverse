import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TMDb 이미지 CDN 허용
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
