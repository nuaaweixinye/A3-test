import { AgentPipeline } from "@/frontend/components/chat/AgentPipeline";
import { ChatPanel } from "@/frontend/components/chat/ChatPanel";

const CAPABILITIES = [
  "对话式画像",
  "动态路径",
  "多 Agent 协同",
  "7 类资源",
  "真实视频",
  "学习评估",
];

const LOOP = [
  "自然语言输入",
  "6 维学习画像",
  "个性化路径规划",
  "多模态资源生成",
  "交叉验证与推送",
  "学习评估调优",
];

export default function Home() {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {CAPABILITIES.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100"
                >
                  {item}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              个性化多模态学习资源生成系统
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              通过自然语言对话自动构建学生画像，规划动态学习路径，并由多个智能体协同生成资源设计/PPT、讲解文档、题库、思维导图、教学视频、代码实操和拓展阅读，实现从学习需求到效果评估的完整闭环。
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">赛题闭环流程</p>
            <div className="grid grid-cols-2 gap-2">
              {LOOP.map((item, index) => (
                <div
                  key={item}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <p className="text-[10px] font-medium text-blue-600">
                    Step {index + 1}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ChatPanel />
        <AgentPipeline />
      </div>
    </div>
  );
}
