"use client";

/**
 * 🚀 useAutoWarp — 자율주행(Auto-Warp) + 릴레이 미리듣기
 *
 * ── 핵심 로직 ──
 * 1. 시작 아티스트에서 가중치 확률적 이웃 선택 (adjList 활용)
 * 2. Tabu List (최근 5개) 방문 방지 + 5% 랜덤 점프로 클러스터 고착 탈출
 * 3. 각 노드에서 iTunes 미리듣기 30초 재생 → 끝나면 자동 다음 노드
 * 4. Flight Log (경로 기록) → 부모에서 Supabase 저장
 *
 * ── 사용법 ──
 * const warp = useAutoWarp({ graphData, audioHook, onNodeFocus });
 * warp.start(startNodeId);
 * warp.stop();
 */

import { useState, useCallback, useRef } from "react";
import type { UniverseGraphV5 } from "@/lib/graph-v5";

interface WarpStep {
  nodeId: string;
  name: string;
  timestamp: number;
}

interface UseAutoWarpProps {
  graphData: UniverseGraphV5 | null;
  /** useAudio 훅의 play/stop 함수 */
  audioPlay: (url: string, trackName: string, artistId: string) => void;
  audioStop: () => void;
  /** 노드 포커스 함수 (카메라 이동용) */
  onNodeFocus: (nodeId: string) => void;
}

interface UseAutoWarpReturn {
  isWarping: boolean;
  flightLog: WarpStep[];
  currentStep: number;
  start: (startNodeId: string) => void;
  stop: () => void;
}

const TABU_SIZE = 5;         // 방문 금지 최근 노드 수
const RANDOM_JUMP_RATE = 0.05; // 5% 확률로 전혀 다른 노드로 점프
const WARP_DELAY_MS = 2000;  // 노드 전환 시 2초 대기 (카메라 이동 시간)

export function useAutoWarp({
  graphData,
  audioPlay,
  audioStop,
  onNodeFocus,
}: UseAutoWarpProps): UseAutoWarpReturn {
  const [isWarping, setIsWarping] = useState(false);
  const [flightLog, setFlightLog] = useState<WarpStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const warpingRef = useRef(false);
  const tabuRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioEndListenerRef = useRef<(() => void) | null>(null);

  // ── 가중치 확률적 이웃 선택 ─────────────────────────────────
  const pickNextNode = useCallback((currentId: string): string | null => {
    if (!graphData) return null;

    // 5% 확률 랜덤 점프
    if (Math.random() < RANDOM_JUMP_RATE) {
      const allIds = Object.keys(graphData.nodes);
      const candidates = allIds.filter(id => !tabuRef.current.includes(id));
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    // 이웃 노드 중 tabu에 없는 것만
    const edges = graphData.edges.filter(
      e => e.source === currentId || e.target === currentId
    );

    const neighbors = edges
      .map(e => ({
        id: e.source === currentId ? e.target : e.source,
        weight: e.weight,
      }))
      .filter(n => !tabuRef.current.includes(n.id) && graphData.nodes[n.id]);

    if (neighbors.length === 0) {
      // 모든 이웃 방문 완료 → 랜덤 점프
      const allIds = Object.keys(graphData.nodes);
      const candidates = allIds.filter(id => !tabuRef.current.includes(id));
      return candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : null;
    }

    // 가중치 확률 선택 (Roulette Wheel)
    const totalWeight = neighbors.reduce((s, n) => s + n.weight, 0);
    let r = Math.random() * totalWeight;
    for (const n of neighbors) {
      r -= n.weight;
      if (r <= 0) return n.id;
    }
    return neighbors[neighbors.length - 1].id;
  }, [graphData]);

  // ── iTunes API로 미리듣기 URL 가져오기 (클라이언트 사이드) ───
  const fetchPreview = useCallback(async (artistName: string): Promise<{
    previewUrl: string; trackName: string;
  } | null> => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&media=music&limit=5`
      );
      if (!res.ok) return null;
      const data = await res.json();
      // previewUrl이 있는 곡만 필터 — 아티스트명 일치 우선
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
      const target = normalize(artistName);
      const tracks = (data.results || []).filter(
        (t: any) => t.previewUrl && t.kind === "song"
      );
      if (tracks.length === 0) return null;
      // 아티스트명 일치하는 트랙 우선, 없으면 랜덤
      const matched = tracks.filter((t: any) =>
        normalize(t.artistName ?? "").includes(target)
      );
      const pool = matched.length > 0 ? matched : tracks;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return { previewUrl: pick.previewUrl, trackName: pick.trackName || pick.trackCensoredName };
    } catch {
      return null;
    }
  }, []);

  // ── 한 스텝 실행 ────────────────────────────────────────────
  const executeStep = useCallback(async (nodeId: string) => {
    if (!warpingRef.current || !graphData) return;

    const node = graphData.nodes[nodeId];
    if (!node) return;

    // 1. 카메라 이동
    onNodeFocus(nodeId);

    // 2. Tabu 업데이트
    tabuRef.current.push(nodeId);
    if (tabuRef.current.length > TABU_SIZE) tabuRef.current.shift();

    // 3. Flight Log 기록
    const step: WarpStep = {
      nodeId,
      name: node.nameKo || node.name,
      timestamp: Date.now(),
    };
    setFlightLog(prev => [...prev, step]);
    setCurrentStep(prev => prev + 1);

    // 4. 미리듣기 시도
    const artistName = node.nameKo || node.name;
    const preview = await fetchPreview(artistName);

    if (preview && warpingRef.current) {
      audioPlay(preview.previewUrl, preview.trackName, nodeId);

      // 오디오 끝나면 다음 스텝 (30초 후)
      // 기존 리스너 제거
      if (audioEndListenerRef.current) {
        // Audio ended 이벤트는 useAudio 내부에서 처리되므로
        // 여기서는 타이머로 30초 대기
      }

      // 30초 타이머 (미리듣기 길이)
      timerRef.current = setTimeout(() => {
        if (!warpingRef.current) return;
        const nextId = pickNextNode(nodeId);
        if (nextId) {
          executeStep(nextId);
        } else {
          // 더 이상 갈 곳이 없음
          warpingRef.current = false;
          setIsWarping(false);
          audioStop();
        }
      }, 32000); // 30초 재생 + 2초 카메라 전환 여유
    } else if (warpingRef.current) {
      // 미리듣기 없는 아티스트 → 2초 대기 후 다음
      timerRef.current = setTimeout(() => {
        if (!warpingRef.current) return;
        const nextId = pickNextNode(nodeId);
        if (nextId) {
          executeStep(nextId);
        } else {
          warpingRef.current = false;
          setIsWarping(false);
        }
      }, WARP_DELAY_MS);
    }
  }, [graphData, onNodeFocus, fetchPreview, audioPlay, audioStop, pickNextNode]);

  // ── 시작 ────────────────────────────────────────────────────
  const start = useCallback((startNodeId: string) => {
    if (!graphData || warpingRef.current) return;

    warpingRef.current = true;
    setIsWarping(true);
    setFlightLog([]);
    setCurrentStep(0);
    tabuRef.current = [];

    executeStep(startNodeId);
  }, [graphData, executeStep]);

  // ── 정지 ────────────────────────────────────────────────────
  const stop = useCallback(() => {
    warpingRef.current = false;
    setIsWarping(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    audioStop();
  }, [audioStop]);

  return { isWarping, flightLog, currentStep, start, stop };
}
