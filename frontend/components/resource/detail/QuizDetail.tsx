"use client";

import { useState } from "react";

interface QuizQuestion {
  prompt: string;
  options: string[];
  answerIndex: number; // -1 if not multiple choice
  answerText: string;
  explanation: string;
}

function parseQuiz(content: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  // Split by ### 第X题 or ### 题X or ### Q
  const blocks = content.split(/^###\s+/m).filter((b) => b.includes("题") || b.includes("Q"));
  
  for (const block of blocks) {
    const lines = block.split("\n");
    const promptLines: string[] = [];
    const options: string[] = [];
    let answerIndex = -1;
    let answerText = "";
    let explanation = "";
    let inExplanation = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Option: A. B. C. D. or A) B) etc
      const optMatch = trimmed.match(/^([A-D])[.、)]\s*(.+)/);
      if (optMatch) {
        const idx = "ABCD".indexOf(optMatch[1]);
        options[idx] = optMatch[2];
        continue;
      }

      // Answer line
      const ansMatch = trimmed.match(/\*?\*?答案\*?\*?[：:]\s*([A-D]+)/);
      if (ansMatch) {
        answerIndex = "ABCD".indexOf(ansMatch[1][0]);
        continue;
      }

      const ansTextMatch = trimmed.match(/\*?\*?答案\*?\*?[：:]\s*(.+)/);
      if (ansTextMatch && answerIndex === -1) {
        answerText = ansTextMatch[1];
        continue;
      }

      // Explanation
      const expMatch = trimmed.match(/\*?\*?解析\*?\*?[：:]\s*(.*)/);
      if (expMatch) {
        explanation = expMatch[1];
        inExplanation = true;
        continue;
      }

      if (inExplanation) {
        explanation += " " + trimmed;
      } else if (options.length === 0 && !trimmed.startsWith("**答案") && !trimmed.startsWith("**解析")) {
        promptLines.push(trimmed);
      }
    }

    if (promptLines.length > 0 || options.length > 0) {
      questions.push({
        prompt: promptLines.join(" ").replace(/^第\d+题\s*/, "").replace(/^题\d+\s*/, ""),
        options: options.filter(Boolean),
        answerIndex,
        answerText,
        explanation,
      });
    }
  }

  // Fallback: if no structured questions parsed, show raw content
  return questions;
}

export function QuizDetail({ content }: { content: string }) {
  const questions = parseQuiz(content);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="doc-view">
        <pre className="whitespace-pre-wrap text-sm">{content}</pre>
      </div>
    );
  }

  const score = questions.filter(
    (q, i) => q.answerIndex >= 0 && answers[i] === q.answerIndex,
  ).length;
  const total = questions.filter((q) => q.answerIndex >= 0).length;

  return (
    <div className="space-y-4">
      {submitted && total > 0 && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
          <span className="text-lg font-bold text-blue-700">
            得分：{score}/{total}
          </span>
          <span className="ml-2 text-sm text-slate-500">
            （{Math.round((score / total) * 100)} 分）
          </span>
        </div>
      )}

      {questions.map((q, qi) => {
        const userAnswer = answers[qi];
        const isCorrect = submitted && q.answerIndex >= 0 && userAnswer === q.answerIndex;
        const isWrong = submitted && q.answerIndex >= 0 && userAnswer !== undefined && userAnswer !== q.answerIndex;

        return (
          <div
            key={qi}
            className={`rounded-xl border p-4 ${
              isCorrect
                ? "border-emerald-200 bg-emerald-50/30"
                : isWrong
                  ? "border-rose-200 bg-rose-50/30"
                  : "border-slate-200"
            }`}
          >
            <p className="mb-3 text-sm font-medium text-slate-800">
              第 {qi + 1} 题
            </p>
            <p className="mb-3 text-sm text-slate-700">{q.prompt}</p>

            {q.options.length > 0 ? (
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = userAnswer === oi;
                  const showCorrect = submitted && oi === q.answerIndex;
                  const showWrong = submitted && selected && oi !== q.answerIndex;

                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
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
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      <span>{opt}</span>
                      {showCorrect && <span className="ml-auto">✓</span>}
                      {showWrong && <span className="ml-auto">✕</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <p className="font-medium">参考答案：</p>
                <p className="mt-1">{q.answerText || "（见解析）"}</p>
              </div>
            )}

            {submitted && q.explanation && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-medium">💡 解析：</span>
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}

      {!submitted && total > 0 && (
        <button
          type="button"
          onClick={() => setSubmitted(true)}
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
