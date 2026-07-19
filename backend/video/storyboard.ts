export interface VideoScene {
  title: string;
  keyPoint: string;
  narration: string;
  visual: string;
  prompt: string;
  svg: string;
  duration: number;
}

export function parseLearningGoals(content: string): string[] {
  const match = content.match(/##\s*学习目标\s*\n([\s\S]*?)(?=\n##\s+|$)/);
  if (!match?.[1]) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function parseVideoScenes(content: string): VideoScene[] {
  const scenes: VideoScene[] = [];
  const blocks = content
    .split(/^##\s+/m)
    .filter((block) => {
      const heading = block.split("\n")[0] ?? "";
      return /分镜|镜头|Scene/i.test(heading) || /\*\*(旁白|标题|画面)\*\*\s*[:：]/.test(block);
    });

  for (const block of blocks) {
    const heading = block.split("\n")[0]?.trim() ?? "";
    const title =
      matchLine(block, ["标题", "Title"]) ||
      heading.replace(/[（(].*?[）)]/g, "").trim() ||
      "教学分镜";
    const keyPoint = matchLine(block, ["关键点", "要点", "知识点", "Key Point"]);
    const narration = matchLine(block, ["旁白", "讲解", "Narration", "Voiceover"]);
    const visual = matchLine(block, ["画面", "视觉", "Visual"]);
    const prompt = matchLine(block, ["暂停思考", "互动", "Prompt"]);
    const svgMatch = block.match(/```svg\s*([\s\S]*?)```/i);
    const durationMatch =
      heading.match(/(?:约)?\s*(\d+)\s*(?:s|秒)/i) ??
      block.match(/(?:时长|duration)[:：]?\s*(\d+)\s*(?:s|秒)/i);
    const duration = durationMatch ? clamp(Number(durationMatch[1]), 5, 45) : 12;

    if (narration || visual || title || svgMatch?.[1]) {
      scenes.push({
        title,
        keyPoint,
        narration,
        visual,
        prompt,
        svg: svgMatch?.[1]?.trim() ?? "",
        duration,
      });
    }
  }

  if (scenes.length === 0 && content.trim()) {
    scenes.push({
      title: "教学讲解",
      keyPoint: "核心知识",
      narration: content.replace(/\s+/g, " ").slice(0, 220),
      visual: "根据讲解内容展示知识结构图",
      prompt: "请复述本段的关键结论。",
      svg: "",
      duration: 15,
    });
  }

  return scenes;
}

function matchLine(block: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`[-*]?\\s*\\*\\*${escaped}\\*\\*\\s*[:：]\\s*([^\\n]+)`, "i"),
      new RegExp(`[-*]?\\s*${escaped}\\s*[:：]\\s*([^\\n]+)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = block.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return "";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
