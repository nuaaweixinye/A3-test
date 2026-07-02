// 前端全局状态（Zustand）
// 保存画像、学习路径、生成的资源以及流式文档的累加文本。

import { create } from "zustand";
import type {
  StudentProfile,
  LearningPath,
  GeneratedResource,
} from "@/lib/types";

interface StatusUpdate {
  agent: string;
  message: string;
}

interface LearningStore {
  profile: StudentProfile | null;
  path: LearningPath | null;
  resources: GeneratedResource[];
  streamingDoc: string;
  status: StatusUpdate | null;
  running: boolean;
  error: string | null;

  setProfile: (p: StudentProfile) => void;
  setPath: (p: LearningPath) => void;
  addResource: (r: GeneratedResource) => void;
  appendDoc: (delta: string) => void;
  setStatus: (s: StatusUpdate | null) => void;
  setRunning: (r: boolean) => void;
  setError: (e: string | null) => void;
  resetDoc: () => void;
}

export const useLearningStore = create<LearningStore>((set) => ({
  profile: null,
  path: null,
  resources: [],
  streamingDoc: "",
  status: null,
  running: false,
  error: null,

  setProfile: (p) => set({ profile: p }),
  setPath: (p) => set({ path: p }),
  addResource: (r) => set((s) => ({ resources: [...s.resources, r] })),
  appendDoc: (delta) =>
    set((s) => ({ streamingDoc: s.streamingDoc + delta })),
  setStatus: (status) => set({ status }),
  setRunning: (running) => set({ running }),
  setError: (error) => set({ error }),
  resetDoc: () => set({ streamingDoc: "" }),
}));
