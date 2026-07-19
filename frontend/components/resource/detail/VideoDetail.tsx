"use client";

import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "@/frontend/components/resource/VideoPlayer";

interface RenderResult {
  videoUrl: string;
  filename: string;
  duration: number;
  scenes: number;
  hasAudio: boolean;
}

export function VideoDetail({ content, topic }: { content: string; topic: string }) {
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !content.trim()) return;
    startedRef.current = true;
    void renderVideo();
    // The render request intentionally uses the initial resource content for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  async function renderVideo() {
    setRendering(true);
    setError("");
    try {
      const response = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, topic }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "视频生成失败");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "视频生成失败");
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">真实视频生成</h2>
            <p className="mt-1 text-xs text-slate-500">
              打开视频资源后自动渲染带旁白音轨的 MP4，需要服务器已配置 ffmpeg。
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {result
              ? result.hasAudio
                ? "已生成 · 有声音"
                : "已生成"
              : rendering
                ? "自动生成中..."
                : error
                  ? "生成未完成"
                  : "等待生成"}
          </span>
        </div>

        {error && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <span>{error}</span>
            <button
              type="button"
              onClick={renderVideo}
              disabled={rendering}
              className="rounded-lg bg-amber-500 px-2.5 py-1 font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              重试
            </button>
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <video
              src={result.videoUrl}
              controls
              className="aspect-video w-full rounded-xl bg-black"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {result.scenes} 个分镜
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {result.duration} 秒
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                已合成旁白音轨
              </span>
              <a
                href={result.videoUrl}
                download={result.filename}
                className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100"
              >
                下载视频
              </a>
            </div>
          </div>
        )}
      </section>

      <VideoPlayer content={content} topic={topic} />
    </div>
  );
}
