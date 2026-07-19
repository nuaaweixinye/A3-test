"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResourceCard } from "@/frontend/components/resource/ResourceCard";
import { showToast } from "@/frontend/components/ui/Toast";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type {
  LearningPath,
  ResourceCardState,
  ResourceType,
  TopicProgress,
} from "@/backend/types";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  design: "设计/PPT",
  doc: "文档",
  quiz: "题库",
  mindmap: "导图",
  video: "视频",
  code: "代码",
  reading: "阅读",
};

interface LearnRecord {
  id: string;
  topic: string;
  path: LearningPath;
  resources: ResourceCardState[];
  progress: Record<string, TopicProgress>;
  createdAt: string;
}

export default function LearnPage() {
  const [records, setRecords] = useState<LearnRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const storeOrder = useLearningStore((state) => state.resourceOrder);
  const storeCards = useLearningStore((state) => state.resourceCards);
  const storePath = useLearningStore((state) => state.path);
  const weakTopics = useLearningStore((state) => state.weakTopics);
  const progress = useLearningStore((state) => state.progress);
  const profile = useLearningStore((state) => state.profile);

  const hasStoreData = storeOrder.length > 0;
  const currentCards = useMemo(
    () => dedupeCards(storeOrder.map((id) => storeCards[id]).filter(Boolean)),
    [storeCards, storeOrder],
  );
  const doneCount = currentCards.filter((card) => card.done).length;
  const viewedCount = currentCards.filter((card) => progress[card.topic]?.viewed).length;
  const avgMastery =
    currentCards.length > 0
      ? Math.round(
          currentCards.reduce(
            (sum, card) => sum + (progress[card.topic]?.mastery ?? 0),
            0,
          ) / currentCards.length,
        )
      : 0;

  const loadRecord = useCallback((record: LearnRecord) => {
    setSelectedId(record.id);
    const cards: Record<string, ResourceCardState> = {};
    const order: string[] = [];
    for (const resource of dedupeCards(record.resources || [])) {
      cards[resource.id] = { ...resource, done: true };
      order.push(resource.id);
    }

    useLearningStore.setState({
      resourceCards: cards,
      resourceOrder: order,
      path: record.path,
      progress: record.progress || {},
    });
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/records");
      const data = await response.json();
      const list: LearnRecord[] = data.records || [];
      setRecords(list);
      if (list.length > 0 && selectedId === null && !hasStoreData) {
        setSelectedId(list[0].id);
        loadRecord(list[0]);
      }
    } catch {
      showToast("学习记录加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [hasStoreData, loadRecord, selectedId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecords();
  }, [loadRecords]);

  async function deleteRecord(record: LearnRecord) {
    setDeletingId(record.id);
    try {
      const response = await fetch(`/api/records?id=${encodeURIComponent(record.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "删除失败");

      setRecords((items) => items.filter((item) => item.id !== record.id));
      if (selectedId === record.id) {
        setSelectedId(null);
        useLearningStore.getState().resetResources();
        useLearningStore.setState({ path: null, progress: {} });
      }
      showToast("学习记录已删除", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
            Learning Workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">学习记录</h1>
          <p className="mt-1 text-sm text-slate-500">
            查看历史学习会话，继续阅读资源，并跟踪从画像到评估的学习闭环。
          </p>
        </div>

        {currentCards.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            资源 {doneCount}/{currentCards.length} 已完成
          </span>
        )}
      </header>

      {weakTopics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          <span className="font-medium">建议重点复习：</span>
          <span>{weakTopics.join("、")}</span>
          <Link href="/eval" className="ml-auto text-rose-700 underline">
            查看评估
          </Link>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">加载学习记录中...</p>
      ) : records.length === 0 && !hasStoreData ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          暂无学习记录。
          <Link href="/" className="ml-2 text-blue-600 underline">
            去生成学习资源
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="h-fit space-y-2">
            {hasStoreData && (
              <div className="px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                当前会话
              </div>
            )}

            {hasStoreData && (
              <SessionButton
                title={storePath?.path_title || "当前会话"}
                meta={`刚生成 · ${storeOrder.length} 个资源`}
                active={selectedId === null}
                onClick={() => setSelectedId(null)}
              />
            )}

            {records.length > 0 && (
              <div className="px-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                历史记录
              </div>
            )}

            {records.map((record) => (
              <SessionButton
                key={record.id}
                title={record.topic}
                meta={`${formatDate(record.createdAt)} · ${
                  dedupeCards(record.resources || []).length
                } 个资源`}
                active={selectedId === record.id}
                deleting={deletingId === record.id}
                onClick={() => loadRecord(record)}
                onDelete={() => void deleteRecord(record)}
              />
            ))}
          </aside>

          <section className="space-y-5">
            <LearningLoop
              profileReady={Boolean(profile)}
              path={storePath}
              doneCount={doneCount}
              totalCount={currentCards.length}
              viewedCount={viewedCount}
              avgMastery={avgMastery}
              weakCount={weakTopics.length}
            />

            {storePath && <PathPanel path={storePath} />}

            {currentCards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-400">
                选择左侧会话查看资源。
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {currentCards.map((card) => (
                  <ResourceCard
                    key={card.id}
                    card={card}
                    weak={weakTopics.includes(card.topic)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SessionButton({
  title,
  meta,
  active,
  deleting,
  onClick,
  onDelete,
}: {
  title: string;
  meta: string;
  active: boolean;
  deleting?: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-blue-300 bg-blue-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{meta}</p>
      </button>
      {active && <span className="shrink-0 text-xs font-bold text-blue-600">选中</span>}
      {onDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          className="shrink-0 rounded-lg border border-rose-100 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          {deleting ? "删除中" : "删除"}
        </button>
      )}
    </div>
  );
}

function LearningLoop({
  profileReady,
  path,
  doneCount,
  totalCount,
  viewedCount,
  avgMastery,
  weakCount,
}: {
  profileReady: boolean;
  path: LearningPath | null;
  doneCount: number;
  totalCount: number;
  viewedCount: number;
  avgMastery: number;
  weakCount: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">学习闭环进度</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/eval"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
          >
            生成学习评估
          </Link>
          <Link
            href="/profile"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            查看画像变化
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <LoopStep label="画像" value={profileReady ? "已建立" : "待建立"} done={profileReady} />
        <LoopStep
          label="路径"
          value={path ? `${path.steps.length} 步` : "待规划"}
          done={Boolean(path)}
        />
        <LoopStep
          label="资源"
          value={`${doneCount}/${totalCount || 7}`}
          done={totalCount > 0 && doneCount === totalCount}
        />
        <LoopStep
          label="学习"
          value={`${viewedCount} 已读 · ${avgMastery} 分`}
          done={viewedCount > 0}
        />
        <LoopStep
          label="调优"
          value={weakCount ? `${weakCount} 个弱点` : "待评估"}
          done={weakCount > 0}
        />
      </div>
    </section>
  );
}

function PathPanel({ path }: { path: LearningPath }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{path.path_title}</h2>
          {path.estimated_time && (
            <p className="mt-1 text-xs text-slate-400">预计 {path.estimated_time}</p>
          )}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
          {path.steps.length} 步路径
        </span>
      </div>

      <ol className="relative space-y-4 border-l border-slate-200 pl-4">
        {path.steps.map((step) => (
          <li key={step.step} className="relative">
            <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />
            <h3 className="text-sm font-semibold text-slate-800">
              {step.step}. {step.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dedupeTasks(step.resource_tasks).map((task) => (
                <span
                  key={`${task.type}-${task.topic}`}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                >
                  {RESOURCE_LABEL[task.type]} · {task.topic}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LoopStep({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        done ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function dedupeCards(cards: ResourceCardState[]): ResourceCardState[] {
  const byType = new Map<ResourceType, ResourceCardState>();
  for (const card of cards) byType.set(card.resType, card);
  return Array.from(byType.values());
}

function dedupeTasks<T extends { type: ResourceType }>(tasks: T[]): T[] {
  const byType = new Map<ResourceType, T>();
  for (const task of tasks || []) byType.set(task.type, task);
  return Array.from(byType.values());
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}
