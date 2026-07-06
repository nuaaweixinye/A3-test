"use client";

import { VideoPlayer } from "@/frontend/components/resource/VideoPlayer";

export function VideoDetail({ content }: { content: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <VideoPlayer content={content} />
    </div>
  );
}
