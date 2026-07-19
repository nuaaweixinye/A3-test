"use client";

import { useEffect, useRef } from "react";
import type { StudentProfile } from "@/backend/types";

export function ProfileRadar({ profile }: { profile: StudentProfile | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !profile) return;

    let chart: {
      setOption: (option: unknown) => void;
      resize: () => void;
      dispose: () => void;
    } | null = null;
    let disposed = false;

    (async () => {
      const echarts = await import("echarts");
      if (disposed || !ref.current) return;
      chart = echarts.init(ref.current) as unknown as {
        setOption: (option: unknown) => void;
        resize: () => void;
        dispose: () => void;
      };
      chart.setOption(buildOption(profile));
    })();

    const onResize = () => chart?.resize();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      chart?.dispose();
    };
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
        暂无画像数据，先在首页发起一次学习对话。
      </div>
    );
  }

  return <div ref={ref} className="h-80 w-full" />;
}

function buildOption(profile: StudentProfile) {
  const values = profileToRadarValues(profile);

  return {
    color: ["#2563eb"],
    tooltip: {},
    radar: {
      indicator: [
        { name: "知识基础", max: 100 },
        { name: "兴趣广度", max: 100 },
        { name: "目标清晰", max: 100 },
        { name: "节奏适配", max: 100 },
        { name: "风格明确", max: 100 },
        { name: "错因识别", max: 100 },
      ],
      radius: "68%",
      splitNumber: 4,
      axisName: { color: "#475569", fontSize: 12 },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
      splitArea: { areaStyle: { color: ["#ffffff", "#f8fafc"] } },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: values,
            name: "学习画像",
            areaStyle: { color: "rgba(37, 99, 235, 0.18)" },
            lineStyle: { width: 2 },
            symbolSize: 5,
          },
        ],
      },
    ],
  };
}

function profileToRadarValues(profile: StudentProfile): number[] {
  const knowledgeValues = Object.values(profile.knowledge_level || {});
  const knowledgeAvg = knowledgeValues.length
    ? Math.round(knowledgeValues.reduce((sum, value) => sum + value, 0) / knowledgeValues.length)
    : 0;
  const goalScore = { exam: 92, project: 88, research: 86, interest: 68 }[
    profile.learning_goal
  ];
  const paceScore = { fast: 76, medium: 92, slow: 72 }[profile.learning_pace];
  const styleScore = profile.cognitive_style ? 86 : 35;
  const errorScore = Math.min((profile.error_patterns?.length || 0) * 22, 100);

  return [
    knowledgeAvg,
    Math.min((profile.interests?.length || 0) * 18, 100),
    goalScore,
    paceScore,
    styleScore,
    errorScore,
  ];
}
