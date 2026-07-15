"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function DocDetail({ content }: { content: string }) {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const scrollToId = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  }, []);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.round((el.scrollTop / max) * 100) : 100);
  }

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || toc.length === 0) return;

    const headings = toc
      .map((t) => container.querySelector(`#${CSS.escape(t.id)}`))
      .filter(Boolean) as Element[];

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { root: container, rootMargin: "-10% 0px -80% 0px", threshold: 0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

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
                <button
                  type="button"
                  onClick={() => scrollToId(item.id)}
                  className={`text-left text-xs transition ${
                    activeId === item.id
                      ? "font-medium text-blue-600"
                      : "text-slate-500 hover:text-blue-600"
                  }`}
                >
                  {item.text}
                </button>
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
        ref={scrollRef}
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
