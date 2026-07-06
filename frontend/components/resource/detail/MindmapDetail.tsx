"use client";

import { useState } from "react";

interface TreeNode {
  text: string;
  children: TreeNode[];
}

function parseMindmap(content: string): TreeNode | null {
  const lines = content.split("\n").filter((l) => {
    const trimmed = l.trim();
    return trimmed.startsWith("-") || trimmed.startsWith("#");
  });

  if (lines.length === 0) return null;

  // Find root: first # heading or first top-level - item
  let rootText = "主题";
  const h1Match = content.match(/^#\s+(.+)/m);
  if (h1Match) {
    rootText = h1Match[1].trim();
  }

  // Parse bullet list into tree based on indentation
  const bulletLines: { indent: number; text: string }[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("#")) continue;
    const indent = line.search(/\S/);
    const text = line.trim().replace(/^[-*]\s+/, "");
    bulletLines.push({ indent, text });
  }

  if (bulletLines.length === 0) {
    return { text: rootText, children: [] };
  }

  // Normalize indents (find minimum indent as level 0)
  const minIndent = Math.min(...bulletLines.map((l) => l.indent));
  const normalized = bulletLines.map((l) => ({
    ...l,
    level: Math.round((l.indent - minIndent) / 2),
  }));

  // Build tree
  const root: TreeNode = { text: rootText, children: [] };
  const stack: TreeNode[] = [root];

  for (const item of normalized) {
    const node: TreeNode = { text: item.text, children: [] };
    // Pop stack to correct level
    while (stack.length > item.level + 1) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root;
}

export function MindmapDetail({ content }: { content: string }) {
  const tree = parseMindmap(content);

  if (!tree) {
    return (
      <div className="doc-view">
        <pre className="whitespace-pre-wrap text-sm">{content}</pre>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <TreeView node={tree} isRoot />
    </div>
  );
}

function TreeView({ node, isRoot }: { node: TreeNode; isRoot?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div className={isRoot ? "" : "ml-4"}>
      <div className="flex items-center gap-1.5 py-1">
        {hasChildren && (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-4 w-4 items-center justify-center text-xs text-slate-400 hover:text-slate-600"
          >
            {collapsed ? "▶" : "▼"}
          </button>
        )}
        <span
          className={`rounded px-2 py-0.5 text-sm ${
            isRoot
              ? "bg-blue-600 font-bold text-white"
              : hasChildren
                ? "bg-blue-50 font-medium text-blue-700"
                : "bg-slate-50 text-slate-600"
          }`}
        >
          {node.text}
        </span>
      </div>
      {hasChildren && !collapsed && (
        <div className="ml-3 border-l border-slate-200 pl-3">
          {node.children.map((child, i) => (
            <TreeView key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
