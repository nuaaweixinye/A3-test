"use client";

import { showToast } from "@/frontend/components/ui/Toast";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { GeneratedResource, ResourceCardState } from "@/backend/types";

export async function regenerateResource(card: ResourceCardState): Promise<boolean> {
  const state = useLearningStore.getState();
  if (!state.profile) {
    showToast("请先完成学习画像构建，再重新生成资源。", "error");
    return false;
  }

  setCardGenerating(card);

  try {
    const response = await fetch("/api/resources/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: card.resType,
        topic: card.topic,
        title: card.title,
        profile: state.profile,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "重新生成失败");

    const resource = data.resource as GeneratedResource;
    useLearningStore.getState().upsertResource({
      ...resource,
      id: card.id,
      title: resource.title || card.title,
      topic: resource.topic || card.topic,
    });
    await useLearningStore.getState().saveRecord();

    if (isFailedResourceContent(resource.content)) {
      showToast("重新生成仍失败：模型请求超时或被限流，请稍后再试。", "error");
      return false;
    }

    showToast("资源已重新生成", "success");
    return true;
  } catch (err) {
    restoreCard(card);
    showToast(err instanceof Error ? err.message : "重新生成失败", "error");
    return false;
  }
}

function setCardGenerating(card: ResourceCardState) {
  useLearningStore.setState((current) => {
    const existing = current.resourceCards[card.id];
    if (!existing) return current;
    return {
      resourceCards: {
        ...current.resourceCards,
        [card.id]: {
          ...existing,
          content: "正在重新生成，请稍候...",
          done: false,
          fact_check: undefined,
          crossCheck: undefined,
        },
      },
    };
  });
}

function restoreCard(card: ResourceCardState) {
  useLearningStore.setState((current) => {
    const existing = current.resourceCards[card.id];
    if (!existing) return current;
    return {
      resourceCards: {
        ...current.resourceCards,
        [card.id]: {
          ...existing,
          content: card.content,
          done: card.done,
          fact_check: card.fact_check,
          crossCheck: card.crossCheck,
        },
      },
    };
  });
}

function isFailedResourceContent(value: string): boolean {
  return /^>\s*生成失败|^生成失败：|请求已取消|接口限流|QPS/i.test(value.trim());
}
