"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface AudioState {
  isPlaying: boolean;
  currentTrackName: string | null;
  currentArtistId: string | null;
  progress: number;
}

export function useAudio() {
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const fadeRef      = useRef<number>(0);
  const progressRef  = useRef<number>(0);
  const onEndedRef   = useRef<(() => void) | null>(null);  // V7.7: 연속 재생 훅 연결용
  const endFiredRef  = useRef(false);                      // iOS 중복 발화 방지
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    currentTrackName: null,
    currentArtistId: null,
    progress: 0,
  });


  // 볼륨 페이드 유틸
  const fadeOut = useCallback((audio: HTMLAudioElement, ms: number): Promise<void> => {
    return new Promise((resolve) => {
      cancelAnimationFrame(fadeRef.current);
      const start = performance.now();
      const startVol = audio.volume;

      function step(now: number) {
        const t = Math.min((now - start) / ms, 1);
        audio.volume = startVol * (1 - t);
        if (t < 1) {
          fadeRef.current = requestAnimationFrame(step);
        } else {
          audio.pause();
          audio.volume = 0;
          resolve();
        }
      }
      fadeRef.current = requestAnimationFrame(step);
    });
  }, []);

  const fadeIn = useCallback((audio: HTMLAudioElement, targetVol: number, ms: number) => {
    cancelAnimationFrame(fadeRef.current);
    const start = performance.now();

    function step(now: number) {
      const t = Math.min((now - start) / ms, 1);
      audio.volume = targetVol * t;
      if (t < 1) {
        fadeRef.current = requestAnimationFrame(step);
      }
    }
    fadeRef.current = requestAnimationFrame(step);
  }, []);

  // 세대 카운터: stop의 비동기 콜백이 새 play보다 뒤에 실행되는 것을 방지
  const genRef = useRef(0);

  const play = useCallback(async (previewUrl: string, trackName: string, artistId: string) => {
    const thisGen = ++genRef.current;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    // 같은 곡이면 스킵 (일시정지 상태라면 재생부터 재개)
    if (audio.src === previewUrl) {
      if (audio.paused) {
        audio.volume = 0;
        try {
          await audio.play();
          fadeIn(audio, 0.75, 400);
          if (genRef.current === thisGen) {
            setState((prev) => ({ ...prev, isPlaying: true }));
          }
        } catch {
          if (genRef.current === thisGen) {
            setState((prev) => ({ ...prev, isPlaying: false }));
          }
        }
      }
      return;
    }

    // ✨ 핵심 UI 즉시 갱신 (오디오 다운로드 대기 전에 라벨부터 변경)
    setState((prev) => ({
      ...prev,
      currentTrackName: trackName,
      currentArtistId: artistId,
      isPlaying: true,
      progress: 0
    }));

    // 이전 fadeOut/fadeIn 즉시 취소
    cancelAnimationFrame(fadeRef.current);

    // 이전 곡이 재생 중이면 즉시 정지 (비동기 fadeOut 대신 즉시 전환)
    if (!audio.paused) {
      audio.pause();
    }

    audio.src = previewUrl;
    audio.volume = 0;
    endFiredRef.current = false;  // 새 곡 시작 시 ended 플래그 초기화

    try {
      await audio.play();
      // play() 성공 후에도 여전히 이 세대가 최신인지 확인
      if (genRef.current === thisGen) {
        fadeIn(audio, 0.75, 400);
      }
    } catch {
      // autoplay 정책 차단 — 조용히 실패 (이름은 놔두고 애니메이션만 멈춤)
      if (genRef.current === thisGen) {
        setState((prev) => ({ ...prev, isPlaying: false }));
      }
    }
  }, [fadeIn]);

  // ── Optimistic announce: fetch 대기 중에도 즉각 아티스트 이름 표시 ──
  // previewUrl이 없어 fetch를 해야 할 때, fetch 시작과 동시에 호출.
  // play()가 나중에 호출되면 실제 트랙명으로 덮어쓰임.
  const announce = useCallback((artistName: string, artistId: string) => {
    setState((prev) => ({
      ...prev,
      currentTrackName: artistName,
      currentArtistId: artistId,
      isPlaying: true,
      progress: 0,
    }));
  }, []);

  // 부드러운 정지 (일반 UI 조작용 — 페이드아웃 후 정지)
  const stop = useCallback(() => {
    if (!audioRef.current) return;
    const stopGen = ++genRef.current; // 새 세대 시작 — 이전 play의 콜백 무효화
    fadeOut(audioRef.current, 400).then(() => {
      // 이 세대가 여전히 최신일 때만 상태 업데이트 (중간에 play가 끼어들었으면 무시)
      if (genRef.current === stopGen) {
        setState((prev) => ({ ...prev, isPlaying: false, currentTrackName: null, currentArtistId: null, progress: 0 }));
      }
    });
  }, [fadeOut]);

  const togglePause = useCallback(() => {
    if (!audioRef.current || !audioRef.current.src) return;
    const a = audioRef.current;
    if (a.paused) {
      a.volume = 0;
      a.play().then(() => {
        fadeIn(a, 0.75, 400);
        setState((prev) => ({ ...prev, isPlaying: true }));
      }).catch(() => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      });
    } else {
      fadeOut(a, 250).then(() => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      });
    }
  }, [fadeIn, fadeOut]);

  // 진행률 업데이트
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        const p = audio.currentTime / audio.duration;
        progressRef.current = p;
        setState((prev) => ({ ...prev, progress: p }));
        // V7.7: iOS Safari에서 ended 이벤트가 발화 안 하는 경우 대비
        // progress ≥ 0.97 도달 시 ended와 동일하게 처리
        if (p >= 0.97 && !endFiredRef.current) {
          endFiredRef.current = true;
          setState((prev) => ({ ...prev, isPlaying: false, progress: 1 }));
          onEndedRef.current?.();
        }
      }
    };

    const onEnded = () => {
      if (!endFiredRef.current) {
        endFiredRef.current = true;
        setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
        onEndedRef.current?.();
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      cancelAnimationFrame(fadeRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // V7.7: 외부 훅(usePlayQueue 등)이 ended 이벤트를 수신할 수 있도록 콜백 등록
  const setOnEnded = useCallback((cb: (() => void) | null) => {
    onEndedRef.current = cb;
  }, []);

  return {
    play,
    stop,
    togglePause,
    announce,
    setOnEnded,
    isPlaying: state.isPlaying,
    currentTrackName: state.currentTrackName,
    currentArtistId: state.currentArtistId,
    progress: state.progress,
  };
}
