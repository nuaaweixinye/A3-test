"use client";

import { useEffect, useRef, useState } from "react";
import { DocDetail } from "@/frontend/components/resource/detail/DocDetail";

interface RenderResult {
  pptUrl: string;
  filename: string;
  slides: number;
}

export function PptDetail({ content, topic }: { content: string; topic: string }) {
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState("");
  const startedRef = useRef("");
  const failedResource = isFailedResourceContent(content);

  useEffect(() => {
    if (failedResource || startedRef.current === content || !content.trim()) return;
    startedRef.current = content;
    void renderPpt();
    // 自动使用当前资源内容生成一次 PPT。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, failedResource]);

  async function renderPpt() {
    if (failedResource) {
      setError("当前资源内容生成失败，请先点击右上角“重新生成”，成功后再生成 PPT。");
      return;
    }
    if (!content.trim()) {
      setError("当前资源内容为空，无法生成 PPT。");
      return;
    }

    setRendering(true);
    setError("");
    try {
      const response = await fetch("/api/ppt/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, topic }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "PPT 生成失败");
      setResult(data as RenderResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PPT 生成失败");
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">PPT 课件自动生成</h2>
            <p className="mt-1 text-xs text-slate-500">
              系统会根据当前学习资源生成 .pptx 文件，可直接下载用于汇报或课堂展示。
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
            {failedResource
              ? "等待资源重新生成"
              : result
                ? `已生成 · ${result.slides} 页`
                : rendering
                  ? "自动生成中..."
                  : "等待生成"}
          </span>
        </div>

        {(error || failedResource) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <span>
              错误信息：
              {error ||
                "当前资源内容是失败占位文本，不会继续生成 PPT。请先重新生成该资源。"}
            </span>
            {!failedResource && (
              <button
                type="button"
                onClick={renderPpt}
                disabled={rendering}
                className="rounded-lg bg-amber-500 px-2.5 py-1 font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                重试
              </button>
            )}
          </div>
        )}

        {result && !failedResource && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-indigo-100">
              {result.slides} 页课件
            </span>
            <a
              href={result.pptUrl}
              download={result.filename}
              className="rounded-full bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
            >
              下载 PPT
            </a>
          </div>
        )}
      </section>

      <DocDetail content={content} />
    </div>
  );
}

function isFailedResourceContent(value: string): boolean {
  return /^>\s*生成失败|^生成失败：|请求已取消|接口限流|QPS/i.test(value.trim());
}
