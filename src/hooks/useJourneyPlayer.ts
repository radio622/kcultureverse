"use client";

/**
 * useJourneyPlayer — A→B 우주 여정 자동 재생 (V7.7 Phase 3-1)
 *
 * 역할: Dijkstra 최단 경로 배열(path[])을 순서대로 순회하며
 *       각 정거장에서 미리듣기를 재생하고 카메라를 이동.
 *       마지막 정거장 도착 시 onArrived() 콜백으로 파티클 이펙트 발동.
 *
 * V7.7 연출 플로우 (Bird's Eye → Zoom-In Journey):
 *   1. Bird's Eye View (handleDualSelect가 처리) — 경로 전체 확인
 *   2. start(path) 호출 — 첫 아티스트로 줌인 + 음악 재생
 *   3. 음악이 끝나거나 일정 시간 후 → 다음 아티스트로 서서히 이동
 *   4. 종점 도착 → onArrived 콜백
 *
 * 설계 원칙:
 * - useAutoWarp과 유사하되 '확률 탐색' 대신 '고정 경로' 순회
 * - 각 스텝: 카메라 이동 → 미리듣기 → ended → 딜레이 → 다음 스텝
 * - iOS Safari: Audio 싱글톤 재활용 (useAudio.setOnEnded 콜백 방식)
 * - 여정 중 사용자가 다른 노드 클릭 시 stop() 자동 호출
 * - 여정 시작 시 첫 아티스트 곡을 먼저 fetch해서 대기 시간 최소화
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

// 장미빛 곡이 없는 아티스트에서의 대기 시간
const NO_PREVIEW_WAIT_MS = 2500;
// 트랙 종료 후 → 다음 스텝 이동까지의 부드러운 딜레이
const STEP_TRANSITION_MS = 800;
// 한 스텝 최대 재생 시간 (30초 미리듣기가 없이 재생이 멈추지 않는 상황 방지)
const MAX_STEP_PLAY_MS = 15000;

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
  const stepsRef       = useRef<JourneyStep[]>([]);
  const stepIndexRef   = useRef(0);
  const playingRef     = useRef(false);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef    = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  // ── 다음 스텝으로 진행 ────────────────────────────────────────
  const advanceToNext = useCallback(() => {
    if (!playingRef.current) return;
    clearTimers();

    const nextIdx = stepIndexRef.current + 1;
    stepIndexRef.current = nextIdx;

    if (nextIdx >= pathRef.current.length) {
      // 마지막 정거장 도착!
      timerRef.current = setTimeout(() => {
        playingRef.current = false;
        setIsPlaying(false);
        onArrived?.(stepsRef.current);
      }, STEP_TRANSITION_MS);
    } else {
      timerRef.current = setTimeout(() => {
        if (playingRef.current) executeStep(nextIdx);
      }, STEP_TRANSITION_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, onArrived]);

  // ── 한 스텝 실행 ────────────────────────────────────────────────
  const executeStep = useCallback(async (index: number) => {
    if (!playingRef.current) return;
    if (index >= pathRef.current.length) return;

    const nodeId = pathRef.current[index];
    const name = getArtistName(nodeId);

    // 1. 카메라 이동 (handleArtistSelect가 줌인 + 바텀시트 처리)
    onNodeFocus(nodeId);
    stepIndexRef.current = index;
    setCurrentStep(index);

    // 2. 미리듣기 fetch
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const result = await fetchPreview(name);
      if (!playingRef.current) return;

      if (result?.previewUrl) {
        audioPlay(result.previewUrl, result.trackName || name, nodeId);
        // ended 이벤트가 오면 advanceToNext → audioSetOnEnded로 처리됨
        // 안전장치: 최대 재생 시간 초과 시 강제 진행
        maxTimerRef.current = setTimeout(() => {
          if (playingRef.current && stepIndexRef.current === index) {
            advanceToNext();
          }
        }, MAX_STEP_PLAY_MS);
      } else {
        // preview 없음 → 잠시 대기 후 다음 스텝
        timerRef.current = setTimeout(() => {
          if (!playingRef.current) return;
          advanceToNext();
        }, NO_PREVIEW_WAIT_MS);
      }
    } finally {
      fetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getArtistName, onNodeFocus, audioPlay, fetchPreview, advanceToNext]);

  // ── ended 콜백 등록 ─────────────────────────────────────────────
  useEffect(() => {
    audioSetOnEnded(() => {
      if (!playingRef.current) return;
      advanceToNext();
    });

    return () => audioSetOnEnded(null);
  }, [audioSetOnEnded, advanceToNext]);

  // ── 시작 ────────────────────────────────────────────────────────
  const start = useCallback((path: string[]) => {
    if (path.length < 2) return;

    clearTimers();
    fetchingRef.current = false;
    pathRef.current = path;
    stepIndexRef.current = 0;
    playingRef.current = true;

    const journeySteps: JourneyStep[] = path.map((id) => ({
      nodeId: id,
      name: getArtistName(id),
    }));
    stepsRef.current = journeySteps;
    setSteps(journeySteps);
    setCurrentStep(0);
    setIsPlaying(true);

    executeStep(0);
  }, [clearTimers, getArtistName, executeStep]);

  // ── 정지 ────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    playingRef.current = false;
    fetchingRef.current = false;
    clearTimers();
    setIsPlaying(false);
    setCurrentStep(0);
    setSteps([]);
    pathRef.current = [];
    stepsRef.current = [];
  }, [clearTimers]);

  return {
    isPlaying,
    currentStep,
    totalSteps: pathRef.current.length,
    steps,
    start,
    stop,
  };
}
