"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip that follows the cursor (or sits at a keyboard-focused point).
 * Fixed-positioned in a portal, offset from the pointer, flipped and clamped at viewport edges
 * so it never overflows on phones. Only opacity/scale animate; the position tracks the pointer 1:1.
 */
export function FollowTip({ x, y, visible, children }: { x: number; y: number; visible: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, m = 8, off = 14;
    let left = x + off, top = y - h - off;
    if (left + w > window.innerWidth - m) left = x - w - off;   // flip to the other side
    if (top < m) top = y + off;                                   // flip below the pointer
    left = Math.max(m, Math.min(left, window.innerWidth - w - m));
    top = Math.max(m, Math.min(top, window.innerHeight - h - m));
    setPos({ left, top });
  }, [x, y, children, visible]);

  if (!mounted) return null;
  return createPortal(
    <div ref={ref} role="tooltip" dir="rtl" aria-hidden={!visible} style={{ left: pos.left, top: pos.top }}
      className={`pointer-events-none fixed z-50 min-w-32 rounded-lg bg-ink px-3 py-2 text-sm text-bg shadow-lg ring-1 ring-black/5
        transition-[opacity,scale] duration-150 ease-out dark:bg-paper dark:text-ink dark:ring-line print:hidden
        ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
      {children}
    </div>,
    document.body,
  );
}
