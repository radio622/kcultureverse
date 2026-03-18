"use client";

import { useRef, useEffect, useCallback } from "react";
import type { CosmosArtist } from "@/lib/types";
import ArtistCard from "./ArtistCard";

interface Props {
  satellites: CosmosArtist[];
  focusedIndex: number | null;
  onSnap: (index: number) => void;
  onDive: (spotifyId: string) => void;
  isVisible: boolean;
}

export default function ResonanceDeck({
  satellites,
  focusedIndex,
  onSnap,
  onDive,
  isVisible,
}: Props) {
  const deckRef = useRef<HTMLDivElement>(null);
  const isScrollingFromFocus = useRef(false);

  // focusedIndex 변경 → 해당 카드로 스크롤
  useEffect(() => {
    if (focusedIndex === null || !deckRef.current) return;
    const deck = deckRef.current;
    const card = deck.children[focusedIndex] as HTMLElement;
    if (!card) return;

    isScrollingFromFocus.current = true;
    card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    // 프로그래매틱 스크롤 완료 후 플래그 해제
    setTimeout(() => {
      isScrollingFromFocus.current = false;
    }, 600);
  }, [focusedIndex]);

  // 스크롤 스냅 감지 → onSnap 호출
  const handleScroll = useCallback(() => {
    if (isScrollingFromFocus.current || !deckRef.current) return;
    const deck = deckRef.current;
    const deckRect = deckRef.current.getBoundingClientRect();
    const centerX = deckRect.left + deckRect.width / 2;

    let closestIndex = 0;
    let closestDist = Infinity;

    Array.from(deck.children).forEach((child, i) => {
      const rect = (child as HTMLElement).getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    });

    if (closestIndex !== focusedIndex) {
      onSnap(closestIndex);
    }
  }, [focusedIndex, onSnap]);

  if (!isVisible) return null;

  return (
    <div
      ref={deckRef}
      className="resonance-deck"
      onScroll={handleScroll}
      role="listbox"
      aria-label="관련 아티스트"
    >
      {satellites.map((satellite, i) => (
        <div key={satellite.spotifyId} className="resonance-deck__card" role="option">
          <ArtistCard
            artist={satellite}
            isActive={focusedIndex === i}
            onDive={() => onDive(satellite.spotifyId)}
          />
        </div>
      ))}
    </div>
  );
}
