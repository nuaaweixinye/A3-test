"use client";

import { useEffect, useRef } from "react";

type Chart = {
  setOption: (o: unknown) => void;
  resize: () => void;
  dispose: () => void;
};

/** 评估页：各主题掌握度雷达 */
export function EvalRadar({
  topics,
  mastery,
}: {
  topics: string[];
  mastery: Record<string, number>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || topics.length === 0) return;
    let chart: Chart | null = null;
    let disposed = false;

    (async () => {
      const echarts = await import("echarts");
      if (disposed || !ref.current) return;
      chart = echarts.init(ref.current) as unknown as Chart;
      chart.setOption({
        radar: {
          indicator: topics.map((t) => ({ name: t, max: 100 })),
          shape: "polygon",
          splitNumber: 4,
        },
        series: [
          {
            type: "radar",
            data: [
              {
                value: topics.map((t) => mastery[t] ?? 0),
                name: "掌握度",
                areaStyle: { color: "rgba(16,185,129,0.25)" },
                lineStyle: { color: "#10b981" },
                itemStyle: { color: "#10b981" },
              },
            ],
          },
        ],
      });
    })();

    const onResize = () => chart?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      chart?.dispose();
    };
  }, [topics, mastery]);

  if (topics.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed text-sm text-slate-400">
        暂无主题数据
      </div>
    );
  }
  return <div ref={ref} className="h-72 w-full" />;
}
