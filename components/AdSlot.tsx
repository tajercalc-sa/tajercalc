"use client";

import { useEffect, useRef } from "react";
import { SITE } from "@/lib/site";

declare global { interface Window { adsbygoogle?: unknown[] } }

/**
 * One AdSense unit with reserved height (prevents layout shift / CLS).
 * - No client id configured (before approval): renders NOTHING in production,
 *   a dashed placeholder in `next dev` so you can see the placement.
 * - Never place next to inputs or buttons: accidental clicks break AdSense policy.
 */
export function AdSlot({ slot, label = "إعلان", minHeight = 280 }: { slot: string; label?: string; minHeight?: number }) {
  const pushed = useRef(false);
  const live = Boolean(SITE.adsClient && slot);

  useEffect(() => {
    if (!live || pushed.current) return;
    pushed.current = true;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by an ad blocker */ }
  }, [live]);

  if (!live) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div style={{ minHeight }} className="my-8 grid place-items-center rounded-xl border-2 border-dashed border-line text-sm text-muted">
        مكان إعلان: {label}
      </div>
    );
  }

  return (
    <aside aria-label="إعلان" className="my-8 overflow-hidden" style={{ minHeight }}>
      <p className="mb-1 text-center text-xs text-muted">إعلان</p>
      <ins className="adsbygoogle block" style={{ display: "block" }}
        data-ad-client={SITE.adsClient} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
