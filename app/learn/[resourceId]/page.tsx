"use client";

import { use } from "react";
import Link from "next/link";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { ResourceDetailLayout } from "@/frontend/components/resource/detail/ResourceDetailLayout";
import { DocDetail } from "@/frontend/components/resource/detail/DocDetail";
import { QuizDetail } from "@/frontend/components/resource/detail/QuizDetail";
import { MindmapDetail } from "@/frontend/components/resource/detail/MindmapDetail";
import { VideoDetail } from "@/frontend/components/resource/detail/VideoDetail";
import { CodeDetail } from "@/frontend/components/resource/detail/CodeDetail";
import { ReadingDetail } from "@/frontend/components/resource/detail/ReadingDetail";
import type { ResourceCardState } from "@/backend/types";

export default function ResourceDetailPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = use(params);
  const card = useLearningStore((s) => s.resourceCards[resourceId]);

  if (!card) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        资源未加载。可能需要先发起一次对话生成资源。
        <Link href="/" className="ml-2 text-blue-600 underline">
          去对话
        </Link>
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
    >
      <DetailContent card={card} />
    </ResourceDetailLayout>
  );
}

function DetailContent({ card }: { card: ResourceCardState }) {
  if (!card.content) {
    return <p className="text-sm text-slate-400">等待智能体产出…</p>;
  }

  switch (card.resType) {
    case "doc":
      return <DocDetail content={card.content} />;
    case "quiz":
      return <QuizDetail content={card.content} topic={card.topic} />;
    case "mindmap":
      return <MindmapDetail content={card.content} />;
    case "video":
      return <VideoDetail content={card.content} />;
    case "code":
      return <CodeDetail content={card.content} />;
    case "reading":
      return <ReadingDetail content={card.content} topic={card.topic} />;
    default:
      return <DocDetail content={card.content} />;
  }
}
