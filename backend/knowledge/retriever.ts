// 最小 RAG 检索器（防幻觉第 1 层：检索约束）
//
// 设计取舍：最小闭环阶段采用"关键词重叠"检索，零外部依赖、免密钥即可运行，
// 满足"基于知识库生成、避免凭空编造"的核心诉求。
// 后续可平滑替换为 Chroma + BGE-M3 向量检索（见 README 路线图）。

import fs from "node:fs";
import path from "node:path";

export interface KnowledgeChunk {
  id: string;
  text: string;
  source: string;
}

let cache: KnowledgeChunk[] | null = null;

/** 极简分词：CJK 逐字 + 拉丁/数字串 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  const regex = /[\u4e00-\u9fa5]|[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(lower)) !== null) {
    if (m[0].length > 1 || /[\u4e00-\u9fa5]/.test(m[0])) {
      tokens.push(m[0]);
    }
  }
  return tokens;
}

/** 将一篇 Markdown 按 ## 标题切分为若干 chunk */
function splitIntoChunks(text: string, source: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const parts = text.split(/\n##\s/);
  parts.forEach((part, i) => {
    const body = (i === 0 ? part : "## " + part).trim();
    if (!body) return;
    // 过长段落进一步按句切分
    const maxLen = 500;
    const pieces = body.match(new RegExp(`[\\s\\S]{1,${maxLen}}(?=\\n|$)`, "g")) ?? [body];
    pieces.forEach((piece, j) => {
      chunks.push({
        id: `${source}-${i}-${j}`,
        text: piece.trim(),
        source,
      });
    });
  });
  return chunks;
}

/** 加载并缓存知识库（backend/knowledge_base/*.md） */
function load(): KnowledgeChunk[] {
  if (cache) return cache;
  const chunks: KnowledgeChunk[] = [];
  const dir = path.join(process.cwd(), "backend", "knowledge_base");
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const text = fs.readFileSync(path.join(dir, file), "utf-8");
      const source = file.replace(/\.md$/, "");
      chunks.push(...splitIntoChunks(text, source));
    }
  }
  cache = chunks;
  return chunks;
}

/** 清除缓存（测试/热更新知识库时使用） */
export function resetKnowledgeCache(): void {
  cache = null;
}

/** 关键词重叠检索：返回与 query 最相关的 top-k chunk */
export function searchKnowledge(query: string, k = 5): KnowledgeChunk[] {
  const chunks = load();
  if (chunks.length === 0) return [];
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return chunks.slice(0, k);

  const scored = chunks.map((c) => {
    const cTokens = tokenize(c.text);
    let overlap = 0;
    for (const t of cTokens) if (queryTokens.has(t)) overlap++;
    // TF 归一化，避免长文档天然占优
    return { c, score: overlap / Math.sqrt(cTokens.length || 1) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, k)
    .filter((s) => s.score > 0)
    .map((s) => s.c);
}

/** 将 chunk 列表拼装为给 LLM 的上下文字符串 */
export function formatContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "（知识库中暂无直接相关内容）";
  return chunks
    .map((c) => `【来源：${c.source}】\n${c.text}`)
    .join("\n\n---\n\n");
}
