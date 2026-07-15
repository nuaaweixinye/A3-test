import { streamLearning } from "@/frontend/lib/sse-client";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { AgentEvent } from "@/backend/types";

let activeController: AbortController | null = null;

export async function startLearning(message: string): Promise<void> {
  if (activeController) activeController.abort();

  activeController = new AbortController();

  const store = useLearningStore.getState();
  store.resetResources();
  store.setRunning(true);
  store.setError(null);
  store.setStatus({ agent: "system", message: "多智能体闭环启动中…" });

  await streamLearning(
    message,
    {
      onEvent: (e: AgentEvent) => handleEvent(e),
      onError: (err) => {
        const s = useLearningStore.getState();
        s.setError(err.message);
        s.setRunning(false);
        s.setStatus(null);
      },
      onClose: () => {
        const s = useLearningStore.getState();
        s.setRunning(false);
        s.setStatus(null);
      },
    },
    activeController.signal,
  );

  activeController = null;
}

function handleEvent(e: AgentEvent) {
  const s = useLearningStore.getState();
  switch (e.type) {
    case "status":
      s.setStatus({ agent: e.agent, message: e.message });
      break;
    case "profile":
      s.setProfile(e.profile);
      break;
    case "path":
      s.setPath(e.path);
      break;
    case "resource_start":
      s.onResourceStart({
        id: e.id,
        resType: e.resType,
        title: e.title,
        topic: e.topic,
      });
      break;
    case "resource_delta":
      s.onResourceDelta(e.id, e.text);
      break;
    case "resource":
      s.upsertResource(e.resource);
      break;
    case "error":
      s.setError(e.message);
      s.setRunning(false);
      s.setStatus(null);
      break;
    case "done":
      s.setRunning(false);
      s.setStatus(null);
      s.saveRecord();
      break;
  }
}

export function cancelLearning(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
  const s = useLearningStore.getState();
  s.setRunning(false);
  s.setStatus(null);
}

export function isStreaming(): boolean {
  return activeController !== null;
}
