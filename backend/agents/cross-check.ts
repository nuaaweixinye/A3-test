import { callSpark, type ChatMsg } from "@/backend/ai/spark";
import type { GeneratedResource, ResourceType } from "@/backend/types";

export interface CrossCheckResult {
  passed: boolean;
  issues: string[];
  reviewer?: string;
}

const RULE_CHECKS: Record<ResourceType, (content: string) => CrossCheckResult> = {
  design: checkDesign,
  doc: checkDoc,
  quiz: checkQuiz,
  mindmap: checkMindmap,
  video: checkVideo,
  code: checkCode,
  reading: checkReading,
};

function checkDesign(content: string): CrossCheckResult {
  const issues: string[] = [];
  for (const keyword of ["学习对象", "资源组合", "PPT", "学习活动", "评价"]) {
    if (!content.includes(keyword)) issues.push(`资源设计方案缺少“${keyword}”部分`);
  }
  const slideCount = content.match(/###\s*Slide\s*\d+/gi)?.length ?? 0;
  if (slideCount > 0 && slideCount < 4) {
    issues.push(`PPT 页级脚本偏少，当前 ${slideCount} 页`);
  }
  return result(issues);
}

function checkDoc(content: string): CrossCheckResult {
  const issues: string[] = [];
  const sections = content.match(/^##\s+/gm)?.length ?? 0;
  if (sections < 2) issues.push(`讲解文档小节偏少，当前 ${sections} 个`);
  if (!/(核心|重点|概念|原理)/.test(content)) issues.push("讲解文档缺少核心概念说明");
  return result(issues);
}

function checkQuiz(content: string): CrossCheckResult {
  const issues: string[] = [];
  const questions = content.match(/^##\s+.+题\s*\d*/gm)?.length ?? 0;
  if (questions > 0 && questions < 3) issues.push(`练习题数量偏少，当前 ${questions} 道`);
  if (!/答案|参考答案|答案要点/.test(content)) issues.push("题库缺少答案标注");
  const typeCount = [/单选题/.test(content), /填空题/.test(content), /简答题/.test(content)]
    .filter(Boolean).length;
  if (typeCount < 2) issues.push(`题型覆盖不足，当前 ${typeCount} 种`);
  return result(issues);
}

function checkMindmap(content: string): CrossCheckResult {
  const issues: string[] = [];
  const listLines = content.match(/^[-*]\s+/gm)?.length ?? 0;
  if (listLines < 3) issues.push(`思维导图节点偏少，当前 ${listLines} 个`);
  if (!/^\s{2,4}[-*]\s+/m.test(content)) issues.push("思维导图缺少二级结构");
  return result(issues);
}

function checkVideo(content: string): CrossCheckResult {
  const issues: string[] = [];
  const scenes = content.match(/^##\s+分镜\s*\d+/gm)?.length ?? 0;
  if (scenes === 0) issues.push("教学视频缺少可解析的分镜");
  if (!/##\s*学习目标/.test(content)) issues.push("教学视频缺少学习目标小节");
  const titleCount = content.match(/\*\*标题\*\*\s*[:：]/g)?.length ?? 0;
  const narrationCount = content.match(/\*\*旁白\*\*\s*[:：]/g)?.length ?? 0;
  if (scenes > 0 && titleCount < scenes) issues.push("部分分镜缺少标题");
  if (scenes > 0 && narrationCount < scenes) issues.push("部分分镜缺少旁白");
  return result(issues);
}

function checkCode(content: string): CrossCheckResult {
  const issues: string[] = [];
  if (!/```[\s\S]*?```/.test(content)) issues.push("代码实操缺少代码块");
  if (!/(练习|任务|动手|实践)/.test(content)) issues.push("代码实操缺少练习任务");
  return result(issues);
}

function checkReading(content: string): CrossCheckResult {
  const issues: string[] = [];
  const items = content.match(/^\s*\d+[.、]\s+/gm)?.length ?? 0;
  if (items > 0 && items < 3) issues.push(`拓展阅读条目偏少，当前 ${items} 条`);
  if (!/(阅读|资料|推荐|拓展)/.test(content)) issues.push("拓展阅读缺少推荐说明");
  return result(issues);
}

function result(issues: string[]): CrossCheckResult {
  return { passed: issues.length === 0, issues };
}

async function crossCheckDocByQuiz(content: string): Promise<CrossCheckResult> {
  const systemPrompt = `你是题库生成专家。请审视讲解文档是否遗漏了应该出题考查的核心概念。
只输出 JSON：{ "issues": ["问题"], "passed": true }。`;
  return crossCheckWithLlm(systemPrompt, content, "quiz");
}

async function crossCheckCodeByDoc(content: string): Promise<CrossCheckResult> {
  const systemPrompt = `你是课程讲解专家。请审视代码实操案例是否正确体现核心原理，是否有明显逻辑错误。
只输出 JSON：{ "issues": ["问题"], "passed": true }。`;
  return crossCheckWithLlm(systemPrompt, content, "doc");
}

async function crossCheckWithLlm(
  systemPrompt: string,
  content: string,
  reviewer: string,
): Promise<CrossCheckResult> {
  try {
    const messages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: content.slice(0, 3000) },
    ];
    const raw = await callSpark({ messages, stage: "eval", temperature: 0.3 });
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        passed: parsed.passed !== false,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        reviewer,
      };
    }
  } catch {
    // LLM review is supplemental; rule checks still provide a result.
  }
  return { passed: true, issues: [], reviewer };
}

export async function runCrossChecks(
  resources: GeneratedResource[],
): Promise<Record<string, CrossCheckResult>> {
  const results: Record<string, CrossCheckResult> = {};

  for (const resource of resources) {
    const ruleCheck = RULE_CHECKS[resource.type](resource.content);
    results[resource.id] = ruleCheck;

    if (resource.type === "doc") {
      const llmCheck = await crossCheckDocByQuiz(resource.content);
      results[resource.id] = mergeChecks(ruleCheck, llmCheck);
    }

    if (resource.type === "code") {
      const llmCheck = await crossCheckCodeByDoc(resource.content);
      results[resource.id] = mergeChecks(ruleCheck, llmCheck);
    }
  }

  return results;
}

function mergeChecks(a: CrossCheckResult, b: CrossCheckResult): CrossCheckResult {
  return {
    passed: a.passed && b.passed,
    issues: [...a.issues, ...b.issues],
    reviewer: b.reviewer,
  };
}
