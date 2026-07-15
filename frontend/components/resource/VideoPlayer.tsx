"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";

interface Scene {
  narration: string;
  svg: string;
  duration: number;
}

/** 从视频分镜 Markdown 中解析出场景列表 */
function parseScenes(content: string): Scene[] {
  const scenes: Scene[] = [];
  const blocks = content.split(/^##\s+/m).filter((b) => b.includes("分镜"));
  for (const block of blocks) {
    const narrationMatch = block.match(/\*\*旁白\*\*[：:]\s*(.+)/);
    const narration = narrationMatch?.[1]?.trim() ?? "";
    const svgMatch = block.match(/```svg\s*([\s\S]*?)```/);
    const svg = svgMatch?.[1]?.trim() ?? "";
    const durMatch = block.match(/约\s*(\d+)\s*s/i);
    const duration = durMatch ? parseInt(durMatch[1], 10) : 15;
    if (narration || svg) scenes.push({ narration, svg, duration });
  }
  return scenes;
}

/** 教学视频播放器：SVG 动画 + TTS 旁白同步播放 */
export function VideoPlayer({ content }: { content: string }) {
  const scenes = parseScenes(content);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    return stopAll;
  }, [stopAll]);

  // 播放驱动：playing 且 current 变化时，朗读当前分镜 → 完成后自动切下一个
  useEffect(() => {
    if (!playing) return;
    const scene = scenes[current];
    if (!scene) return;
    const advance = () => {
      if (current < scenes.length - 1) {
        setCurrent((c) => c + 1);
      } else {
        setPlaying(false);
        setCurrent(0);
      }
    };
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      scene.narration
    ) {
      const u = new SpeechSynthesisUtterance(scene.narration);
      u.lang = "zh-CN";
      u.rate = 1;
      u.onend = () => {
        timerRef.current = setTimeout(advance, 500);
      };
      u.onerror = () => {
        timerRef.current = setTimeout(advance, scene.duration * 1000);
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } else {
      timerRef.current = setTimeout(advance, scene.duration * 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    };
  }, [playing, current, scenes]);

  function togglePlay() {
    if (playing) {
      stopAll();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  }

  function replay() {
    stopAll();
    setCurrent(0);
    setPlaying(true);
  }

  function jumpTo(index: number) {
    stopAll();
    setCurrent(index);
  }

  if (scenes.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">
        视频内容解析中…
      </div>
    );
  }

  const scene = scenes[current] ?? scenes[0];
  const progress = ((current + 1) / scenes.length) * 100;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      {/* SVG 渲染区 */}
      <div className="relative flex min-h-[200px] items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        {scene.svg ? (
          <div
            key={current}
            className="w-full max-w-md [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(scene.svg, { ADD_TAGS: ["style"], ADD_ATTR: ["class", "style"] }) }}
          />
        ) : (
          <span className="text-sm text-slate-500">（该分镜无图形内容）</span>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">
          分镜 {current + 1}/{scenes.length}
        </span>
      </div>

      {/* 旁白字幕 */}
      {scene.narration && (
        <div className="border-t border-slate-700 bg-slate-800/60 px-4 py-2.5">
          <p className="text-sm leading-relaxed text-slate-200">
            <span className="mr-1.5 text-violet-400">🔊</span>
            {scene.narration}
          </p>
        </div>
      )}

      {/* 进度条 */}
      <div className="h-1 bg-slate-700">
        <div
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 控制栏 */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
        >
          {playing ? "⏸ 暂停" : "▶ 播放"}
        </button>
        <button
          type="button"
          onClick={replay}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-600"
        >
          🔄 重播
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {scenes.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jumpTo(i)}
              className={`h-2 w-2 rounded-full transition ${
                i === current ? "bg-violet-400" : "bg-slate-600 hover:bg-slate-500"
              }`}
              aria-label={`跳转到分镜 ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
