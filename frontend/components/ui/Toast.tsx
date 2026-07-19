"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

type ToastFn = (msg: string, type?: ToastItem["type"]) => void;

let externalToast: ToastFn | null = null;

export function showToast(msg: string, type: ToastItem["type"] = "info") {
  externalToast?.(msg, type);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToastCb = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    externalToast = showToastCb;
    return () => {
      externalToast = null;
    };
  }, [showToastCb]);

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-[slideIn_0.2s_ease-out] rounded-lg px-4 py-2.5 text-sm shadow-lg ${
              toast.type === "error"
                ? "bg-rose-600 text-white"
                : toast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-white"
            }`}
          >
            <span className="mr-1 font-semibold">{labelForType(toast.type)}：</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function labelForType(type: ToastItem["type"]): string {
  if (type === "success") return "成功";
  if (type === "error") return "错误";
  return "提示";
}
