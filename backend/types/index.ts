export type CognitiveStyle = "visual" | "auditory" | "reading" | "kinesthetic";
export type LearningGoal = "exam" | "project" | "research" | "interest";
export type LearningPace = "fast" | "medium" | "slow";

export interface StudentProfile {
  /** Knowledge point -> mastery score, 0 to 100. */
  knowledge_level: Record<string, number>;
  /** Preferred learning style. */
  cognitive_style: CognitiveStyle;
  /** Common mistake patterns or weak preferences. */
  error_patterns: string[];
  /** Current learning goal. */
  learning_goal: LearningGoal;
  /** Preferred learning pace. */
  learning_pace: LearningPace;
  /** Interest directions used for personalization. */
  interests: string[];
  updated_at?: string;
}

export type ResourceType =
  | "design"
  | "doc"
  | "quiz"
  | "mindmap"
  | "video"
  | "code"
  | "reading";

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
  content: string;
  sources: string[];
  fact_check?: FactCheckResult;
  crossCheck?: CrossCheckResult;
  created_at: string;
}

export interface FactCheckResult {
  score: number;
  flagged: string[];
  checked: number;
}

export interface CrossCheckResult {
  passed: boolean;
  issues: string[];
  reviewer?: string;
}

export interface LearningState {
  userMessage: string;
  profile: StudentProfile | null;
  path: LearningPath | null;
  primaryTopic: string;
  resourceTasks: ResourceTask[];
  resources: GeneratedResource[];
}

export interface ResourceCardState {
  id: string;
  resType: ResourceType;
  title: string;
  topic: string;
  content: string;
  sources: string[];
  fact_check?: FactCheckResult;
  crossCheck?: CrossCheckResult;
  done: boolean;
}

export interface TopicProgress {
  mastery: number;
  viewed: boolean;
  viewSeconds: number;
}

export type ProgressTrend = "improving" | "steady" | "needs_review";

export interface EvaluationResult {
  overall_score: number;
  mastery: Record<string, number>;
  weak_points: string[];
  strong_points: string[];
  progress_trend: ProgressTrend;
  recommendations: string[];
  profile_update: {
    knowledge_level: Record<string, number>;
  };
  path_adjustment: {
    action: "advance" | "review" | "steady";
    focus_topics: string[];
    summary: string;
  };
}

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export type AgentEvent =
  | { type: "status"; agent: string; message: string }
  | { type: "profile"; profile: StudentProfile }
  | { type: "path"; path: LearningPath }
  | {
      type: "resource_start";
      id: string;
      resType: ResourceType;
      title: string;
      topic: string;
    }
  | { type: "resource_delta"; id: string; text: string }
  | { type: "resource"; resource: GeneratedResource }
  | { type: "done" }
  | { type: "error"; message: string };
