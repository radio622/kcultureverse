"use client";

/**
 * useJourneyPlayer — A→B 우주 여정 자동 재생 (V7.7 Phase 3-1)
 *
 * 역할: Dijkstra 최단 경로 배열(path[])을 순서대로 순회하며
 *       각 정거장에서 미리듣기를 재생하고 카메라를 이동.
 *       마지막 정거장 도착 시 onArrived() 콜백으로 파티클 이펙트 발동.
 *
 * 설계 원칙:
 * - useAutoWarp과 유사하되 '확률 탐색' 대신 '고정 경로' 순회
 * - 각 스텝: 카메라 이동 → 미리듣기 → ended → 1.2초 딜레이 → 다음 스텝
 * - iOS Safari: Audio 싱글톤 재활용 (useAudio.setOnEnded 콜백 방식)
 * - 여정 중 사용자가 다른 노드 클릭 시 stop() 자동 호출
 */

import { useRef, useCallback, useEffect, useState } from "react";

interface JourneyStep {
  nodeId: string;
  name: string;
}

interface UseJourneyPlayerProps {
  /** path[]의 각 아티스트 이름 조회 (nodeId → name) */
  getArtistName: (nodeId: string) => string;
  /** 카메라를 특정 노드로 이동 (GraphCosmos의 focusFlyTo 연결) */
  onNodeFocus: (nodeId: string) => void;
  /** useAudio의 play 함수 */
  audioPlay: (url: string, trackName: string, artistId: string) => void;
  /** useAudio의 setOnEnded — 여정 전용 ended 콜백 등록 */
  audioSetOnEnded: (cb: (() => void) | null) => void;
  /** preview URL 조회 */
  fetchPreview: (name: string) => Promise<{ previewUrl?: string; trackName?: string } | null>;
  /** 마지막 정거장 도착 콜백 */
  onArrived?: (steps: JourneyStep[]) => void;
}

export interface UseJourneyPlayerReturn {
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  steps: JourneyStep[];
  start: (path: string[]) => void;
  stop: () => void;
}

const STEP_DELAY_MS = 1200; // 트랙 종료 후 다음 스텝 전 딜레이

export function useJourneyPlayer({
  getArtistName,
  onNodeFocus,
  audioPlay,
  audioSetOnEnded,
  fetchPreview,
  onArrived,
}: UseJourneyPlayerProps): UseJourneyPlayerReturn {
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps]             = useState<JourneyStep[]>([]);

  const pathRef        = useRef<string[]>([]);
  const stepIndexRef   = useRef(0);
  const playingRef     = useRef(false);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef    = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── 한 스텝 실행 ────────────────────────────────────────────────
  const executeStep = useCallback(async (index: number) => {
    if (!playingRef.current) return;
    if (index >= pathRef.current.length) return;

    const nodeId = pathRef.current[index];
    const name = getArtistName(nodeId);

    // 1. 카메라 이동
    onNodeFocus(nodeId);
    setCurrentStep(index);

    // 2. 미리듣기 fetch
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const result = await fetchPreview(name);
      if (!playingRef.current) return;

      if (result?.previewUrl) {
        audioPlay(result.previewUrl, result.trackName || name, nodeId);
        // ended 이벤트가 오면 다음 스텝 → audioSetOnEnded로 처리됨
      } else {
        // preview 없음 → 3초 대기 후 다음 스텝
        timerRef.current = setTimeout(() => {
          if (!playingRef.current) return;
          const nextIdx = index + 1;
          if (nextIdx < pathRef.current.length) {
            executeStep(nextIdx);
          } else {
            // 도착!
            playingRef.current = false;
            setIsPlaying(false);
            onArrived?.(steps);
          }
        }, 3000);
      }
    } finally {
      fetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getArtistName, onNodeFocus, audioPlay, fetchPreview, onArrived, steps]);

  // ── ended 콜백 등록 ─────────────────────────────────────────────
  useEffect(() => {
    audioSetOnEnded(() => {
      if (!playingRef.current) return;
      const nextIdx = stepIndexRef.current + 1;
      stepIndexRef.current = nextIdx;

      if (nextIdx >= pathRef.current.length) {
        // 마지막 정거장 도착!
        timerRef.current = setTimeout(() => {
          playingRef.current = false;
          setIsPlaying(false);
          onArrived?.(steps);
        }, STEP_DELAY_MS);
      } else {
        timerRef.current = setTimeout(() => {
          if (playingRef.current) executeStep(nextIdx);
        }, STEP_DELAY_MS);
      }
    });

    return () => audioSetOnEnded(null);
  }, [audioSetOnEnded, executeStep, onArrived, steps]);

  // ── 시작 ────────────────────────────────────────────────────────
  const start = useCallback((path: string[]) => {
    if (path.length < 2) return;

    clearTimer();
    fetchingRef.current = false;
    pathRef.current = path;
    stepIndexRef.current = 0;
    playingRef.current = true;

    const journeySteps: JourneyStep[] = path.map((id) => ({
      nodeId: id,
      name: getArtistName(id),
    }));
    setSteps(journeySteps);
    setCurrentStep(0);
    setIsPlaying(true);

    executeStep(0);
  }, [clearTimer, getArtistName, executeStep]);

  // ── 정지 ────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    playingRef.current = false;
    fetchingRef.current = false;
    clearTimer();
    setIsPlaying(false);
    setCurrentStep(0);
    setSteps([]);
    pathRef.current = [];
  }, [clearTimer]);

  return {
    isPlaying,
    currentStep,
    totalSteps: pathRef.current.length,
    steps,
    start,
    stop,
  };
}
