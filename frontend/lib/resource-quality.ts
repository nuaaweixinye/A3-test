import type { ResourceCardState } from "@/backend/types";

export interface ResourceQuality {
  score: number;
  level: "high" | "medium" | "low";
  knowledgeSources: string[];
  usesAiSupplement: boolean;
  factScore: number | null;
  crossCheckPassed: boolean | null;
  issues: string[];
}

const AI_SUPPLEMENT_MARK = "AI 基于知识库补充";

export function analyzeResourceQuality(card: ResourceCardState): ResourceQuality {
  const knowledgeSources = card.sources.filter(
    (source) => !source.includes(AI_SUPPLEMENT_MARK),
  );
  const usesAiSupplement =
    card.sources.some((source) => source.includes(AI_SUPPLEMENT_MARK)) ||
    card.content.includes(`参考：${AI_SUPPLEMENT_MARK}`);
  const factScore = card.fact_check?.score ?? null;
  const crossCheckPassed = card.crossCheck?.passed ?? null;
  const issues = [
    ...(card.fact_check?.flagged ?? []),
    ...(card.crossCheck?.issues ?? []),
  ];

  let score = 60;
  if (knowledgeSources.length > 0) score += 15;
  if (knowledgeSources.length >= 2) score += 8;
  if (factScore !== null) score += Math.round((factScore - 70) / 3);
  if (crossCheckPassed === true) score += 12;
  if (crossCheckPassed === false) score -= 18;
  if (usesAiSupplement) score -= 6;
  score -= Math.min(issues.length * 5, 20);
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    level: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
    knowledgeSources,
    usesAiSupplement,
    factScore,
    crossCheckPassed,
    issues,
  };
}

export function qualityLabel(level: ResourceQuality["level"]): string {
  if (level === "high") return "可信度高";
  if (level === "medium") return "需要留意";
  return "等待复核";
}

export function qualityBadgeClass(level: ResourceQuality["level"]): string {
  if (level === "high") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (level === "medium") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}
