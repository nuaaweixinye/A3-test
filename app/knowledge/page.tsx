"use client";

import { useState, useEffect, useRef } from "react";
import { showToast } from "@/frontend/components/ui/Toast";

interface KbFile {
  fileId?: string;
  fileName?: string;
  name?: string;
  [key: string]: unknown;
}

export default function KnowledgePage() {
  const [files, setFiles] = useState<KbFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/kb/files");
      const data = await res.json();
      if (data.error) {
        showToast(String(data.error), "error");
        setFiles([]);
      } else {
        setFiles((data.files as KbFile[]) || []);
      }
    } catch {
      showToast("加载文件列表失败", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kb/files")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          showToast(String(data.error), "error");
          setFiles([]);
        } else {
          setFiles((data.files as KbFile[]) || []);
        }
      })
      .catch(() => {
        if (!cancelled) showToast("加载文件列表失败", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function pickFile() {
    inputRef.current?.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFile(e.target.files?.[0]);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleFile(file: File | null | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    setLoading(true);
    try {
      await uploadWithProgress(file, (p) => setProgress(p));
      showToast(`「${file.name}」上传成功`, "success");
      await refresh();
    } catch (e) {
      showToast((e as Error)?.message || "上传失败", "error");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">知识库管理</h1>
        <p className="text-sm text-slate-500">
          上传课程文档至星火 ChatDoc 知识库 · 供辅导检索与防幻觉引用
        </p>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={pickFile}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? "border-violet-400 bg-violet-50"
            : "border-slate-300 bg-white hover:border-violet-300 hover:bg-violet-50/40"
        }`}
      >
        <input ref={inputRef} type="file" className="hidden" onChange={onInputChange} />
        {uploading ? (
          <div className="w-full max-w-sm">
            <p className="text-sm font-medium text-slate-700">上传中… {progress}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-violet-600 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-2xl">
              ⬆
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="mt-1 text-xs text-slate-400">
              支持 PDF / Word / Markdown / TXT / Excel 等格式
            </p>
          </>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">已上传文件</h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">加载文件列表中…</p>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-400">
            知识库暂无文件，上传后将用于辅导检索与防幻觉校验。
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {files.map((f, i) => (
              <li
                key={f.fileId || `${f.fileName ?? f.name}-${i}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {displayName(f)}
                  </p>
                  {f.fileId && (
                    <p className="truncate text-xs text-slate-400">{String(f.fileId)}</p>
                  )}
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-emerald-200">
                  已上传
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function displayName(f: KbFile): string {
  if (typeof f.fileName === "string" && f.fileName) return f.fileName;
  if (typeof f.name === "string" && f.name) return f.name;
  return "未命名文件";
}

function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.error) {
            reject(new Error(String(data.error)));
          } else {
            resolve();
          }
        } catch {
          resolve();
        }
      } else {
        let msg = `上传失败：HTTP ${xhr.status}`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.error) msg = String(data.error);
        } catch {
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.open("POST", "/api/kb/upload");
    xhr.send(fd);
  });
}
