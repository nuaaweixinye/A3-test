import { mkdir } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import pptxgen from "pptxgenjs";

export interface RenderPptResult {
  pptUrl: string;
  filename: string;
  slides: number;
}

interface SlideSpec {
  title: string;
  bullets: string[];
}

const OUTPUT_DIR = path.join(process.cwd(), "public", "generated-ppts");

export async function renderTeachingPpt(params: {
  content: string;
  topic: string;
}): Promise<RenderPptResult> {
  const slides = parseSlides(params.content, params.topic);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "learning-multiagent";
  pptx.subject = params.topic;
  pptx.title = params.topic;
  pptx.company = "AI Learning Multi-Agent";
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
  };

  addCoverSlide(pptx, params.topic);
  for (const [index, spec] of slides.entries()) {
    addContentSlide(pptx, spec, index + 1, slides.length);
  }
  addClosingSlide(pptx);

  const filename = `${safeFilename(params.topic)}-${nanoid(10)}.pptx`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  await pptx.writeFile({ fileName: outputPath });

  return {
    pptUrl: `/generated-ppts/${filename}`,
    filename,
    slides: slides.length + 2,
  };
}

function parseSlides(content: string, topic: string): SlideSpec[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return fallbackSlides(topic);

  const explicitSlides = parseExplicitSlides(normalized, topic);
  if (explicitSlides.length > 0) return explicitSlides.slice(0, 14);

  const markdownSections = parseMarkdownSections(normalized);
  if (markdownSections.length >= 2) return markdownSections.slice(0, 12);

  const bullets = splitBullets(normalized).slice(0, 18);
  if (bullets.length > 0) {
    return chunk(bullets, 4).map((items, index) => ({
      title: index === 0 ? "核心内容" : `要点 ${index + 1}`,
      bullets: items,
    }));
  }

  return fallbackSlides(topic);
}

function parseExplicitSlides(content: string, topic: string): SlideSpec[] {
  const blocks = content
    .split(/^###\s+/m)
    .filter((block) => /^Slide\s*\d+/i.test(block.trim()));

  return blocks.map((block, index) => {
    const [heading, ...rest] = block.split("\n");
    const title = heading.replace(/^Slide\s*\d+\s*[:：\-]?\s*/i, "").trim();
    return {
      title: title || `${topic} 第 ${index + 1} 页`,
      bullets: normalizeBullets(splitBullets(rest.join("\n"))),
    };
  });
}

function parseMarkdownSections(content: string): SlideSpec[] {
  const sections = content
    .split(/^##\s+/m)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section) => {
    const [heading, ...rest] = section.split("\n");
    const bullets = normalizeBullets(splitBullets(rest.join("\n")));
    return {
      title: cleanupText(heading.replace(/^#+\s*/, "")),
      bullets,
    };
  });
}

function splitBullets(value: string): string[] {
  return value
    .split(/\n|[。；;]/)
    .map((item) =>
      cleanupText(
        item
          .replace(/^[-*+]\s*/, "")
          .replace(/^\d+[.、]\s*/, "")
          .replace(/\*\*/g, ""),
      ),
    )
    .filter((item) => item.length > 0);
}

function normalizeBullets(items: string[]): string[] {
  return items
    .map((item) => (item.length > 90 ? `${item.slice(0, 88)}...` : item))
    .slice(0, 6);
}

function cleanupText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "代码示例")
    .replace(/[#>*_`|]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackSlides(topic: string): SlideSpec[] {
  return [
    {
      title: "学习目标",
      bullets: ["明确核心概念", "识别知识短板", "完成个性化学习任务"],
    },
    {
      title: "知识结构",
      bullets: ["梳理基础概念", "连接关键原理", "建立应用场景"],
    },
    {
      title: "学习活动",
      bullets: ["课前预习", "课堂讲解", "练习巩固", "反馈调优"],
    },
    {
      title: "资源组合",
      bullets: ["讲解文档", "练习题库", "思维导图", "教学视频", "实操案例"],
    },
    {
      title: "效果评估",
      bullets: ["掌握度评估", "易错点复盘", "路径动态调整"],
    },
  ].map((slide) => ({ ...slide, title: `${topic} · ${slide.title}` }));
}

function addCoverSlide(pptx: pptxgen, topic: string) {
  const slide = pptx.addSlide();
  slide.background = { color: "F8FAFC" };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.18,
    fill: { color: "2563EB" },
    line: { color: "2563EB" },
  });
  slide.addText(topic, {
    x: 0.75,
    y: 1.55,
    w: 11.8,
    h: 0.8,
    fontFace: "Microsoft YaHei",
    fontSize: 34,
    bold: true,
    color: "0F172A",
    fit: "shrink",
  });
  slide.addText("个性化学习资源设计方案", {
    x: 0.78,
    y: 2.55,
    w: 8.5,
    h: 0.45,
    fontFace: "Microsoft YaHei",
    fontSize: 18,
    color: "2563EB",
  });
  slide.addText("由多智能体基于学习画像、提示词和知识库生成", {
    x: 0.78,
    y: 5.9,
    w: 8.5,
    h: 0.35,
    fontFace: "Microsoft YaHei",
    fontSize: 12,
    color: "64748B",
  });
}

function addContentSlide(
  pptx: pptxgen,
  spec: SlideSpec,
  index: number,
  total: number,
) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText(spec.title || `第 ${index} 页`, {
    x: 0.65,
    y: 0.5,
    w: 11.6,
    h: 0.55,
    fontFace: "Microsoft YaHei",
    fontSize: 24,
    bold: true,
    color: "0F172A",
    fit: "shrink",
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.65,
    y: 1.2,
    w: 12,
    h: 0,
    line: { color: "DBEAFE", width: 1.5 },
  });

  const bullets =
    spec.bullets.length > 0
      ? spec.bullets
      : ["结合学习画像和知识库展开讲解。"];

  slide.addText(
    bullets.map((bullet) => ({ text: bullet, options: { bullet: { indent: 16 } } })),
    {
      x: 0.9,
      y: 1.6,
      w: 10.8,
      h: 4.4,
      fontFace: "Microsoft YaHei",
      fontSize: 18,
      color: "334155",
      breakLine: false,
      fit: "shrink",
      paraSpaceAfter: 14,
    },
  );
  slide.addText(`${index}/${total}`, {
    x: 11.8,
    y: 6.8,
    w: 0.8,
    h: 0.25,
    fontFace: "Microsoft YaHei",
    fontSize: 10,
    color: "94A3B8",
    align: "right",
  });
}

function addClosingSlide(pptx: pptxgen) {
  const slide = pptx.addSlide();
  slide.background = { color: "EFF6FF" };
  slide.addText("学习闭环", {
    x: 0.8,
    y: 1.2,
    w: 10,
    h: 0.7,
    fontFace: "Microsoft YaHei",
    fontSize: 30,
    bold: true,
    color: "1D4ED8",
  });
  slide.addText("画像更新 · 资源推送 · 学习评估 · 路径调优", {
    x: 0.82,
    y: 2.2,
    w: 10.5,
    h: 0.5,
    fontFace: "Microsoft YaHei",
    fontSize: 20,
    color: "0F172A",
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function safeFilename(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return cleaned || "teaching-ppt";
}
