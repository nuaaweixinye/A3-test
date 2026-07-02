// 学习多智能体系统 —— 公共类型定义
// 对应赛题"基于大模型的个性化资源生成与学习多智能体系统开发"

/* ===================== 学生画像（6 个维度，赛题硬性要求 ≥6） ===================== */

export type CognitiveStyle = "visual" | "auditory" | "reading" | "kinesthetic";
export type LearningGoal = "exam" | "project" | "research" | "interest";
export type LearningPace = "fast" | "medium" | "slow";

export interface StudentProfile {
  /** 1. 知识基础水平：知识点 -> 0~100 掌握度 */
  knowledge_level: Record<string, number>;
  /** 2. 认知学习风格 */
  cognitive_style: CognitiveStyle;
  /** 3. 易错点偏好 */
  error_patterns: string[];
  /** 4. 学习目标方向 */
  learning_goal: LearningGoal;
  /** 5. 学习节奏偏好 */
  learning_pace: LearningPace;
  /** 6. 兴趣方向偏好 */
  interests: string[];
  updated_at?: string;
}

/* ===================== 学习路径与资源 ===================== */

export type ResourceType =
  | "doc" // 课程讲解文档
  | "quiz" // 练习题库
  | "mindmap" // 知识点思维导图
  | "video" // 教学视频/动画
  | "code" // 代码实操案例
  | "reading"; // 拓展阅读材料

export interface ResourceTask {
  type: ResourceType;
  topic: string;
  reason?: string;
}

export interface PathStep {
  step: number;
  title: string;
  description: string;
  resource_tasks: ResourceTask[];
  estimated_minutes: number;
}

export interface LearningPath {
  path_title: string;
  estimated_time: string;
  steps: PathStep[];
}

export interface GeneratedResource {
  id: string;
  type: ResourceType;
  title: string;
  topic: string;
  /** Markdown 正文 */
  content: string;
  /** 引用来源（防幻觉第 4 层：引用标注） */
  sources: string[];
  created_at: string;
}

/* ===================== LangGraph 共享状态 ===================== */

export interface LearningState {
  userMessage: string;
  profile: StudentProfile | null;
  path: LearningPath | null;
  docTask: ResourceTask | null;
  resource: GeneratedResource | null;
}

/* ===================== SSE 事件（前后端协议） ===================== */

export type AgentEvent =
  | { type: "status"; agent: string; message: string }
  | { type: "profile"; profile: StudentProfile }
  | { type: "path"; path: LearningPath }
  | { type: "doc_delta"; text: string }
  | { type: "resource"; resource: GeneratedResource }
  | { type: "done" }
  | { type: "error"; message: string };
