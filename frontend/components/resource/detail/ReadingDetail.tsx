"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReadingItem {
  title: string;
  description: string;
  link?: string;
}

function parseReadingItems(content: string): ReadingItem[] {
  const items: ReadingItem[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const m = line.match(/^\d+\.\s*(.+)/);
    if (m) {
      const text = m[1];
      const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        items.push({
          title: linkMatch[1],
          description: text.replace(/\[([^\]]+)\]\(([^)]+)\)/, "").replace(/^[\s\-—:：]+/, ""),
          link: linkMatch[2],
        });
      } else {
        items.push({ title: text, description: "" });
      }
    }
  }
  if (items.length === 0) {
    // Fallback: bullet list items
    for (const line of lines) {
      const m = line.match(/^[-*]\s+(.+)/);
      if (m) items.push({ title: m[1], description: "" });
    }
  }
  return items;
}

export function ReadingDetail({ content }: { content: string }) {
  const items = parseReadingItems(content);
  const [readSet, setReadSet] = useState<Set<number>>(new Set());

  function toggleRead(i: number) {
    setReadSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
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
          key={i}
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
          >
            {readSet.has(i) ? "✓" : ""}
          </button>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
            {item.description && (
              <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
              >
                阅读原文 ↗
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
