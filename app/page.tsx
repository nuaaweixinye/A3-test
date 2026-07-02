import { ChatPanel } from "@/components/chat/ChatPanel";

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 py-8 text-white shadow-sm">
        <h1 className="text-2xl font-bold sm:text-3xl">
          个性化资源生成与学习多智能体系统
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">
          通过自然语言对话，多智能体协同为你构建 6 维度学习画像、规划学习路径，
          并基于课程知识库（数据结构与算法）生成讲解文档、防幻觉引用。
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge>画像构建 Agent</Badge>
          <Badge>路径规划 Agent</Badge>
          <Badge>文档生成 Agent</Badge>
          <Badge>RAG · 防幻觉</Badge>
        </div>
      </section>

      <section>
        <ChatPanel />
      </section>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
      {children}
    </span>
  );
}
