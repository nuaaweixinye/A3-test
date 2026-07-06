"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CodeBlock {
  language: string;
  code: string;
}

function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    blocks.push({
      language: m[1] || "text",
      code: m[2].trim(),
    });
  }
  return blocks;
}

/** Split content into text segments and code blocks */
function parseContent(content: string) {
  const codeBlocks = extractCodeBlocks(content);
  if (codeBlocks.length === 0) {
    return { text: content, codeBlocks: [] };
  }
  // Remove code blocks from text, keep the surrounding markdown
  const text = content.replace(/```(\w+)?\s*\n[\s\S]*?```/g, "").trim();
  return { text, codeBlocks };
}

export function CodeDetail({ content }: { content: string }) {
  const { text, codeBlocks } = parseContent(content);

  return (
    <div className="space-y-4">
      {text && (
        <div className="doc-view">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}

      {codeBlocks.map((block, i) => (
        <CodeBlockView key={i} block={block} />
      ))}
    </div>
  );
}

function CodeBlockView({ block }: { block: CodeBlock }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(block.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-slate-600 px-4 py-2">
        <span className="text-xs font-medium text-slate-300">
          {block.language}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded bg-slate-600 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-500"
        >
          {copied ? "✓ 已复制" : "📋 复制"}
        </button>
      </div>
      <SyntaxHighlighter
        language={block.language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "13px",
          background: "transparent",
        }}
      >
        {block.code}
      </SyntaxHighlighter>
    </div>
  );
}
