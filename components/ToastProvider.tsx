'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';

type Toast = { id: number; kind: ToastKind; message: string };

type ToastState = {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastState | null>(null);

const STYLES: Record<ToastKind, { bg: string; icon: string; text: string }> = {
  success: { bg: 'bg-tertiary-container', icon: 'check_circle', text: 'text-on-tertiary-container' },
  error: { bg: 'bg-error-container', icon: 'error', text: 'text-on-error-container' },
  info: { bg: 'bg-surface-container-high', icon: 'info', text: 'text-on-surface' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), kind === 'error' ? 6000 : 3500);
    },
    [remove],
  );

  const value = useMemo<ToastState>(
    () => ({
      toast,
      success: (message: string) => toast(message, 'success'),
      error: (message: string) => toast(message, 'error'),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-20 left-0 right-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map(({ id, kind, message }) => {
          const style = STYLES[kind];
          return (
            <div
              key={id}
              role="status"
              className={`pointer-events-auto w-full max-w-md rounded-lg shadow-md px-4 py-3 flex items-start gap-2 ${style.bg} ${style.text}`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">{style.icon}</span>
              <p className="font-body-sm text-body-sm flex-1">{message}</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => remove(id)}
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
