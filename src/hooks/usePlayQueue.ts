"use client";

/**
 * usePlayQueue — 연속 재생 큐 (V7.7)
 *
 * 역할: 아티스트 포커스 시 연관 아티스트 목록을 큐로 구성하고,
 *       현재 트랙이 끝나면(onEnded) 자동으로 다음 아티스트의 미리듣기를 재생.
 *
 * 설계 원칙:
 * - useAudio.setOnEnded()를 통해 ended 이벤트를 수신
 * - 큐는 "현재 포커스 아티스트 > 인접 노드들 가중치 순" 으로 구성
 * - iOS Safari의 ended 미발화 문제는 useAudio에서 progress >= 0.97로 대응
 * - 사용자가 수동으로 다른 트랙 클릭 시 큐 초기화
 */

import { useRef, useCallback, useEffect } from "react";

interface QueueItem {
  artistId: string;
  artistName: string;
  previewUrl?: string;
}

interface UsePlayQueueProps {
  /** useAudio 훅의 play, setOnEnded 함수 */
  audioPlay: (url: string, trackName: string, artistId: string) => void;
  audioSetOnEnded: (cb: (() => void) | null) => void;
  /** /api/spotify/preview?name= 형태의 fetch 함수 */
  fetchPreview: (name: string) => Promise<{ previewUrl?: string; trackName?: string } | null>;
}

export function usePlayQueue({
  audioPlay,
  audioSetOnEnded,
  fetchPreview,
}: UsePlayQueueProps) {
  const queueRef    = useRef<QueueItem[]>([]);    // 재생 대기 큐
  const currentRef  = useRef<number>(-1);          // 현재 큐 인덱스
  const enabledRef  = useRef(false);               // 연속 재생 활성 여부
  const fetchingRef = useRef(false);               // 중복 fetch 방지

  // ── 다음 트랙 재생 로직 ────────────────────────────────────────
  const playNext = useCallback(async () => {
    if (!enabledRef.current) return;
    if (fetchingRef.current) return;

    const nextIndex = currentRef.current + 1;
    if (nextIndex >= queueRef.current.length) {
      // 큐 소진 → 큐의 처음으로 순환 (반복 재생)
      currentRef.current = -1;
    }

    const targetIndex = currentRef.current + 1;
    if (targetIndex >= queueRef.current.length) return;

    const item = queueRef.current[targetIndex];
    if (!item) return;

    currentRef.current = targetIndex;
    fetchingRef.current = true;

    try {
      if (item.previewUrl) {
        audioPlay(item.previewUrl, item.artistName, item.artistId);
      } else {
        // previewUrl 없으면 서버에서 조회
        const result = await fetchPreview(item.artistName);
        if (result?.previewUrl && enabledRef.current) {
          audioPlay(result.previewUrl, result.trackName || item.artistName, item.artistId);
          // 조회 결과를 캐시해서 다음 순환 시 재사용
          queueRef.current[targetIndex] = { ...item, previewUrl: result.previewUrl };
        }
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [audioPlay, fetchPreview]);

  // ── onEnded 콜백 등록 (마운트 한 번만) ───────────────────────
  useEffect(() => {
    audioSetOnEnded(() => {
      // ended 이벤트 수신 → 조건부로 다음 곡 재생
      if (enabledRef.current) {
        // 짧은 딜레이로 오디오 상태가 안정화된 후 재생
        setTimeout(playNext, 800);
      }
    });

    return () => {
      // 언마운트 시 콜백 해제
      audioSetOnEnded(null);
    };
  }, [audioSetOnEnded, playNext]);

  // ── 큐 설정 (아티스트 포커스 시 호출) ────────────────────────
  const setQueue = useCallback((items: QueueItem[], startIndex = 0) => {
    queueRef.current = items;
    currentRef.current = startIndex - 1; // playNext에서 +1 처리되므로 -1로 설정
    enabledRef.current = true;
    fetchingRef.current = false;
  }, []);

  // ── 연속 재생 비활성화 (사용자 수동 조작 시) ─────────────────
  const disableQueue = useCallback(() => {
    enabledRef.current = false;
    fetchingRef.current = false;
  }, []);

  // ── 연속 재생 활성화 (수동 조작 후 재개 시) ─────────────────
  const enableQueue = useCallback(() => {
    enabledRef.current = true;
  }, []);

  // ── 이전 트랙 재생 ────────────────────────────────────────
  const playPrev = useCallback(async () => {
    if (!enabledRef.current) return;
    if (fetchingRef.current) return;
    const prevIndex = currentRef.current - 1;
    if (prevIndex < 0) return; // 처음이면 무시
    currentRef.current = prevIndex;
    fetchingRef.current = true;
    const item = queueRef.current[prevIndex];
    if (!item) { fetchingRef.current = false; return; }
    try {
      if (item.previewUrl) {
        audioPlay(item.previewUrl, item.artistName, item.artistId);
      } else {
        const result = await fetchPreview(item.artistName);
        if (result?.previewUrl && enabledRef.current) {
          audioPlay(result.previewUrl, result.trackName || item.artistName, item.artistId);
          queueRef.current[prevIndex] = { ...item, previewUrl: result.previewUrl };
        }
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [audioPlay, fetchPreview]);

  return { setQueue, disableQueue, enableQueue, playNext, playPrev };
}
