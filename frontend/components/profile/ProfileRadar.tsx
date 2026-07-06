"use client";

import { useEffect, useRef } from "react";
import type { StudentProfile } from "@/backend/types";

/**
 * 学生画像雷达图（6 轴对应赛题要求的 6 个画像维度）
 * 采用动态 import echarts，确保仅在浏览器端初始化，避免 SSR 报错。
 */
export function ProfileRadar({ profile }: { profile: StudentProfile | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !profile) return;
    let chart: {
      setOption: (o: unknown) => void;
      resize: () => void;
      dispose: () => void;
    } | null = null;
    let disposed = false;

    (async () => {
      const echarts = await import("echarts");
      if (disposed || !ref.current) return;
      chart = echarts.init(ref.current) as unknown as {
        setOption: (o: unknown) => void;
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
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed text-sm text-slate-400">
        暂无画像数据，先在首页发起一次学习对话吧
      </div>
    );
  }

  return <div ref={ref} className="h-80 w-full" />;
}

function buildOption(profile: StudentProfile) {
  const values = profileToRadarValues(profile);
  return {
    radar: {
      indicator: [
        { name: "知识基础", max: 100 },
        { name: "兴趣广度", max: 100 },
        { name: "目标明确", max: 100 },
        { name: "节奏适配", max: 100 },
        { name: "风格清晰", max: 100 },
        { name: "易错关注", max: 100 },
      ],
      shape: "polygon" as const,
      splitNumber: 4,
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: values,
            name: "学习画像",
            areaStyle: { color: "rgba(37,99,235,0.25)" },
            lineStyle: { color: "#2563eb" },
            itemStyle: { color: "#2563eb" },
          },
        ],
      },
    ],
  };
}

/** 把 6 维画像映射为雷达图 0~100 的可量化数值（均为派生指标） */
function profileToRadarValues(p: StudentProfile): number[] {
  const knowledgeVals = Object.values(p.knowledge_level || {});
  const knowledgeAvg = knowledgeVals.length
    ? Math.round(knowledgeVals.reduce((a, b) => a + b, 0) / knowledgeVals.length)
    : 0;
  const goalScore = { exam: 90, project: 85, research: 80, interest: 60 }[
    p.learning_goal
  ];
  const paceScore = { fast: 75, medium: 90, slow: 60 }[p.learning_pace];
  return [
    knowledgeAvg,
    Math.min((p.interests?.length || 0) * 20, 100),
    goalScore,
    paceScore,
    75,
    Math.min((p.error_patterns?.length || 0) * 25, 100),
  ];
}
