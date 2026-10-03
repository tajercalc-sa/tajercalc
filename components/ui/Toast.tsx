"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Kind = "success" | "info" | "error";
type Toast = { id: number; kind: Kind; text: string; action?: { label: string; run: () => void }; leaving?: boolean; duration: number };
type Api = { show: (text: string, opts?: { kind?: Kind; action?: Toast["action"]; duration?: number }) => void };

const Ctx = createContext<Api>({ show: () => {} });
export const useToast = () => useContext(Ctx);

const ICON: Record<Kind, React.ReactNode> = {
  success: <path d="M5 10.5l3.2 3.2L15 7" />,
  info: <><circle cx="10" cy="10" r="7" /><path d="M10 9v4M10 6.5v.01" /></>,
  error: <><circle cx="10" cy="10" r="7" /><path d="M10 6.5v4M10 13.5v.01" /></>,
};

/**
 * Toasts: slide in from below, auto-dismiss with a visible timer bar, pause on hover/focus,
 * close by button or Escape, optional action (e.g. "تراجع"). aria-live announces them.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, { t: ReturnType<typeof setTimeout>; left: number; started: number }>());
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 180);
    const tm = timers.current.get(id); if (tm) clearTimeout(tm.t); timers.current.delete(id);
  }, []);

  const arm = useCallback((id: number, ms: number) => {
    timers.current.set(id, { t: setTimeout(() => remove(id), ms), left: ms, started: Date.now() });
  }, [remove]);

  const show = useCallback<Api["show"]>((text, opts) => {
    const id = nextId.current++;
    const duration = opts?.duration ?? (opts?.action ? 6000 : 3200);
    setItems((xs) => [...xs.slice(-2), { id, text, kind: opts?.kind ?? "success", action: opts?.action, duration }]);
    arm(id, duration);
  }, [arm]);

  const pause = (id: number) => {
    const tm = timers.current.get(id); if (!tm) return;
    clearTimeout(tm.t); tm.left -= Date.now() - tm.started;
  };
  const resume = (id: number) => {
    const tm = timers.current.get(id); if (!tm) return;
    tm.started = Date.now(); tm.t = setTimeout(() => remove(id), Math.max(400, tm.left));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && items.length) remove(items[items.length - 1].id); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, remove]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {/* bottom-6rem on mobile clears the sticky result bar */}
      <div aria-live="polite" aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 print:hidden">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
            onMouseEnter={(e) => { pause(t.id); e.currentTarget.classList.add("toast-paused"); }}
            onMouseLeave={(e) => { resume(t.id); e.currentTarget.classList.remove("toast-paused"); }}
            onFocus={(e) => { pause(t.id); e.currentTarget.classList.add("toast-paused"); }}
            onBlur={(e) => { resume(t.id); e.currentTarget.classList.remove("toast-paused"); }}
            className={`${t.leaving ? "toast-out" : "toast-in"} pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl
              border border-line bg-ink text-bg shadow-lg dark:bg-paper dark:text-ink`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <svg viewBox="0 0 20 20" className={`size-5 shrink-0 fill-none stroke-2 [stroke-linecap:round] [stroke-linejoin:round]
                ${t.kind === "error" ? "stroke-loss" : "stroke-[#5fe3b0] dark:stroke-accent"}`} aria-hidden>{ICON[t.kind]}</svg>
              <p className="m-0 min-w-0 flex-1 text-sm">{t.text}</p>
              {t.action && (
                <button type="button" onClick={() => { t.action!.run(); remove(t.id); }}
                  className="shrink-0 rounded-md px-2 py-1 text-sm font-bold text-[#5fe3b0] transition-colors hover:bg-white/10 active:scale-95
                    focus-visible:outline-2 focus-visible:outline-[#5fe3b0] dark:text-accent dark:hover:bg-accent/10">
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="إغلاق" onClick={() => remove(t.id)}
                className="grid size-7 shrink-0 place-items-center rounded-md opacity-70 transition hover:bg-white/10 hover:opacity-100 active:scale-90
                  focus-visible:outline-2 focus-visible:outline-current dark:hover:bg-ink/10">
                <svg viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2 [stroke-linecap:round]" aria-hidden><path d="M6 6l8 8M14 6l-8 8" /></svg>
              </button>
            </div>
            <span aria-hidden className="toast-timer absolute inset-x-0 bottom-0 h-0.5 bg-current opacity-40" style={{ animationDuration: `${t.duration}ms` }} />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
