import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { parseVideoScenes, type VideoScene } from "./storyboard";

export interface RenderVideoResult {
  videoUrl: string;
  filename: string;
  duration: number;
  scenes: number;
  hasAudio: boolean;
}

const OUTPUT_DIR = path.join(process.cwd(), "public", "generated-videos");
const TEMP_DIR = path.join(process.cwd(), ".video-tmp");

export async function renderTeachingVideo(params: {
  content: string;
  topic: string;
}): Promise<RenderVideoResult> {
  const ffmpeg = findFfmpeg();
  const scenes = parseVideoScenes(params.content);
  if (scenes.length === 0) {
    throw new Error("没有解析到可渲染的视频分镜，请重新生成视频脚本。");
  }

  await assertFfmpeg(ffmpeg);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  const jobId = nanoid(10);
  const jobDir = path.join(TEMP_DIR, jobId);
  await mkdir(jobDir, { recursive: true });

  try {
    const segments: string[] = [];
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      const pngPath = path.join(jobDir, `scene-${index}.png`);
      const audioPath = path.join(jobDir, `scene-${index}.wav`);
      const segmentPath = path.join(jobDir, `segment-${index}.mp4`);

      await renderSceneImage(scene, index, scenes.length, pngPath);
      await synthesizeNarration({
        text: scene.narration || scene.keyPoint || scene.title,
        wavPath: audioPath,
        workDir: jobDir,
        index,
      });

      await runFfmpeg(ffmpeg, [
        "-y",
        "-loop",
        "1",
        "-t",
        String(scene.duration),
        "-i",
        pngPath,
        "-i",
        audioPath,
        "-filter_complex",
        `[1:a]apad,atrim=0:${scene.duration}[a]`,
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-vf",
        "format=yuv420p",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-t",
        String(scene.duration),
        segmentPath,
      ]);
      segments.push(segmentPath);
    }

    const concatPath = path.join(jobDir, "concat.txt");
    await writeFile(
      concatPath,
      segments.map((segment) => `file '${segment.replace(/\\/g, "/")}'`).join("\n"),
      "utf8",
    );

    const filename = `${safeFilename(params.topic)}-${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    await runFfmpeg(ffmpeg, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c",
      "copy",
      outputPath,
    ]);

    return {
      videoUrl: `/generated-videos/${filename}`,
      filename,
      duration: scenes.reduce((sum, scene) => sum + scene.duration, 0),
      scenes: scenes.length,
      hasAudio: true,
    };
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}

function findFfmpeg(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

async function assertFfmpeg(ffmpeg: string): Promise<void> {
  try {
    await runCommand(ffmpeg, ["-version"]);
  } catch {
    throw new Error(
      "未检测到 ffmpeg。请安装 ffmpeg 并加入 PATH，或在 .env 中配置 FFMPEG_PATH。",
    );
  }
}

async function renderSceneImage(
  scene: VideoScene,
  index: number,
  total: number,
  pngPath: string,
): Promise<void> {
  const provided = sanitizeSvg(scene.svg);
  const svg = provided || buildFallbackSceneSvg(scene, index, total);

  try {
    await svgToPng(svg, pngPath);
  } catch (err) {
    if (!provided) {
      throw new Error(
        `视频画面渲染失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
    console.warn(
      `第 ${index + 1} 个分镜的 SVG 不可用，已自动使用兜底画面：${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    await svgToPng(buildFallbackSceneSvg(scene, index, total), pngPath);
  }
}

async function svgToPng(svg: string, pngPath: string): Promise<void> {
  await sharp(Buffer.from(svg)).resize(1280, 720).png().toFile(pngPath);
}

async function synthesizeNarration({
  text,
  wavPath,
  workDir,
  index,
}: {
  text: string;
  wavPath: string;
  workDir: string;
  index: number;
}): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("当前语音合成依赖 Windows 系统语音，请在 Windows 环境运行视频生成。");
  }

  const textPath = path.join(workDir, `scene-${index}.txt`);
  const scriptPath = path.join(workDir, "tts.ps1");
  await writeFile(textPath, text || "本段暂无旁白。", "utf8");
  await writeFile(
    scriptPath,
    [
      "param([string]$TextPath, [string]$WavPath)",
      "Add-Type -AssemblyName System.Speech",
      "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
      "$synth.Volume = 100",
      "$synth.Rate = 0",
      "$synth.SetOutputToWaveFile($WavPath)",
      "$text = [System.IO.File]::ReadAllText($TextPath, [System.Text.Encoding]::UTF8)",
      "$synth.Speak($text)",
      "$synth.Dispose()",
    ].join("\n"),
    "utf8",
  );

  try {
    await runCommand("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      textPath,
      wavPath,
    ]);
  } catch (err) {
    throw new Error(
      `语音合成失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function runFfmpeg(ffmpeg: string, args: string[]): Promise<void> {
  return runCommand(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args]);
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

function buildFallbackSceneSvg(
  scene: VideoScene,
  index: number,
  total: number,
): string {
  const title = escapeXml(scene.title || `分镜 ${index + 1}`);
  const keyPoint = escapeXml(scene.keyPoint || scene.visual || "核心概念");
  const narrationLines = wrapText(
    scene.narration || scene.visual || "请结合知识库理解本段内容。",
    22,
  ).slice(0, 5);
  const narration = narrationLines
    .map(
      (line, lineIndex) =>
        `<text x="72" y="${366 + lineIndex * 36}" fill="#334155" font-size="24">${escapeXml(line)}</text>`,
    )
    .join("");
  const progressWidth = Math.round(((index + 1) / total) * 1120);

  return `<svg viewBox="0 0 1280 720" width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: "Microsoft YaHei", "SimHei", Arial, sans-serif; }
    .body { font-family: "Microsoft YaHei", "SimHei", Arial, sans-serif; }
  </style>
  <rect width="1280" height="720" fill="#f8fafc"/>
  <rect x="34" y="34" width="1212" height="652" rx="28" fill="#ffffff" stroke="#dbeafe" stroke-width="3"/>
  <rect x="80" y="76" width="1120" height="12" rx="6" fill="#e2e8f0"/>
  <rect x="80" y="76" width="${progressWidth}" height="12" rx="6" fill="#3b82f6"/>
  <text class="body" x="80" y="140" fill="#2563eb" font-size="28" font-weight="700">教学微课 · ${index + 1}/${total}</text>
  <text class="title" x="80" y="220" fill="#0f172a" font-size="58" font-weight="800">${title}</text>
  <rect x="80" y="260" width="760" height="70" rx="18" fill="#eff6ff"/>
  <text class="body" x="112" y="306" fill="#1d4ed8" font-size="28" font-weight="700">${keyPoint}</text>
  ${narration}
  <circle cx="1030" cy="260" r="116" fill="#dbeafe"/>
  <circle cx="1030" cy="260" r="72" fill="#3b82f6"/>
  <path d="M1006 216 L1088 260 L1006 304 Z" fill="white"/>
  <text class="body" x="844" y="462" fill="#64748b" font-size="25">AI 基于知识库生成讲解</text>
  <text class="body" x="80" y="638" fill="#94a3b8" font-size="22">${escapeXml(scene.prompt || "暂停思考：你能复述本段关键点吗？")}</text>
</svg>`;
}

function sanitizeSvg(svg: string): string {
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end <= start) return "";

  const trimmed = svg
    .slice(start, end + "</svg>".length)
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;")
    .trim();

  if (/<script|<foreignObject|href=["']https?:|xlink:href=["']https?:/i.test(trimmed)) {
    return "";
  }
  if (/<\s*[^a-zA-Z/!?]/.test(trimmed)) return "";
  return normalizeSvgSize(trimmed);
}

function normalizeSvgSize(svg: string): string {
  let next = svg;
  if (!/width=/.test(next)) next = next.replace("<svg", '<svg width="1280"');
  if (!/height=/.test(next)) next = next.replace("<svg", '<svg height="720"');
  if (!/viewBox=/.test(next)) next = next.replace("<svg", '<svg viewBox="0 0 1280 720"');
  return next;
}

function safeFilename(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return cleaned || "teaching-video";
}

function wrapText(value: string, size: number): string[] {
  const chars = value.replace(/\s+/g, " ").trim().split("");
  const lines: string[] = [];
  for (let index = 0; index < chars.length; index += size) {
    lines.push(chars.slice(index, index + size).join(""));
  }
  return lines.length > 0 ? lines : ["请结合知识库理解本段内容。"];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
