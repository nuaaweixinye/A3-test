"use client";

import { useLearningStore } from "@/lib/store/useLearningStore";

/** 轻量自评控件：学生对某主题的掌握度滑块（0~100），写入 store.progress 供评估使用 */
export function MasterySlider({ topic }: { topic: string }) {
  const mastery = useLearningStore((s) => s.progress[topic]?.mastery ?? 0);
  const setMastery = useLearningStore((s) => s.setMastery);

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>自评掌握度</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={mastery}
        onChange={(e) => setMastery(topic, Number(e.target.value))}
        className="h-1.5 w-28 accent-blue-600"
        aria-label={`${topic} 掌握度`}
      />
      <span className="w-8 tabular-nums text-slate-600">{mastery}</span>
    </div>
  );
}
