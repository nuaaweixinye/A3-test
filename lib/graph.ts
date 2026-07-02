// 多智能体编排引擎（LangGraph.js StateGraph）
// 赛题硬性要求：须明确"多智能体协同框架"。本图编排三个角色的智能体协同完成学习闭环：
//   画像构建(profile) → 路径规划(planner) → 文档生成(doc)
// 共享状态在节点间流转；doc 节点通过注入的 writer 回调把生成内容流式推送到客户端。

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type {
  GeneratedResource,
  LearningPath,
  ResourceTask,
  StudentProfile,
} from "@/lib/types";
import { extractProfile } from "@/lib/agents/profile-agent";
import { planPath } from "@/lib/agents/planner-agent";
import { generateDoc } from "@/lib/agents/doc-agent";

/** 流式写入回调类型：节点可把增量内容实时推送到 SSE 通道 */
export type StreamWriter = (delta: string) => void;

/** LangGraph 全局共享状态 */
const LearningGraphState = Annotation.Root({
  userMessage: Annotation<string>({
    reducer: (_, y) => y ?? "",
    default: () => "",
  }),
  profile: Annotation<StudentProfile | null>({
    reducer: (_, y) => y ?? null,
    default: () => null,
  }),
  path: Annotation<LearningPath | null>({
    reducer: (_, y) => y ?? null,
    default: () => null,
  }),
  docTask: Annotation<ResourceTask | null>({
    reducer: (_, y) => y ?? null,
    default: () => null,
  }),
  resource: Annotation<GeneratedResource | null>({
    reducer: (_, y) => y ?? null,
    default: () => null,
  }),
});

type GraphConfig = {
  configurable?: {
    writer?: StreamWriter;
    onStatus?: (agent: string, message: string) => void;
  };
};

type ConfigArg = GraphConfig | undefined;

/** 节点 1：画像构建智能体 */
async function profileNode(
  state: typeof LearningGraphState.State,
  config: ConfigArg,
) {
  config?.configurable?.onStatus?.("profile", "正在通过对话构建 6 维度学习画像…");
  const profile = await extractProfile(state.userMessage, state.profile);
  return { profile };
}

/** 节点 2：路径规划智能体 */
async function plannerNode(
  state: typeof LearningGraphState.State,
  config: ConfigArg,
) {
  config?.configurable?.onStatus?.("planner", "正在规划个性化学习路径…");
  const { path, docTask } = await planPath(state.profile!, state.userMessage);
  return { path, docTask };
}

/** 节点 3：文档生成智能体（流式） */
async function docNode(
  state: typeof LearningGraphState.State,
  config: ConfigArg,
) {
  config?.configurable?.onStatus?.("doc", "正在基于知识库生成讲解文档…");
  const writer = config?.configurable?.writer;
  const resource = await generateDoc(state.profile!, state.docTask!, writer);
  return { resource };
}

/** 构建并编译编排图（单例） */
function buildLearningGraph() {
  const graph = new StateGraph(LearningGraphState)
    .addNode("profile_builder", profileNode)
    .addNode("path_planner", plannerNode)
    .addNode("doc_generator", docNode)
    .addEdge(START, "profile_builder")
    .addEdge("profile_builder", "path_planner")
    .addEdge("path_planner", "doc_generator")
    .addEdge("doc_generator", END);
  return graph.compile();
}

export const learningGraph = buildLearningGraph();

/** 运行完整学习闭环，返回流式更新（streamMode: updates） */
export async function runLearningLoop(
  input: { userMessage: string },
  config: GraphConfig,
) {
  return learningGraph.stream(input, {
    streamMode: "updates",
    configurable: config.configurable,
  });
}
