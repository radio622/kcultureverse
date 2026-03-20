"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface AudioState {
  isPlaying: boolean;
  currentTrackName: string | null;
  currentArtistId: string | null;
  progress: number;
}

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
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

  const play = useCallback(async (previewUrl: string, trackName: string, artistId: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    // 같은 곡이면 스킵
    if (audio.src === previewUrl && !audio.paused) return;

    // ✨ 핵심 UI 즉시 갱신 (오디오 다운로드 대기 전에 라벨부터 변경)
    setState((prev) => ({
      ...prev,
      currentTrackName: trackName,
      currentArtistId: artistId,
      isPlaying: true,
      progress: 0
    }));

    // 이전 곡 페이드아웃
    if (!audio.paused) {
      await fadeOut(audio, 250);
    }

    audio.src = previewUrl;
    audio.volume = 0;

    try {
      await audio.play();
      fadeIn(audio, 0.75, 400);
    } catch {
      // autoplay 정책 차단 — 조용히 실패 (이름은 놔두고 애니메이션만 멈춤)
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, [fadeOut, fadeIn]);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    fadeOut(audioRef.current, 400).then(() => {
      setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
    });
  }, [fadeOut]);

  // 진행률 업데이트
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        const p = audio.currentTime / audio.duration;
        progressRef.current = p;
        setState((prev) => ({ ...prev, progress: p }));
      }
    };

    const onEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
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

  return {
    play,
    stop,
    isPlaying: state.isPlaying,
    currentTrackName: state.currentTrackName,
    currentArtistId: state.currentArtistId,
    progress: state.progress,
  };
}
