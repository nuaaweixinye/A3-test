"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";

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
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
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
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-[slideIn_0.2s_ease-out] rounded-lg px-4 py-2.5 text-sm shadow-lg ${
              t.type === "error"
                ? "bg-rose-600 text-white"
                : t.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-white"
            }`}
          >
            {t.type === "error" ? "✕ " : t.type === "success" ? "✓ " : ""}
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
