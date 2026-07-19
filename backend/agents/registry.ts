import type { ResourceType } from "@/backend/types";

export interface AgentConfig {
  id: ResourceType;
  name: string;
  icon: string;
  description: string;
  temperature: number;
  model?: string;
  timeout: number;
  retryCount: number;
}

const AGENT_CONFIGS: Record<ResourceType, AgentConfig> = {
  design: {
    id: "design",
    name: "资源设计/PPT",
    icon: "P",
    description: "生成资源设计方案和 PPT 页级脚本",
    temperature: 0.55,
    timeout: 300_000,
    retryCount: 2,
  },
  doc: {
    id: "doc",
    name: "讲解文档",
    icon: "文",
    description: "生成个性化课程讲解文档",
    temperature: 0.6,
    timeout: 300_000,
    retryCount: 2,
  },
  quiz: {
    id: "quiz",
    name: "练习题库",
    icon: "题",
    description: "生成多题型练习题和解析",
    temperature: 0.6,
    timeout: 300_000,
    retryCount: 2,
  },
  mindmap: {
    id: "mindmap",
    name: "思维导图",
    icon: "图",
    description: "生成知识点层级导图",
    temperature: 0.5,
    timeout: 240_000,
    retryCount: 2,
  },
  video: {
    id: "video",
    name: "教学视频",
    icon: "视",
    description: "生成分镜脚本并支持渲染 mp4",
    temperature: 0.7,
    timeout: 360_000,
    retryCount: 2,
  },
  code: {
    id: "code",
    name: "代码实操",
    icon: "码",
    description: "生成可运行代码案例",
    temperature: 0.5,
    timeout: 300_000,
    retryCount: 2,
  },
  reading: {
    id: "reading",
    name: "拓展阅读",
    icon: "读",
    description: "生成分级拓展阅读清单",
    temperature: 0.6,
    timeout: 240_000,
    retryCount: 2,
  },
};

export const AGENT_IDS: ResourceType[] = [
  "design",
  "doc",
  "quiz",
  "mindmap",
  "video",
  "code",
  "reading",
];

export function getAgentConfig(id: ResourceType): AgentConfig {
  return AGENT_CONFIGS[id];
}

export function getAllAgentConfigs(): AgentConfig[] {
  return AGENT_IDS.map((id) => AGENT_CONFIGS[id]);
}

export const AGENT_LABEL: Record<ResourceType, string> = Object.fromEntries(
  AGENT_IDS.map((id) => [id, AGENT_CONFIGS[id].name]),
) as Record<ResourceType, string>;
