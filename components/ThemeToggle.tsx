"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

type Mode = "system" | "light" | "dark";
const KEY = "theme";

type VTDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

/**
 * Same logic as the inline script in layout.tsx (that one runs before paint).
 * The switch is one View Transition: a circle of the new theme grows from the button that was pressed.
 * While it runs, every CSS transition is switched off so no element fades on its own afterwards
 * (that second, per-element fade was what made the switch feel laggy). No support / reduced motion: instant.
 */
function apply(mode: Mode, animate: boolean, from?: { x: number; y: number }, extra?: () => void) {
  const root = document.documentElement;
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "dark" : "light";
  const set = () => {
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    root.dataset.themeMode = mode;
    extra?.();
    void root.offsetWidth; // apply the new colours with transitions off
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  };
  const doc = document as VTDoc;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animate || reduce || !doc.startViewTransition || root.dataset.theme === next) { set(); return; }

  const x = from?.x ?? innerWidth / 2, y = from?.y ?? 0;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  doc.startViewTransition(set).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 480, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => {});
}

const OPTIONS: { mode: Mode; label: string; icon: React.ReactNode }[] = [
  { mode: "system", label: "حسب الجهاز", icon: <><rect x="3" y="4" width="14" height="10" rx="1.5" /><path d="M7 17h6M10 14v3" /></> },
  { mode: "light", label: "فاتح", icon: <><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3L6 14M14 6l1.3-1.3" /></> },
  { mode: "dark", label: "داكن", icon: <path d="M15.5 12.2A6 6 0 0 1 7.8 4.5a6 6 0 1 0 7.7 7.7z" /> },
];

export function ThemeToggle() {
  // null until mounted: the server can't know the visitor's choice, so render a same-size placeholder (no layout shift).
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    setMode((document.documentElement.dataset.themeMode as Mode) || "system");
  }, []);

  // In "system" mode, follow OS changes live.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system", true);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);

  const choose = (m: Mode, e: React.MouseEvent<HTMLButtonElement>) => {
    if (m === mode) return;
    try { m === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, m); } catch { /* private mode: works for this visit only */ }
    const b = e.currentTarget.getBoundingClientRect();
    // the toggle's own highlight moves inside the transition, so the new snapshot already shows it
    apply(m, true, { x: b.left + b.width / 2, y: b.top + b.height / 2 }, () => flushSync(() => setMode(m)));
  };

  return (
    <div role="radiogroup" aria-label="المظهر" className="flex h-9 items-center gap-0.5 rounded-full border border-line bg-bg p-0.5">
      {OPTIONS.map((o) => {
        const on = mode === o.mode;
        return (
          <button key={o.mode} type="button" role="radio" aria-checked={on} aria-label={o.label} title={o.label}
            disabled={mode === null} onClick={(e) => choose(o.mode, e)}
            className={`grid size-8 place-items-center rounded-full transition duration-200 ease-out active:scale-90 disabled:cursor-wait disabled:opacity-60
              focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent
              ${on ? "bg-surface text-ink shadow-sm" : "text-muted hover:bg-surface/60 hover:text-ink"}`}>
            <svg viewBox="0 0 20 20" className={`size-[18px] fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round] transition-transform duration-300
              ${on ? "rotate-0 scale-100" : "-rotate-12 scale-90"}`} aria-hidden>{o.icon}</svg>
          </button>
        );
      })}
    </div>
  );
}
