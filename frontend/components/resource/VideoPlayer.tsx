"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { parseLearningGoals, parseVideoScenes } from "@/backend/video/storyboard";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

export function VideoPlayer({ content, topic }: { content: string; topic: string }) {
  const scenes = useMemo(() => parseVideoScenes(content), [content]);
  const goals = useMemo(() => parseLearningGoals(content), [content]);
  const setMastery = useLearningStore((state) => state.setMastery);
  const markViewed = useLearningStore((state) => state.markViewed);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [reflections, setReflections] = useState<Record<number, string>>({});
  const [understood, setUnderstood] = useState<Record<number, boolean>>({});
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

  useEffect(() => stopAll, [stopAll]);

  useEffect(() => {
    if (scenes.length > 0) markViewed(topic);
  }, [markViewed, scenes.length, topic]);

  useEffect(() => {
    if (!playing) return;
    const scene = scenes[current];
    if (!scene) return;

    const advance = () => {
      if (current < scenes.length - 1) {
        setCurrent((value) => value + 1);
      } else {
        setPlaying(false);
      }
    };

    if (typeof window !== "undefined" && "speechSynthesis" in window && scene.narration) {
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.lang = "zh-CN";
      utterance.rate = rate;
      utterance.onend = () => {
        timerRef.current = setTimeout(advance, 500);
      };
      utterance.onerror = () => {
        timerRef.current = setTimeout(advance, scene.duration * 1000);
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      timerRef.current = setTimeout(advance, scene.duration * 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [current, playing, rate, scenes]);

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
    setPlaying(false);
  }

  function step(delta: number) {
    stopAll();
    setPlaying(false);
    setCurrent((value) => Math.min(Math.max(value + delta, 0), scenes.length - 1));
  }

  function markSceneUnderstood() {
    const next = { ...understood, [current]: true };
    setUnderstood(next);
    const mastery = Math.round(
      (Object.values(next).filter(Boolean).length / scenes.length) * 100,
    );
    setMastery(topic, mastery);
  }

  if (scenes.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">
        视频内容解析中...
      </div>
    );
  }

  const scene = scenes[current] ?? scenes[0];
  const progress = ((current + 1) / scenes.length) * 100;
  const totalSeconds = scenes.reduce((sum, item) => sum + item.duration, 0);
  const understoodCount = Object.values(understood).filter(Boolean).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <div className="border-b border-slate-700 bg-slate-950 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">
              微课讲解 · 约 {Math.max(1, Math.round(totalSeconds / 60))} 分钟 · 已理解 {understoodCount}/{scenes.length}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-white">
              {scene.title || `分镜 ${current + 1}`}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>语速</span>
            <select
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white"
            >
              <option value={0.85}>慢速</option>
              <option value={1}>标准</option>
              <option value={1.2}>快速</option>
            </select>
          </div>
        </div>

        {goals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {goals.map((goal) => (
              <span
                key={goal}
                className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
              >
                {goal}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex min-h-[240px] items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        {scene.svg ? (
          <div
            key={current}
            className="w-full max-w-md [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(scene.svg, {
                ADD_TAGS: ["style"],
                ADD_ATTR: ["class", "style"],
              }),
            }}
          />
        ) : (
          <span className="text-sm text-slate-500">该分镜暂无图形内容</span>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">
          分镜 {current + 1}/{scenes.length}
        </span>
      </div>

      {(scene.keyPoint || scene.narration || scene.visual || scene.prompt) && (
        <div className="border-t border-slate-700 bg-slate-800/60 px-4 py-3">
          {scene.keyPoint && (
            <p className="mb-2 text-xs font-medium text-emerald-300">
              关键点：{scene.keyPoint}
            </p>
          )}
          {scene.narration && (
            <p className="text-sm leading-relaxed text-slate-200">{scene.narration}</p>
          )}
          {scene.visual && (
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              画面：{scene.visual}
            </p>
          )}
          {scene.prompt && (
            <div className="mt-3 rounded-lg bg-slate-950/80 p-3">
              <p className="text-xs font-medium text-amber-200">
                暂停思考：{scene.prompt}
              </p>
              <textarea
                value={reflections[current] ?? ""}
                onChange={(event) =>
                  setReflections((prev) => ({
                    ...prev,
                    [current]: event.target.value,
                  }))
                }
                placeholder="写一句你的理解..."
                className="mt-2 min-h-16 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={markSceneUnderstood}
                className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-amber-400"
              >
                标记本段已理解
              </button>
            </div>
          )}
        </div>
      )}

      <div className="h-1 bg-slate-700">
        <div
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <ControlButton disabled={current === 0} onClick={() => step(-1)}>
          上一段
        </ControlButton>
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
        >
          {playing ? "暂停" : "播放讲解"}
        </button>
        <ControlButton disabled={current === scenes.length - 1} onClick={() => step(1)}>
          下一段
        </ControlButton>
        <ControlButton onClick={replay}>重播</ControlButton>
        <ControlButton onClick={() => setShowTranscript((value) => !value)}>
          {showTranscript ? "收起讲稿" : "完整讲稿"}
        </ControlButton>
        <div className="ml-auto flex items-center gap-1.5">
          {scenes.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => jumpTo(index)}
              className={`h-2.5 w-2.5 rounded-full transition ${
                understood[index]
                  ? "bg-emerald-400"
                  : index === current
                    ? "bg-violet-400"
                    : "bg-slate-600 hover:bg-slate-500"
              }`}
              title={item.title || `分镜 ${index + 1}`}
              aria-label={`跳转到分镜 ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {showTranscript && (
        <div className="border-t border-slate-700 bg-slate-950 px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {scenes.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                type="button"
                onClick={() => jumpTo(index)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  index === current
                    ? "border-violet-400 bg-violet-500/10"
                    : "border-slate-700 bg-slate-900 hover:border-slate-500"
                }`}
              >
                <p className="text-xs font-semibold text-slate-100">
                  {index + 1}. {item.title || "分镜讲解"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                  {item.narration}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ControlButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
