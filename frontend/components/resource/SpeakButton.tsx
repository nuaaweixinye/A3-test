"use client";

import { useEffect, useState } from "react";

/**
 * 通用"朗读"按钮：用浏览器内置语音合成朗读给定文本。
 * 视频卡片（旁白）与辅导回答共用；接入讯飞 TTS 后替换实现。
 */
export function SpeakButton({
  text,
  label = "语音播放",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [speaking, setSpeaking] = useState(false);

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
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!text.trim()}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {speaking ? "⏹ 停止朗读" : `▶ ${label}`}
    </button>
  );
}
