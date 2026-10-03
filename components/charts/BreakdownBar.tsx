"use client";

import { useState } from "react";
import { fmt, type Part } from "@/lib/calc";
import { FollowTip } from "./FollowTip";

/**
 * Stacked bar: where each unit of the selling price goes. Part-to-whole → one stacked bar, categorical slots
 * c1..c7 in fixed order, 2px gaps between segments, 4px rounded outer ends.
 * Every segment is its own hover/focus target with a cursor-following tooltip; all values are also written
 * in the receipt lines (the table view), so the tooltip never gates information.
 */
export function BreakdownBar({ parts, price, cur }: { parts: Part[]; price: number; cur: string }) {
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const segs = parts.map((p) => ({ ...p, v: Math.max(p.value, 0) })).filter((p) => p.v > 0.0001);
  const total = segs.reduce((s, p) => s + p.v, 0);
  const cur1 = tip ? segs[tip.i] : null;

  return (
    <>
      <div role="list" aria-label="توزيع سعر البيع" className="my-3 flex h-3.5 gap-[2px]" onPointerLeave={() => setTip(null)}>
        {segs.map((p, i) => (
          <span key={p.key} role="listitem" tabIndex={0}
            aria-label={`${p.label}: ${fmt(p.value)} ${cur}، ${fmt(price > 0 ? (p.value / price) * 100 : 0)}% من السعر`}
            onPointerMove={(e) => setTip({ i, x: e.clientX, y: e.clientY })}
            onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ i, x: r.left + r.width / 2, y: r.top }); }}
            onBlur={() => setTip(null)}
            style={{ flexGrow: p.v / total, background: `var(--${p.key})` }}
            className={`relative block min-w-[3px] basis-0 cursor-pointer transition-[filter,transform,flex-grow] duration-300 ease-out
              first:rounded-r-[4px] last:rounded-l-[4px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
              before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']
              ${tip && tip.i !== i ? "opacity-45" : "opacity-100"} ${tip?.i === i ? "scale-y-125" : ""}`} />
        ))}
      </div>
      <FollowTip x={tip?.x ?? 0} y={tip?.y ?? 0} visible={!!cur1}>
        {cur1 && (
          <>
            <div className="text-base font-bold"><span className="num">{fmt(cur1.value)}</span> {cur}</div>
            <div className="mt-0.5 flex items-center gap-2 opacity-80">
              <span className="h-0.5 w-3 rounded" style={{ background: `var(--${cur1.key})` }} />
              {cur1.label}، <span className="num">{fmt(price > 0 ? (cur1.value / price) * 100 : 0)}%</span> من السعر
            </div>
          </>
        )}
      </FollowTip>
    </>
  );
}
