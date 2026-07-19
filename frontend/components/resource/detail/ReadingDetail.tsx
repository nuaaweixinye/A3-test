"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

interface ReadingItem {
  title: string;
  description: string;
  link?: string;
}

function parseReadingItems(content: string): ReadingItem[] {
  const lines = content.split("\n");
  const items: ReadingItem[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const titleMatch =
      line.match(/^\*\*(\d+[.、]\s*.+?)\*\*/u) ||
      line.match(/^#{2,4}\s*(\d+[.、]\s*.+)/u) ||
      line.match(/^(\d+[.、]\s*.+)/u) ||
      line.match(/^[-*]\s+(.+)/u);

    if (!titleMatch) continue;

    const rawTitle = titleMatch[1].replace(/^\d+[.、]\s*/, "").trim();
    const linkMatch = rawTitle.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const descriptionLines: string[] = [];

    for (let next = index + 1; next < lines.length; next++) {
      const nextLine = lines[next].trim();
      if (
        /^\*\*\d+[.、]/u.test(nextLine) ||
        /^#{2,4}\s*\d+[.、]/u.test(nextLine) ||
        /^\d+[.、]\s+/u.test(nextLine)
      ) {
        break;
      }
      if (nextLine && !/^---+$/.test(nextLine)) descriptionLines.push(nextLine);
    }

    items.push({
      title: linkMatch ? linkMatch[1] : rawTitle.replace(/\[([^\]]+)\]\([^)]+\)/, "$1"),
      link: linkMatch?.[2],
      description: descriptionLines.join("\n"),
    });
  }

  return items.slice(0, 8);
}

export function ReadingDetail({ content, topic }: { content: string; topic: string }) {
  const items = parseReadingItems(content);
  const [readSet, setReadSet] = useState<Set<number>>(new Set());

  function toggleRead(i: number) {
    setReadSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    useLearningStore.getState().markViewed(topic);
  }

  if (items.length === 0) {
    return (
      <div className="doc-view">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={`${item.title}-${i}`}
          className={`flex items-start gap-3 rounded-xl border p-4 transition ${
            readSet.has(i)
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <button
            type="button"
            onClick={() => toggleRead(i)}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs transition ${
              readSet.has(i)
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 hover:border-emerald-400"
            }`}
            aria-label={readSet.has(i) ? "标记为未读" : "标记为已读"}
          >
            {readSet.has(i) ? "✓" : ""}
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
            {item.description && (
              <div className="doc-view mt-1 text-xs text-slate-500">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {item.description}
                </ReactMarkdown>
              </div>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-600 hover:underline"
              >
                阅读原文
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
