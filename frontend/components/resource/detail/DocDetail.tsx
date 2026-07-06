"use client";

import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function DocDetail({ content }: { content: string }) {
  const [progress, setProgress] = useState(0);

  const toc = useMemo<TocItem[]>(() => {
    const lines = content.split("\n");
    const items: TocItem[] = [];
    for (const line of lines) {
      const m = line.match(/^(#{2,3})\s+(.+)/);
      if (m) {
        const level = m[1].length;
        const text = m[2].replace(/[`*]/g, "").trim();
        const id = text.replace(/\s+/g, "-");
        items.push({ level, text, id });
      }
    }
    return items;
  }, [content]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.round((el.scrollTop / max) * 100) : 100);
  }

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      {toc.length > 1 && (
        <aside className="sticky top-0 hidden self-start md:block">
          <p className="mb-2 text-xs font-medium text-slate-400">目录</p>
          <ul className="space-y-1 border-l border-slate-200 pl-3">
            {toc.map((item) => (
              <li
                key={item.id}
                className={item.level === 3 ? "ml-3" : ""}
              >
                <a
                  href={`#${item.id}`}
                  className="text-xs text-slate-500 transition hover:text-blue-600"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">阅读进度 {progress}%</p>
          </div>
        </aside>
      )}

      <div
        onScroll={onScroll}
        className="doc-view max-h-[70vh] overflow-y-auto pr-2"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => {
              const id = String(children).replace(/\s+/g, "-");
              return <h2 id={id}>{children}</h2>;
            },
            h3: ({ children }) => {
              const id = String(children).replace(/\s+/g, "-");
              return <h3 id={id}>{children}</h3>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
