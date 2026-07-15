"use client";

import { useRef, useEffect, useMemo } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";

const transformer = new Transformer();

export function MindmapDetail({ content }: { content: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  const isValid = useMemo(() => {
    if (!content) return false;
    try {
      const { root } = transformer.transform(content);
      return !!(root && root.children?.length);
    } catch {
      return false;
    }
  }, [content]);

  useEffect(() => {
    if (!svgRef.current || !isValid) return;

    const { root } = transformer.transform(content);
    if (!root) return;

    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, {
        duration: 300,
        maxWidth: 310,
        spacingHorizontal: 80,
        spacingVertical: 16,
        paddingX: 12,
        autoFit: true,
      }, root);
    } else {
      mmRef.current.setData(root);
      mmRef.current.fit();
    }
  }, [content, isValid]);

  useEffect(() => {
    return () => {
      mmRef.current?.destroy();
      mmRef.current = null;
    };
  }, []);

  if (!isValid) {
    return (
      <div className="doc-view">
        <pre className="whitespace-pre-wrap text-sm">{content}</pre>
      </div>
    );
  }

  return (
    <div className="flex justify-center rounded-xl bg-slate-50 p-4">
      <svg
        ref={svgRef}
        className="h-[500px] w-full max-w-3xl"
      />
    </div>
  );
}
