"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown 讲解文档渲染（依赖 .doc-view 样式，见 globals.css） */
export function DocView({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="doc-view">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
