import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { search as sparkSearch } from "./spark-kb";

export interface KnowledgeChunk {
  id: string;
  text: string;
  source: string;
  score?: number;
}

interface LocalDoc {
  id: string;
  source: string;
  text: string;
}

let localDocsCache: Promise<LocalDoc[]> | null = null;
let warnedCloudSearch = false;

export async function searchKnowledge(
  query: string,
  k = 5,
): Promise<KnowledgeChunk[]> {
  try {
    const results = await sparkSearch(query, k);
    if (results.length > 0) {
      return results.map((r) => ({
        id: r.id,
        text: r.text,
        source: r.source,
        score: r.score,
      }));
    }
  } catch (err) {
    if (!warnedCloudSearch) {
      warnedCloudSearch = true;
      console.warn(
        `ChatDoc 知识库暂不可用，已切换到本地资料检索/AI补全：${friendlyError(err)}`,
      );
    }
  }

  return searchLocalKnowledge(query, k);
}

export function formatContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return "（知识库暂无直接相关内容。请基于学习目标、学生画像和通用可靠知识补全；涉及具体事实、版本、数据或外部链接时请标注“建议核验”。）";
  }

  return chunks
    .map((c) => `【来源：${c.source}】\n${c.text}`)
    .join("\n\n---\n\n");
}

async function searchLocalKnowledge(
  query: string,
  k: number,
): Promise<KnowledgeChunk[]> {
  const docs = await getLocalDocs();
  if (docs.length === 0) return [];

  const terms = tokenize(query);
  const scored = docs
    .map((doc) => {
      const lower = doc.text.toLowerCase();
      const score =
        terms.reduce((sum, term) => sum + countOccurrences(lower, term), 0) +
        (lower.includes(query.toLowerCase()) ? 5 : 0);
      return { doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored.map(({ doc, score }) => ({
    id: doc.id,
    source: doc.source,
    text: trimChunk(doc.text, query),
    score,
  }));
}

function getLocalDocs(): Promise<LocalDoc[]> {
  localDocsCache ??= loadLocalDocs();
  return localDocsCache;
}

async function loadLocalDocs(): Promise<LocalDoc[]> {
  const roots = [
    path.join(/* turbopackIgnore: true */ process.cwd(), "docs"),
    path.join(/* turbopackIgnore: true */ process.cwd(), "knowledge"),
    path.join(/* turbopackIgnore: true */ process.cwd(), "knowledge_base"),
  ];
  const files: string[] = [];

  for (const root of roots) files.push(...(await listTextFiles(root)));

  for (const file of ["README.md", "CONTRIBUTING.md"]) {
    files.push(path.join(/* turbopackIgnore: true */ process.cwd(), file));
  }

  const docs: LocalDoc[] = [];
  for (const file of [...new Set(files)]) {
    try {
      const text = await readFile(file, "utf8");
      const cleaned = text.replace(/\s+/g, " ").trim();
      if (!cleaned) continue;
      docs.push({
        id: `local-${docs.length + 1}`,
        source: path.relative(/* turbopackIgnore: true */ process.cwd(), file),
        text: cleaned.slice(0, 12000),
      });
    } catch {
      // 忽略无法读取的本地文件。
    }
  }
  return docs;
}

async function listTextFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listTextFiles(fullPath);
        if (entry.isFile() && /\.(md|txt|json|csv)$/i.test(entry.name)) {
          return [fullPath];
        }
        return [];
      }),
    );
    return nested.flat();
  } catch {
    return [];
  }
}

function tokenize(value: string): string[] {
  const compact = value.toLowerCase();
  const latin = compact.match(/[a-z0-9_]{2,}/g) ?? [];
  const chinese = compact.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const bigrams = chinese.flatMap((word) => {
    const tokens: string[] = [];
    for (let i = 0; i < word.length - 1; i++) tokens.push(word.slice(i, i + 2));
    return tokens;
  });
  return [...new Set([...latin, ...chinese, ...bigrams])].slice(0, 80);
}

function countOccurrences(text: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function trimChunk(text: string, query: string): string {
  const term = tokenize(query)[0];
  const index = term ? text.toLowerCase().indexOf(term) : -1;
  const start = Math.max(0, index === -1 ? 0 : index - 800);
  return text.slice(start, start + 2200);
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/405/.test(message)) return "ChatDoc 检索接口返回 405，请检查知识库接口地址/版本";
  return message;
}
