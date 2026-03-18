"use client";

import Image from "next/image";
import type { CosmosArtist } from "@/lib/types";

interface Props {
  artist: CosmosArtist;
  size: number;
  isCore: boolean;
  isFocused: boolean;
  onClick: () => void;
}

export default function CosmosNode({ artist, size, isCore, isFocused, onClick }: Props) {
  const glowColor = isCore
    ? "0 0 24px var(--accent-glow), 0 0 48px var(--accent-glow)"
    : isFocused
    ? "0 0 16px var(--accent-glow)"
    : "0 0 8px rgba(167, 139, 250, 0.15)";

  const initial = artist.name.charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      aria-label={`${artist.name} 선택`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        // 터치 타겟 최소 44px
        minWidth: Math.max(size, 44),
        minHeight: Math.max(size, 44),
        justifyContent: "center",
      }}
    >
      {/* 원형 이미지 */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${isCore ? "var(--accent-core)" : isFocused ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.15)"}`,
          boxShadow: glowColor,
          animation: isCore ? "core-pulse 3s ease-in-out infinite" : undefined,
          flexShrink: 0,
          position: "relative",
          background: "var(--bg-nebula)",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
      >
        {artist.imageUrl ? (
          <Image
            src={artist.imageUrl}
            alt={artist.name}
            width={size}
            height={size}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
            unoptimized={false}
          />
        ) : (
          // 이미지 없을 때 이니셜 fallback
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.38,
              fontWeight: 600,
              color: "var(--accent-core)",
              background: "rgba(167, 139, 250, 0.1)",
            }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* 이름 라벨 */}
      <span
        style={{
          fontSize: isCore ? 13 : 10,
          fontWeight: isCore ? 600 : 400,
          color: isCore ? "var(--text-primary)" : isFocused ? "var(--text-primary)" : "var(--text-secondary)",
          textAlign: "center",
          maxWidth: size + 20,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          transition: "color 0.3s ease",
        }}
      >
        {artist.name}
      </span>
    </button>
  );
}
