"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "؟" explainer next to a metric. Snaps above its button (flips below if there's no room),
 * clamped inside the viewport so it never causes horizontal scroll on phones.
 * Opens on hover (small delay), keyboard focus or tap; closes on leave, blur, Escape or tapping elsewhere.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the fade/scale transition
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean }>({ top: -9999, left: 0, below: false });
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A tap fires focus (opens) and then click (would toggle closed). Ignore a click right after an open.
  const openedAt = useRef(0);

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    // offsetWidth/Height = real layout size; getBoundingClientRect would return the scaled-down size mid-animation
    const el = tip.current;
    if (!b || !el) return;
    const t = { width: el.offsetWidth, height: el.offsetHeight };
    const m = 8;
    const below = b.top - t.height - 10 < m;
    const top = below ? b.bottom + 10 : b.top - t.height - 10;
    const left = Math.min(window.innerWidth - t.width - m, Math.max(m, b.left + b.width / 2 - t.width / 2));
    setPos({ top, left, below });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      // Escape: just close. Focus is already on the button; refocusing it would reopen the tip.
      if (e instanceof KeyboardEvent) { if (e.key === "Escape") hide(); return; }
      if (!btn.current?.contains(e.target as Node)) hide();
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  function show() { clearTimeout(hoverTimer.current); if (!open) openedAt.current = Date.now(); setOpen(true); }
  function hide() { clearTimeout(hoverTimer.current); setShown(false); setTimeout(() => setOpen(false), 150); }

  return (
    <>
      <button ref={btn} type="button" aria-label={`شرح: ${label}`} aria-describedby={open ? id : undefined} aria-expanded={open}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(show, 120); } }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") hide(); }}
        onFocus={show} onBlur={hide}
        onClick={(e) => { e.stopPropagation(); if (open && Date.now() - openedAt.current > 350) hide(); else show(); }}
        className="relative mx-1 inline-grid size-[18px] shrink-0 place-items-center rounded-full border border-current align-[-3px] text-[11px] font-bold
          leading-none text-muted transition-colors duration-200 hover:bg-ink hover:text-surface active:scale-90
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
          before:absolute before:-inset-3 before:content-['']">
        ؟
      </button>
      {open && createPortal(
        <div ref={tip} id={id} role="tooltip" style={{ top: pos.top, left: pos.left }}
          className={`pointer-events-none fixed z-50 w-max max-w-[min(18rem,calc(100vw-16px))] rounded-lg bg-ink px-3 py-2 text-sm leading-relaxed
            text-bg shadow-lg transition duration-150 ease-out dark:bg-paper dark:text-ink dark:ring-1 dark:ring-line
            ${shown ? "translate-y-0 scale-100 opacity-100" : `${pos.below ? "-translate-y-1" : "translate-y-1"} scale-95 opacity-0`}`}
          dir="rtl">
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
