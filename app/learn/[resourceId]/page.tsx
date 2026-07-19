"use client";

import { use, useState } from "react";
import Link from "next/link";
import { CodeDetail } from "@/frontend/components/resource/detail/CodeDetail";
import { DocDetail } from "@/frontend/components/resource/detail/DocDetail";
import { MindmapDetail } from "@/frontend/components/resource/detail/MindmapDetail";
import { PptDetail } from "@/frontend/components/resource/detail/PptDetail";
import { QuizDetail } from "@/frontend/components/resource/detail/QuizDetail";
import { ReadingDetail } from "@/frontend/components/resource/detail/ReadingDetail";
import { ResourceDetailLayout } from "@/frontend/components/resource/detail/ResourceDetailLayout";
import { VideoDetail } from "@/frontend/components/resource/detail/VideoDetail";
import { regenerateResource } from "@/frontend/lib/regenerate-resource";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { ResourceCardState } from "@/backend/types";

export default function ResourceDetailPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = use(params);
  const card = useLearningStore((state) => state.resourceCards[resourceId]);
  const [regenerating, setRegenerating] = useState(false);

  if (!card) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        <h1 className="text-lg font-semibold text-slate-800">资源未加载</h1>
        <p className="mt-2 text-sm">
          可能需要先发起一次学习对话，或从学习记录中重新选择资源。
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            生成资源
          </Link>
          <Link
            href="/learn"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            返回学习记录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ResourceDetailLayout
      resType={card.resType}
      title={card.title}
      topic={card.topic}
      sources={card.sources}
      factCheck={card.fact_check}
      crossCheck={card.crossCheck}
      content={card.content}
      actions={
        <button
          type="button"
          onClick={async () => {
            setRegenerating(true);
            try {
              await regenerateResource(card);
            } finally {
              setRegenerating(false);
            }
          }}
          disabled={regenerating}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {regenerating ? "重新生成中..." : "重新生成"}
        </button>
      }
    >
      <DetailContent card={card} />
    </ResourceDetailLayout>
  );
}

function DetailContent({ card }: { card: ResourceCardState }) {
  if (!card.content) {
    return <p className="text-sm text-slate-400">等待智能体生成内容...</p>;
  }

  switch (card.resType) {
    case "design":
      return <PptDetail content={card.content} topic={card.topic} />;
    case "doc":
      return <DocDetail content={card.content} />;
    case "quiz":
      return <QuizDetail content={card.content} topic={card.topic} />;
    case "mindmap":
      return <MindmapDetail content={card.content} />;
    case "video":
      return <VideoDetail content={card.content} topic={card.topic} />;
    case "code":
      return <CodeDetail content={card.content} />;
    case "reading":
      return <ReadingDetail content={card.content} topic={card.topic} />;
    default:
      return <DocDetail content={card.content} />;
  }
}
