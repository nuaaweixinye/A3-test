"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

interface QuizQuestion {
  prompt: string;
  options: string[];
  answerIndex: number;
  answerText: string;
  explanation: string;
}

function parseQuiz(content: string): QuizQuestion[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const blocks = normalized
    .split(/^##\s+/m)
    .filter((block) => /题|Question|Q\d+/i.test(block.slice(0, 80)));

  return blocks
    .map(parseQuestionBlock)
    .filter((question) => question.prompt || question.options.length > 0);
}

function parseQuestionBlock(block: string): QuizQuestion {
  const lines = block.split("\n");
  const heading = lines.shift()?.trim() ?? "";
  const promptLines: string[] = [];
  const options: string[] = [];
  let answerIndex = -1;
  let answerText = "";
  let explanation = "";
  let collectingExplanation = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") continue;

    const optionMatch = trimmed.match(/^[-*]?\s*([A-D])[\.\、．]\s*(.+)$/i);
    if (optionMatch) {
      const index = "ABCD".indexOf(optionMatch[1].toUpperCase());
      options[index] = optionMatch[2].trim();
      collectingExplanation = false;
      continue;
    }

    const promptMatch = trimmed.match(/^\*?\*?题目\*?\*?\s*[:：]\s*(.+)$/);
    if (promptMatch) {
      promptLines.push(promptMatch[1].trim());
      collectingExplanation = false;
      continue;
    }

    const answerMatch = trimmed.match(/^\>?\s*\*?\*?(答案|参考答案|答案要点)\*?\*?\s*[:：]\s*(.+)$/);
    if (answerMatch) {
      answerText = answerMatch[2].trim();
      const choice = answerText.match(/[A-D]/i);
      if (choice) answerIndex = "ABCD".indexOf(choice[0].toUpperCase());
      collectingExplanation = false;
      continue;
    }

    const explanationMatch = trimmed.match(/^\>?\s*\*?\*?解析\*?\*?\s*[:：]\s*(.*)$/);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
      collectingExplanation = true;
      continue;
    }

    if (collectingExplanation) {
      explanation += explanation ? ` ${trimmed.replace(/^>\s*/, "")}` : trimmed;
    } else if (!trimmed.startsWith(">")) {
      promptLines.push(trimmed.replace(/^\*+|\*+$/g, ""));
    }
  }

  const prompt =
    promptLines.join(" ").trim() ||
    heading.replace(/^(单选题|填空题|简答题|综合题|编程题|实操题)\s*\d*/i, "").trim();

  return {
    prompt,
    options: options.filter(Boolean),
    answerIndex,
    answerText,
    explanation,
  };
}

export function QuizDetail({ content, topic }: { content: string; topic: string }) {
  const questions = useMemo(() => parseQuiz(content), [content]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="doc-view">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  const total = questions.filter((question) => question.answerIndex >= 0).length;
  const score = questions.filter(
    (question, index) => question.answerIndex >= 0 && answers[index] === question.answerIndex,
  ).length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {submitted && total > 0 && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
          <span className="text-lg font-bold text-blue-700">
            得分：{score}/{total}
          </span>
          <span className="ml-2 text-sm text-slate-500">({percent} 分)</span>
        </div>
      )}

      {questions.map((question, questionIndex) => {
        const userAnswer = answers[questionIndex];
        const isCorrect =
          submitted &&
          question.answerIndex >= 0 &&
          userAnswer === question.answerIndex;
        const isWrong =
          submitted &&
          question.answerIndex >= 0 &&
          userAnswer !== undefined &&
          userAnswer !== question.answerIndex;

        return (
          <article
            key={questionIndex}
            className={`rounded-xl border p-4 ${
              isCorrect
                ? "border-emerald-200 bg-emerald-50/30"
                : isWrong
                  ? "border-rose-200 bg-rose-50/30"
                  : "border-slate-200"
            }`}
          >
            <p className="mb-2 text-sm font-semibold text-slate-800">
              第 {questionIndex + 1} 题
            </p>
            <p className="mb-3 text-sm leading-6 text-slate-700">{question.prompt}</p>

            {question.options.length > 0 ? (
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const selected = userAnswer === optionIndex;
                  const showCorrect = submitted && optionIndex === question.answerIndex;
                  const showWrong = submitted && selected && optionIndex !== question.answerIndex;

                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      disabled={submitted}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [questionIndex]: optionIndex,
                        }))
                      }
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        showCorrect
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                          : showWrong
                            ? "border-rose-400 bg-rose-50 text-rose-800"
                            : selected
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-mono font-bold">
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      <span>{option}</span>
                      {showCorrect && <span className="ml-auto font-medium">正确</span>}
                      {showWrong && <span className="ml-auto font-medium">错误</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <p className="font-medium">参考答案：</p>
                <p className="mt-1">{question.answerText || "见解析"}</p>
              </div>
            )}

            {submitted && question.explanation && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                <span className="font-medium">解析：</span>
                {question.explanation}
              </div>
            )}
          </article>
        );
      })}

      {!submitted && total > 0 && (
        <button
          type="button"
          onClick={() => {
            setSubmitted(true);
            useLearningStore.getState().setMastery(topic, percent);
          }}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          提交答案
        </button>
      )}

      {submitted && (
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setSubmitted(false);
          }}
          className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          重新作答
        </button>
      )}
    </div>
  );
}
