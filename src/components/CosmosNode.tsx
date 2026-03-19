"use client";

import { useState } from "react";
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
  const [imgError, setImgError] = useState(false);

  const glowColor = isCore
    ? "0 0 24px var(--accent-glow), 0 0 48px var(--accent-glow)"
    : isFocused
    ? "0 0 16px var(--accent-glow)"
    : "0 0 8px rgba(167, 139, 250, 0.15)";

  const initial = artist.name.charAt(0).toUpperCase();
  const showImage = !!artist.imageUrl && !imgError;

  // 이니셜 배경 색상을 아티스트 이름 기반으로 결정 (같은 아티스트는 항상 같은 색)
  const hue = (artist.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 47) % 360;
  const initialBg = `hsl(${hue},35%,20%)`;
  const initialColor = `hsl(${hue},70%,70%)`;

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
          border: `2px solid ${
            isCore
              ? "var(--accent-core)"
              : isFocused
              ? "rgba(167,139,250,0.6)"
              : "rgba(255,255,255,0.15)"
          }`,
          boxShadow: glowColor,
          animation: isCore ? "core-pulse 3s ease-in-out infinite" : undefined,
          flexShrink: 0,
          position: "relative",
          background: showImage ? "var(--bg-nebula)" : initialBg,
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
      >
        {showImage ? (
          <Image
            src={artist.imageUrl!}
            alt={artist.name}
            width={size}
            height={size}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
            onError={() => setImgError(true)}
            unoptimized={false}
          />
        ) : (
          /* 이미지 없거나 실패 → 이니셜 fallback */
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.38,
              fontWeight: 700,
              color: initialColor,
            }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* 이름 라벨 — data-label으로 Dynamic Fog 연동 */}
      <span
        data-label="true"
        style={{
          fontSize: isCore ? 13 : 10,
          fontWeight: isCore ? 600 : 400,
          color: isCore
            ? "var(--text-primary)"
            : isFocused
            ? "var(--text-primary)"
            : "var(--text-secondary)",
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
