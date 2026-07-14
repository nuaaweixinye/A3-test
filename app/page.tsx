import { ChatPanel } from "@/frontend/components/chat/ChatPanel";
import { AgentPipeline } from "@/frontend/components/chat/AgentPipeline";

export default function Home() {
  return (
    <div className="space-y-4">
      <section className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-white shadow-sm">
        <span className="text-xl">🎓</span>
        <div className="flex-1">
          <h1 className="text-base font-bold">个性化资源生成</h1>
          <p className="text-xs text-blue-100">
            多智能体协同 · 画像 → 路径 → 6 种学习资源并行生成
          </p>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          {["画像", "规划", "文档", "题库", "导图", "视频", "代码", "阅读"].map(
            (t) => (
              <span
                key={t}
                className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] ring-1 ring-white/20"
              >
                {t}
              </span>
            ),
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section>
          <ChatPanel />
        </section>
        <section>
          <AgentPipeline />
        </section>
      </div>
    </div>
  );
}
