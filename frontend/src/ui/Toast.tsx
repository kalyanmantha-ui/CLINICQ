import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastKind = 'ok' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; text: string }

const Ctx = createContext<(kind: ToastKind, text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** Shows one message at a time (a new one replaces the old), announced politely to screen readers, and dismisses itself. */
export function ToastProvider({ children, durationMs = 5000 }: { children: ReactNode; durationMs?: number }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<number>();
  const idRef = useRef(0);
  const show = useCallback((kind: ToastKind, text: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: ++idRef.current, kind, text });
    timer.current = window.setTimeout(() => setToast(null), durationMs);
  }, [durationMs]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} className={`toast ${toast.kind}`}>
            <span>{toast.text}</span>
            <button type="button" className="link" aria-label="Dismiss message" onClick={() => setToast(null)}>×</button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
