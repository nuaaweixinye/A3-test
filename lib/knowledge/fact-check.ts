// 防幻觉第 3 层：事实核查（fact-check）
// 生成内容完成后，抽取"可核声明"（含复杂度/数值等关键事实），回查知识库交叉验证，
// 给出"有佐证占比 score"与"未找到佐证的声明 flagged"，供前端展示与人工复核。
// 纯本地逻辑，无需密钥即可运行。

import { searchKnowledge } from "@/lib/knowledge/retriever";
import type { FactCheckResult } from "@/lib/types";

/** 极简分词：CJK 逐字 + 拉丁/数字串 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  const regex = /[\u4e00-\u9fa5]|[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(lower)) !== null) {
    if (m[0].length > 1 || /[\u4e00-\u9fa5]/.test(m[0])) tokens.push(m[0]);
  }
  return tokens;
}

/** 把 Markdown 切分为"句子"，剔除代码块/表格/标题等非陈述内容 */
function splitSentences(content: string): string[] {
  const cleaned = content
    .replace(/```[\s\S]*?```/g, " ") // 移除代码块
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // 移除标题标记
    .replace(/^\s{0,3}>/gm, ""); // 移除引用标记
  const parts = cleaned.split(/[。！？\n]/);
  return parts
    .map((p) => p.replace(/\|/g, " ").replace(/[*`_-]/g, "").trim())
    .filter((p) => p.length >= 6 && p.length <= 120);
}

/** 判定是否为"可核声明"：含复杂度 O(...) 或数值类事实 */
function isCheckable(sentence: string): boolean {
  return /O\s*\(|时间复杂度|空间复杂度|\b\d+(\.\d+)?\b/.test(sentence);
}

/** 判断声明与检索到的证据是否在 token 层面有足够重叠 */
function hasOverlap(claim: string, evidenceText: string): boolean {
  const claimTokens = new Set(tokenize(claim));
  const evidenceTokens = new Set(tokenize(evidenceText));
  let hit = 0;
  for (const t of claimTokens) if (evidenceTokens.has(t)) hit++;
  // 至少 2 个内容 token 命中，视为有佐证
  return hit >= 2;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** 对生成内容做事实核查 */
export function factCheck(content: string, topic: string): FactCheckResult {
  const sentences = splitSentences(content);
  const checkable = sentences.filter(isCheckable);
  if (checkable.length === 0) {
    return { score: 100, flagged: [], checked: 0 };
  }

  let withEvidence = 0;
  const flagged: string[] = [];
  for (const s of checkable) {
    const hits = searchKnowledge(`${topic} ${s}`, 2);
    const evidenceText = hits.map((h) => h.text).join(" ");
    if (evidenceText && hasOverlap(s, evidenceText)) {
      withEvidence++;
    } else {
      flagged.push(truncate(s, 60));
    }
  }

  const score = Math.round((withEvidence / checkable.length) * 100);
  return { score, flagged, checked: checkable.length };
}
