// 前端全局状态（Zustand）
// 保存画像、学习路径，以及多张资源卡片的流式/已完成状态。

import { create } from "zustand";
import type {
  StudentProfile,
  LearningPath,
  GeneratedResource,
  ResourceCardState,
  TopicProgress,
} from "@/backend/types";

let profileSyncTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** ⑤评估输入：每个主题的自评掌握度 + 浏览行为 */
  progress: Record<string, TopicProgress>;
  /** 评估回写：需要重点复习的薄弱主题（/learn 上展示徽标） */
  weakTopics: string[];

  user: { id: string; username: string } | null;
  setUser: (user: { id: string; username: string } | null) => void;
  syncProfile: () => void;
  saveRecord: () => Promise<void>;

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

  setMastery: (topic: string, value: number) => void;
  markViewed: (topic: string) => void;
  addViewTime: (topic: string, seconds: number) => void;
  setWeakTopics: (topics: string[]) => void;
  resetProgress: () => void;
}

export const useLearningStore = create<LearningStore>((set) => ({
  profile: null,
  path: null,
  status: null,
  running: false,
  error: null,
  resourceOrder: [],
  resourceCards: {},
  progress: {},
  weakTopics: [],
  user: null,
  setUser: (user) => set({ user }),

  syncProfile: () => {
    if (profileSyncTimer) clearTimeout(profileSyncTimer);
    profileSyncTimer = setTimeout(async () => {
      const state = useLearningStore.getState();
      if (!state.user || !state.profile) return;
      try {
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: state.profile }),
        });
      } catch {
        // best-effort
      }
    }, 3000);
  },

  saveRecord: async () => {
    const state = useLearningStore.getState();
    if (!state.user) return;
    const cards = state.resourceOrder
      .map((id) => state.resourceCards[id])
      .filter(Boolean);
    if (cards.length === 0 || !state.path) return;
    const topic = state.path.steps[0]?.title || "学习记录";
    try {
      await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          path: state.path,
          resources: cards,
          progress: state.progress,
        }),
      });
    } catch {
      // best-effort
    }
  },

  setProfile: (p) => {
    set({ profile: p });
    if (useLearningStore.getState().user) {
      useLearningStore.getState().syncProfile();
    }
  },
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
                fact_check: r.fact_check,
                done: true,
              }
            : {
                id: r.id,
                resType: r.type,
                title: r.title,
                topic: r.topic,
                content: r.content,
                sources: r.sources,
                fact_check: r.fact_check,
                done: true,
              },
        },
        resourceOrder: s.resourceOrder.includes(r.id)
          ? s.resourceOrder
          : [...s.resourceOrder, r.id],
      };
    }),

  resetResources: () => set({ resourceOrder: [], resourceCards: {} }),

  setMastery: (topic, value) =>
    set((s) => {
      const prev = s.progress[topic] ?? { mastery: 0, viewed: false, viewSeconds: 0 };
      return {
        progress: { ...s.progress, [topic]: { ...prev, mastery: value } },
      };
    }),

  markViewed: (topic) =>
    set((s) => {
      const prev = s.progress[topic] ?? { mastery: 0, viewed: false, viewSeconds: 0 };
      if (prev.viewed) return s;
      return {
        progress: { ...s.progress, [topic]: { ...prev, viewed: true } },
      };
    }),

  addViewTime: (topic, seconds) =>
    set((s) => {
      const prev = s.progress[topic] ?? { mastery: 0, viewed: false, viewSeconds: 0 };
      return {
        progress: {
          ...s.progress,
          [topic]: {
            ...prev,
            viewed: true,
            viewSeconds: prev.viewSeconds + seconds,
          },
        },
      };
    }),

  setWeakTopics: (weakTopics) => set({ weakTopics }),

  resetProgress: () => set({ progress: {}, weakTopics: [] }),
}));
