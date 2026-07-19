import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { generateCode } from "@/backend/agents/code-agent";
import { runCrossChecks } from "@/backend/agents/cross-check";
import { generateDesign } from "@/backend/agents/design-agent";
import { generateDoc } from "@/backend/agents/doc-agent";
import { generateMindmap } from "@/backend/agents/mindmap-agent";
import { planPath } from "@/backend/agents/planner-agent";
import { extractProfile } from "@/backend/agents/profile-agent";
import { generateQuiz } from "@/backend/agents/quiz-agent";
import { generateReading } from "@/backend/agents/reading-agent";
import {
  extractAgentContext,
  type AgentContextEntry,
  type Emitter,
} from "@/backend/agents/resource-runner";
import { generateSynthesis } from "@/backend/agents/synthesis-agent";
import { generateVideo } from "@/backend/agents/video-agent";
import type {
  CrossCheckResult,
  GeneratedResource,
  LearningPath,
  ResourceTask,
  ResourceType,
  StudentProfile,
} from "@/backend/types";

type AgentContextMap = Record<string, AgentContextEntry>;

const LearningGraphState = Annotation.Root({
  userMessage: Annotation<string>({ reducer: (_, value) => value ?? "", default: () => "" }),
  profile: Annotation<StudentProfile | null>({
    reducer: (_, value) => value ?? null,
    default: () => null,
  }),
  path: Annotation<LearningPath | null>({
    reducer: (_, value) => value ?? null,
    default: () => null,
  }),
  primaryTopic: Annotation<string>({
    reducer: (_, value) => value ?? "",
    default: () => "",
  }),
  resourceTasks: Annotation<ResourceTask[]>({
    reducer: (_, value) => value ?? [],
    default: () => [],
  }),
  resources: Annotation<GeneratedResource[]>({
    reducer: (current, update) => [...current, ...(update ?? [])],
    default: () => [],
  }),
  agentContext: Annotation<AgentContextMap>({
    reducer: (current, update) => ({ ...current, ...(update ?? {}) }),
    default: () => ({}),
  }),
  crossChecks: Annotation<Record<string, CrossCheckResult>>({
    reducer: (current, update) => ({ ...current, ...(update ?? {}) }),
    default: () => ({}),
  }),
});

type State = typeof LearningGraphState.State;
type GraphConfig = {
  configurable?: {
    emit?: Emitter;
  };
};
type ConfigArg = GraphConfig | undefined;

type AgentFn = (
  profile: StudentProfile,
  task: ResourceTask,
  emit?: Emitter,
) => Promise<GeneratedResource>;

const GENERATORS: Record<ResourceType, AgentFn> = {
  design: generateDesign,
  doc: generateDoc,
  quiz: generateQuiz,
  mindmap: generateMindmap,
  video: generateVideo,
  code: generateCode,
  reading: generateReading,
};

const RESOURCE_LABEL: Record<ResourceType, string> = {
  design: "资源设计/PPT",
  doc: "讲解文档",
  quiz: "练习题库",
  mindmap: "思维导图",
  video: "教学视频",
  code: "代码实操",
  reading: "拓展阅读",
};

async function profileNode(state: State, config: ConfigArg) {
  config?.configurable?.emit?.({
    type: "status",
    agent: "profile",
    message: "正在通过自然语言对话构建 6 维动态学习画像...",
  });
  const profile = await extractProfile(state.userMessage, state.profile);
  return { profile };
}

async function plannerNode(state: State, config: ConfigArg) {
  config?.configurable?.emit?.({
    type: "status",
    agent: "planner",
    message: "正在规划个性化学习路径并分派多模态资源任务...",
  });
  const { path, primaryTopic, resourceTasks } = await planPath(
    state.profile!,
    state.userMessage,
  );
  return { path, primaryTopic, resourceTasks };
}

function makeResourceNode(type: ResourceType) {
  return async (state: State, config: ConfigArg) => {
    const emit = config?.configurable?.emit;
    const task =
      state.resourceTasks.find((item) => item.type === type) ??
      ({ type, topic: state.primaryTopic } as ResourceTask);

    emit?.({
      type: "status",
      agent: type,
      message: `${RESOURCE_LABEL[type]} Agent 正在生成个性化资源...`,
    });

    const resource = await GENERATORS[type](state.profile!, task, emit);
    const entry = extractAgentContext(type, resource.content);

    return {
      resources: [resource],
      agentContext: { [type]: entry },
    };
  };
}

async function synthesisNode(state: State, config: ConfigArg) {
  const emit = config?.configurable?.emit;

  emit?.({
    type: "status",
    agent: "cross-check",
    message: "正在进行跨 Agent 交叉验证和质量核验...",
  });

  let crossChecks: Record<string, CrossCheckResult> = {};
  try {
    crossChecks = await runCrossChecks(state.resources);
  } catch (error) {
    console.error("Cross-check failed:", error);
  }

  const checkedResources = state.resources.map((resource) => {
    const check = crossChecks[resource.id];
    return check ? { ...resource, crossCheck: check } : resource;
  });

  for (const resource of checkedResources) {
    emit?.({ type: "resource", resource });
  }

  emit?.({
    type: "status",
    agent: "synthesis",
    message: "综合导览 Agent 正在整合资源、路径和评估建议...",
  });

  let synthesisResource: GeneratedResource | null = null;
  try {
    synthesisResource = await generateSynthesis({
      profile: state.profile!,
      primaryTopic: state.primaryTopic,
      resources: checkedResources,
      agentContext: state.agentContext,
      emit,
    });
  } catch (error) {
    emit?.({
      type: "error",
      message: `学习导览生成失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const result: Partial<State> = { crossChecks };
  if (synthesisResource) result.resources = [synthesisResource];
  return result;
}

function buildLearningGraph() {
  const graph = new StateGraph(LearningGraphState)
    .addNode("profile_builder", profileNode)
    .addNode("path_planner", plannerNode)
    .addNode("design_gen", makeResourceNode("design"))
    .addNode("doc_gen", makeResourceNode("doc"))
    .addNode("quiz_gen", makeResourceNode("quiz"))
    .addNode("mindmap_gen", makeResourceNode("mindmap"))
    .addNode("video_gen", makeResourceNode("video"))
    .addNode("code_gen", makeResourceNode("code"))
    .addNode("reading_gen", makeResourceNode("reading"))
    .addNode("synthesis_agent", synthesisNode)
    .addEdge(START, "profile_builder")
    .addEdge("profile_builder", "path_planner")
    .addEdge("path_planner", "design_gen")
    .addEdge("design_gen", "doc_gen")
    .addEdge("doc_gen", "quiz_gen")
    .addEdge("quiz_gen", "mindmap_gen")
    .addEdge("mindmap_gen", "video_gen")
    .addEdge("video_gen", "code_gen")
    .addEdge("code_gen", "reading_gen")
    .addEdge("reading_gen", "synthesis_agent")
    .addEdge("synthesis_agent", END);

  return graph.compile();
}

export const learningGraph = buildLearningGraph();

export async function runLearningLoop(
  input: { userMessage: string },
  config: GraphConfig,
) {
  return learningGraph.stream(input, {
    streamMode: "updates",
    configurable: config.configurable,
  });
}
