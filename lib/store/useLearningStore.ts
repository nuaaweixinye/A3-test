// 前端全局状态（Zustand）
// 保存画像、学习路径，以及多张资源卡片的流式/已完成状态。

import { create } from "zustand";
import type {
  StudentProfile,
  LearningPath,
  GeneratedResource,
  ResourceCardState,
} from "@/lib/types";

interface StatusUpdate {
  agent: string;
  message: string;
}

interface LearningStore {
  profile: StudentProfile | null;
  path: LearningPath | null;
  status: StatusUpdate | null;
  running: boolean;
  error: string | null;

  /** 多资源卡片：按到达顺序的 id 列表 + 内容映射 */
  resourceOrder: string[];
  resourceCards: Record<string, ResourceCardState>;

  setProfile: (p: StudentProfile) => void;
  setPath: (p: LearningPath) => void;
  setStatus: (s: StatusUpdate | null) => void;
  setRunning: (r: boolean) => void;
  setError: (e: string | null) => void;

  onResourceStart: (p: {
    id: string;
    resType: ResourceCardState["resType"];
    title: string;
    topic: string;
  }) => void;
  onResourceDelta: (id: string, text: string) => void;
  upsertResource: (r: GeneratedResource) => void;
  resetResources: () => void;
}

export const useLearningStore = create<LearningStore>((set) => ({
  profile: null,
  path: null,
  status: null,
  running: false,
  error: null,
  resourceOrder: [],
  resourceCards: {},

  setProfile: (p) => set({ profile: p }),
  setPath: (p) => set({ path: p }),
  setStatus: (status) => set({ status }),
  setRunning: (running) => set({ running }),
  setError: (error) => set({ error }),

  onResourceStart: ({ id, resType, title, topic }) =>
    set((s) => {
      if (s.resourceCards[id]) return s;
      return {
        resourceOrder: [...s.resourceOrder, id],
        resourceCards: {
          ...s.resourceCards,
          [id]: { id, resType, title, topic, content: "", sources: [], done: false },
        },
      };
    }),

  onResourceDelta: (id, text) =>
    set((s) => {
      const card = s.resourceCards[id];
      if (!card) return s;
      return {
        resourceCards: {
          ...s.resourceCards,
          [id]: { ...card, content: card.content + text },
        },
      };
    }),

  upsertResource: (r) =>
    set((s) => {
      const existing = s.resourceCards[r.id];
      return {
        resourceCards: {
          ...s.resourceCards,
          [r.id]: existing
            ? {
                ...existing,
                content: r.content || existing.content,
                sources: r.sources,
                done: true,
              }
            : {
                id: r.id,
                resType: r.type,
                title: r.title,
                topic: r.topic,
                content: r.content,
                sources: r.sources,
                done: true,
              },
        },
        resourceOrder: s.resourceOrder.includes(r.id)
          ? s.resourceOrder
          : [...s.resourceOrder, r.id],
      };
    }),

  resetResources: () => set({ resourceOrder: [], resourceCards: {} }),
}));
