"use client";

import { useEffect, useRef, useState } from "react";
import { DocView } from "@/components/resource/DocView";
import type { ResourceCardState, ResourceType } from "@/lib/types";

const META: Record<ResourceType, { label: string; badge: string; icon: string }> = {
  doc: { label: "讲解文档", badge: "bg-blue-50 text-blue-700", icon: "📄" },
  quiz: { label: "练习题库", badge: "bg-rose-50 text-rose-700", icon: "❓" },
  mindmap: { label: "思维导图", badge: "bg-amber-50 text-amber-700", icon: "🧠" },
  video: { label: "教学视频", badge: "bg-violet-50 text-violet-700", icon: "🎬" },
  code: { label: "代码实操", badge: "bg-emerald-50 text-emerald-700", icon: "💻" },
  reading: { label: "拓展阅读", badge: "bg-cyan-50 text-cyan-700", icon: "📚" },
};

export function ResourceCard({ card }: { card: ResourceCardState }) {
  const meta = META[card.resType];
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
          >
            {meta.label}
          </span>
          <span className="truncate text-sm font-semibold text-slate-700">
            {card.title}
          </span>
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {card.done ? "✓ 已完成" : "生成中…"}
        </span>
      </header>

      <div className="flex-1">
        {card.content ? (
          <DocView content={card.content} />
        ) : (
          <p className="text-sm text-slate-400">等待智能体产出…</p>
        )}
      </div>

      {card.resType === "video" && card.content && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <SpeakButton content={card.content} />
        </div>
      )}

      {card.sources.length > 0 && card.done && (
        <footer className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400">
          知识库引用：{card.sources.join("、")}
        </footer>
      )}
    </section>
  );
}

/** 视频卡片：用浏览器内置语音合成朗读旁白（占位配音，后续替换为讯飞 TTS） */
function SpeakButton({ content }: { content: string }) {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggle() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = extractNarration(content);
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  const hasNarration = extractNarration(content).length > 0;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!hasNarration}
      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {speaking ? "⏹ 停止朗读" : "▶ 语音播放"}
      <span className="text-[10px] font-normal text-violet-200">
        （浏览器语音占位）
      </span>
    </button>
  );
}

/** 从视频分镜 Markdown 中提取所有"旁白"文本 */
function extractNarration(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/\*\*旁白\*\*[：:]\s*(.*)/);
    if (m && m[1]) out.push(m[1].trim());
  }
  return out.join(" ");
}
