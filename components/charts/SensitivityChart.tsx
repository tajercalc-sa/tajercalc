"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculate, fmt, num, priceForTarget, type Inputs, type Target } from "@/lib/calc";
import { FollowTip } from "./FollowTip";

type Var = "ret" | "ads" | "price" | "orders";

// short = the button (fits 4 across on a 320px phone); label = used inside sentences
const VARS: { v: Var; short: string; label: string }[] = [
  { v: "ret", short: "المرتجعات", label: "نسبة المرتجعات" },
  { v: "ads", short: "الإعلان", label: "تكلفة الإعلان" },
  { v: "price", short: "السعر", label: "سعر البيع" },
  { v: "orders", short: "الطلبات", label: "عدد الطلبات" },
];
const NB = "\u00a0"; // keeps "37.5 ر.س" on one line

const H = 260;                                   // fixed height: reserved before measuring → no layout shift
const M = { top: 18, right: 14, bottom: 34, left: 56 };
const STEPS = 48;

function niceTicks(min: number, max: number, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => raw <= s) ?? 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/**
 * "When do I start losing money?" Profit per order (or per month, for order volume) as ONE input varies,
 * everything else held at the current values. Single series → no legend; the title names it.
 * Crosshair snaps to the nearest point, cursor-following tooltip, arrow keys for keyboard users,
 * and a table view so no value is hover-only.
 */
export function SensitivityChart({ inp, cur, target, setTarget, focusTarget }: {
  inp: Inputs; cur: string; target: Target; setTarget: (t: Target) => void; focusTarget: number;
}) {
  const [v, setV] = useState<Var>("ret");
  const targetInput = useRef<HTMLInputElement>(null);
  const section = useRef<HTMLElement>(null);

  // "بكم أبيع؟" from the receipt: switch to the price view, bring it on screen, focus the target field
  useEffect(() => {
    if (!focusTarget) return;
    setV("price");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const t = setTimeout(() => targetInput.current?.focus({ preventScroll: true }), reduce ? 0 : 450);
    return () => clearTimeout(t);
  }, [focusTarget]);
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [kbd, setKbd] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = useMemo(() => calculate(inp), [inp]);
  const tgt = useMemo(() => priceForTarget(base, target), [base, target]);

  const data = useMemo(() => {
    const P0 = num(inp.price), N = num(inp.orders);
    const adNow = base.adPerOrder;
    let x0 = 0, x1 = 60, nowX = Math.min(num(inp.ret), 100);
    let make = (x: number): Inputs => ({ ...inp, ret: String(x) });
    if (v === "ads") {
      // x is in the unit the visitor types: per incoming order (before confirmation); a monthly budget stays per shipped order
      const conf = num(inp.confirm) > 0 ? Math.min(num(inp.confirm), 100) / 100 : 1;
      const k = inp.adMode === "budget" ? 1 : conf;
      x1 = Math.max(10, Math.ceil(Math.max(adNow * k * 2, base.maxAdCostPerLead * 1.5)));
      nowX = adNow * k;
      make = (x) => ({ ...inp, adMode: "order", ads: String(inp.adMode === "budget" ? x * conf : x) });
    } else if (v === "price") {
      x0 = P0 > 0 ? P0 * 0.5 : 0; x1 = P0 > 0 ? P0 * 2 : 200; nowX = P0;
      // widen the range so the target price is on the chart (within reason)
      if (tgt.ok && tgt.priceBeforeDiscount > x1 * 0.9 && tgt.priceBeforeDiscount < Math.max(P0, 1) * 8) x1 = tgt.priceBeforeDiscount * 1.15;
      if (tgt.ok && tgt.priceBeforeDiscount < x0) x0 = Math.max(0, tgt.priceBeforeDiscount * 0.85);
      make = (x) => ({ ...inp, price: String(x) });
    } else if (v === "orders") {
      x1 = Math.max(50, Math.ceil(Math.max(N * 2, (base.breakEvenOrders ?? 0) * 2)));
      nowX = N; make = (x) => ({ ...inp, orders: String(x) });
    }
    const pick = (r: ReturnType<typeof calculate>) => (v === "orders" ? r.monthlyProfit : r.profit);
    const pts = Array.from({ length: STEPS + 1 }, (_, k) => {
      const x = x0 + ((x1 - x0) * k) / STEPS;
      return { x, y: pick(calculate(make(x))) };
    });
    // first sign change → break-even by linear interpolation
    let be: number | null = null;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      if ((a.y >= 0) !== (b.y >= 0)) { be = a.x + ((0 - a.y) * (b.x - a.x)) / (b.y - a.y); break; }
    }
    return { pts, x0, x1, nowX, nowY: pick(base), be, risingIsGood: pts[pts.length - 1].y >= pts[0].y };
  }, [inp, v, base, tgt]);

  // target line in profit units, as a function of the typed price x: margin m → m·(1−discount)·x; amount X → X
  const showTarget = v === "price" && tgt.ok;
  const targetY = (x: number) => (target.kind === "margin" ? (num(target.value) / 100) * (1 - base.discount) * x : num(target.value));

  const unitX = (x: number) => (v === "ret" ? `${fmt(x)}%` : v === "orders" ? `${fmt(Math.round(x))} طلب` : `${fmt(x)} ${cur}`);
  const yLabel = v === "orders" ? "ربح الشهر" : "ربح الطلب";

  const ys = data.pts.map((p) => p.y).concat(showTarget ? [targetY(data.x0), targetY(data.x1)] : []);
  const yTicks = niceTicks(Math.min(0, ...ys), Math.max(0, ...ys));
  const yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
  const iw = Math.max(10, W - M.left - M.right), ih = H - M.top - M.bottom;
  const sx = (x: number) => M.left + ((x - data.x0) / (data.x1 - data.x0 || 1)) * iw;
  const sy = (y: number) => M.top + (1 - (y - yMin) / (yMax - yMin || 1)) * ih;
  const xTicks = niceTicks(data.x0, data.x1, W < 420 ? 3 : 5).filter((t) => t >= data.x0 - 1e-9 && t <= data.x1 + 1e-9);
  const line = data.pts.map((p, k) => `${k ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
  const zeroY = sy(0);

  const activeI = hover?.i ?? kbd;
  const active = activeI != null ? data.pts[activeI] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left - M.left) / iw;
    const i = Math.max(0, Math.min(STEPS, Math.round(rel * STEPS)));
    setKbd(null);
    setHover({ i, x: e.clientX, y: e.clientY });
  };
  const onKey = (e: React.KeyboardEvent) => {
    const cur0 = kbd ?? Math.round(((data.nowX - data.x0) / (data.x1 - data.x0 || 1)) * STEPS);
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -STEPS : e.key === "End" ? STEPS : 0;
    if (!d) return;
    e.preventDefault();
    setHover(null);
    setKbd(Math.max(0, Math.min(STEPS, cur0 + d)));
  };
  const kbdPos = (() => {
    if (kbd == null || !wrap.current) return null;
    const r = wrap.current.getBoundingClientRect();
    return { x: r.left + sx(data.pts[kbd].x), y: r.top + sy(data.pts[kbd].y) };
  })();

  // the sentence the chart exists to answer
  const headline = (() => {
    const be = data.be;
    if (be == null && v === "orders" && num(inp.fixedMonthly) === 0)
      return "ما عندك تكاليف شهرية ثابتة، فكل طلب رابح يضيف لربح الشهر مباشرة.";
    if (be == null) return data.pts.every((p) => p.y >= 0)
      ? "يبقى الطلب رابحاً في كل القيم المعروضة."
      : "يبقى الطلب خاسراً في كل القيم المعروضة.";
    if (v === "ret") return `يتحمّل طلبك مرتجعات حتى ${fmt(be)}% قبل أن يبدأ بالخسارة.`;
    if (v === "ads") {
      const beforeConfirm = num(inp.confirm) > 0 && num(inp.confirm) < 100 && inp.adMode !== "budget";
      return `أقصى تكلفة إعلان للطلب${beforeConfirm ? " قبل التأكيد" : ""} قبل الخسارة: ${fmt(be)}${NB}${cur}.`;
    }
    if (v === "price") {
      const base0 = `أقل سعر بيع بدون خسارة ${fmt(be)}${NB}${cur}`;
      const goal = target.kind === "margin" ? `لهامش ${fmt(num(target.value))}%` : `لربح ${fmt(num(target.value))}${NB}${cur} للطلب`;
      if (tgt.ok) return `${base0}، و${goal} بِع بـ ${fmt(tgt.priceBeforeDiscount)}${NB}${cur}.`;
      if (!tgt.ok && tgt.reason === "impossible")
        return target.kind === "margin"
          ? `${base0}. هامش ${fmt(num(target.value))}% غير ممكن بهذه التكاليف: مهما رفعت السعر يبقى الهامش أقل من ${fmt(tgt.maxMarginPct)}%.`
          : `${base0}. هدفك غير ممكن بهذه التكاليف.`;
      return `${base0}.`;
    }
    return `تحتاج ${fmt(Math.ceil(be))} طلباً في الشهر لتغطية تكاليفك الثابتة.`;
  })();

  return (
    <section ref={section} aria-labelledby="sens-title" className="min-w-0 scroll-mt-4 rounded-2xl bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="sens-title" className="text-lg font-bold">متى يبدأ الطلب بالخسارة؟</h2>
          <p className="mt-1 text-sm text-muted">{yLabel} إذا تغيّرت {VARS.find((x) => x.v === v)!.label} وبقيت بقية أرقامك كما هي.</p>
        </div>
        <div role="radiogroup" aria-label="المتغيّر" className="grid w-full grid-cols-4 gap-1 rounded-lg bg-bg p-1 sm:w-auto">
          {VARS.map((o) => (
            <button key={o.v} type="button" role="radio" aria-checked={v === o.v} onClick={() => { setV(o.v); setHover(null); setKbd(null); }}
              className={`min-w-0 rounded-md px-2 py-1.5 text-xs transition duration-200 ease-out active:scale-95 sm:text-sm
                focus-visible:outline-2 focus-visible:outline-accent
                ${v === o.v ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:bg-surface/60 hover:text-ink"}`}>
              {o.short}
            </button>
          ))}
        </div>
      </div>

      <p key={headline} className="value-pulse mt-4 text-base font-medium">{headline}</p>

      {/* "بكم أبيع؟": only meaningful on the price view */}
      {v === "price" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">هدفي:</span>
          <div role="radiogroup" aria-label="نوع الهدف" className="grid grid-cols-2 gap-1 rounded-lg bg-bg p-1">
            {([["margin", "هامش من السعر"], ["amount", "ربح ثابت للطلب"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={target.kind === k} onClick={() => setTarget({ ...target, kind: k })}
                className={`rounded-md px-2.5 py-1.5 transition duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-accent
                  ${target.kind === k ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:bg-surface/60 hover:text-ink"}`}>{l}</button>
            ))}
          </div>
          <span className="relative block w-32">
            <input ref={targetInput} type="number" inputMode="decimal" min={0} step="any" value={target.value} placeholder={target.kind === "margin" ? "مثلاً 30" : "مثلاً 25"}
              aria-label={target.kind === "margin" ? "الهامش اللي تبيه من سعر البيع" : "الربح اللي تبيه لكل طلب"}
              aria-invalid={!tgt.ok && tgt.reason === "impossible" ? true : undefined}
              onChange={(e) => setTarget({ ...target, value: e.target.value })}
              className={`block w-full min-w-0 rounded-lg border bg-bg py-2 pl-11 pr-3 text-right text-base tabular text-ink [direction:ltr]
                transition-[border-color,box-shadow] duration-200 hover:border-muted/60 focus-visible:outline-2 focus-visible:outline-offset-1
                ${!tgt.ok && tgt.reason === "impossible" ? "border-warn focus-visible:outline-warn" : "border-line focus-visible:outline-accent"}`} />
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{target.kind === "margin" ? "%" : cur}</span>
          </span>
          {target.value !== "" && (
            <button type="button" onClick={() => setTarget({ ...target, value: "" })} aria-label="امسح الهدف"
              className="grid size-8 place-items-center rounded-md text-muted transition duration-200 hover:bg-bg hover:text-ink active:scale-90
                focus-visible:outline-2 focus-visible:outline-accent">
              <svg viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2 [stroke-linecap:round]" aria-hidden><path d="M6 6l8 8M14 6l-8 8" /></svg>
            </button>
          )}
        </div>
      )}

      <div ref={wrap} dir="ltr" className="relative mt-3" style={{ height: H }}>
        {W === 0 ? (
          <div className="skeleton h-full w-full rounded-lg" aria-hidden />
        ) : (
          <svg width={W} height={H} role="img" tabIndex={0}
            aria-label={`${yLabel} حسب ${VARS.find((x) => x.v === v)!.label}. ${headline} استخدم الأسهم للتنقل بين النقاط.`}
            onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setKbd(null)}
            className="block touch-pan-y cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <defs>
              <clipPath id="above0"><rect x={M.left} y={M.top} width={iw} height={Math.max(0, zeroY - M.top)} /></clipPath>
              <clipPath id="below0"><rect x={M.left} y={zeroY} width={iw} height={Math.max(0, M.top + ih - zeroY)} /></clipPath>
            </defs>
            {/* recessive solid hairline grid + y ticks */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + iw} y1={sy(t)} y2={sy(t)}
                  className={t === 0 ? "stroke-muted" : "stroke-line"} strokeWidth={1} />
                <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-muted tabular text-[11px]">{fmt(t)}</text>
              </g>
            ))}
            {/* area wash + 2px line, animated between variables via path transition */}
            {/* area wash between the line and zero: profit side in the accent, loss side in the loss colour */}
            <path d={`${line}L${sx(data.x1)},${zeroY}L${sx(data.x0)},${zeroY}Z`} clipPath="url(#above0)" className="fill-accent/10 transition-[d] duration-300 ease-out" />
            <path d={`${line}L${sx(data.x1)},${zeroY}L${sx(data.x0)},${zeroY}Z`} clipPath="url(#below0)" className="fill-loss/15 transition-[d] duration-300 ease-out" />
            <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              className="stroke-accent transition-[d] duration-300 ease-out" />

            {/* break-even annotation */}
            {data.be != null && (
              <g>
                <line x1={sx(data.be)} x2={sx(data.be)} y1={M.top} y2={M.top + ih} className="stroke-ink/50" strokeWidth={1} />
              </g>
            )}

            {/* target: the line the merchant wants to reach, and where the profit line meets it */}
            {showTarget && tgt.ok && (
              <g pointerEvents="none">
                <line x1={sx(data.x0)} y1={sy(targetY(data.x0))} x2={sx(data.x1)} y2={sy(targetY(data.x1))}
                  className="stroke-saffron transition-all duration-300" strokeWidth={2} strokeLinecap="round" />
                {tgt.priceBeforeDiscount >= data.x0 && tgt.priceBeforeDiscount <= data.x1 && (
                  <circle cx={sx(tgt.priceBeforeDiscount)} cy={sy(tgt.profit)} r={6} className="fill-saffron stroke-surface" strokeWidth={2} />
                )}
              </g>
            )}

            {/* current position: 8px+ dot with 2px surface ring */}
            {data.nowX >= data.x0 && data.nowX <= data.x1 && (
              <g className="transition-transform duration-300 ease-out" style={{ transform: `translate(${sx(data.nowX)}px, ${sy(data.nowY)}px)` }}>
                <circle r={6} className="fill-ink stroke-surface" strokeWidth={2} />
              </g>
            )}

            {/* crosshair + snapped point */}
            {active && (
              <g pointerEvents="none">
                <line x1={sx(active.x)} x2={sx(active.x)} y1={M.top} y2={M.top + ih} className="stroke-ink/40" strokeWidth={1} />
                <circle cx={sx(active.x)} cy={sy(active.y)} r={5} className="fill-accent stroke-surface" strokeWidth={2} />
              </g>
            )}
            {/* hit area larger than the marks */}
            <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent" />
          </svg>
        )}
        {W > 0 && (
          <div dir="rtl" aria-hidden className="pointer-events-none absolute inset-0 text-[11px] leading-none">
            {data.be != null && (
              <span className="absolute whitespace-nowrap rounded bg-surface/85 px-1 py-0.5 font-medium text-ink transition-[left] duration-300"
                style={{ top: M.top + 2, left: sx(data.be), transform: `translateX(${sx(data.be) > M.left + iw * 0.7 ? "calc(-100% - 6px)" : "6px"})` }}>
                التعادل <span className="num">{unitX(data.be)}</span>
              </span>
            )}
            {showTarget && tgt.ok && tgt.priceBeforeDiscount >= data.x0 && tgt.priceBeforeDiscount <= data.x1 && (
              <span className="absolute whitespace-nowrap rounded bg-surface/90 px-1 py-0.5 font-bold text-ink transition-[left,top] duration-300"
                style={{ left: sx(tgt.priceBeforeDiscount), top: sy(tgt.profit) - 26,
                  transform: `translateX(${sx(tgt.priceBeforeDiscount) > M.left + iw * 0.75 ? "calc(-100% + 8px)" : "-50%"})` }}>
                هدفك <span className="num">{fmt(tgt.priceBeforeDiscount)}{NB}{cur}</span>
              </span>
            )}
            {data.nowX >= data.x0 && data.nowX <= data.x1 && (
              <span className="absolute -translate-x-1/2 whitespace-nowrap font-bold text-ink transition-[left,top] duration-300"
                style={{ left: sx(data.nowX),
                  // if the target label sits right above-beside this one, drop "أرقامك" under its dot so they never touch
                  top: showTarget && tgt.ok && Math.abs(sx(tgt.priceBeforeDiscount) - sx(data.nowX)) < 110 && Math.abs(sy(tgt.profit) - sy(data.nowY)) < 40
                    ? sy(data.nowY) + 12 : sy(data.nowY) - 24 }}>أرقامك</span>
            )}
            {/* x ticks in HTML so "50 ر.س" keeps its Arabic order; edge ticks align inward so they are never clipped */}
            {xTicks.map((t, k) => (
              <span key={t} className="num absolute whitespace-nowrap tabular text-muted"
                style={{ top: H - 16, left: sx(t), transform: `translateX(${k === 0 && sx(t) - M.left < 24 ? "0" : k === xTicks.length - 1 && M.left + iw - sx(t) < 24 ? "-100%" : "-50%"})` }}>
                {unitX(t)}
              </span>
            ))}
            {yMin < 0 && (() => {
              // just under the zero line, at the end where the loss is deepest: inside the red wedge, clear of the line
              const lossAtRight = data.pts[data.pts.length - 1].y < data.pts[0].y;
              // only label the band when the red wedge is big enough to hold the text without touching the line
              const edgeY = sy(lossAtRight ? data.pts[data.pts.length - 1].y : data.pts[0].y);
              const span = data.be == null ? iw : lossAtRight ? M.left + iw - sx(data.be) : sx(data.be) - M.left;
              if (span < 130 || edgeY - zeroY < 30) return null;
              return (
                <span className="absolute whitespace-nowrap font-medium text-loss"
                  style={{ top: zeroY + 6, ...(lossAtRight ? { left: M.left + iw - 8, transform: "translateX(-100%)" } : { left: M.left + 8 }) }}>
                  منطقة الخسارة
                </span>
              );
            })()}
          </div>
        )}
      </div>

      <FollowTip x={hover?.x ?? kbdPos?.x ?? 0} y={hover?.y ?? kbdPos?.y ?? 0} visible={!!active}>
        {active && (
          <>
            <div className={`text-base font-bold ${active.y < 0 ? "text-[#ff9a90] dark:text-loss" : ""}`}>
              <span className="num">{fmt(active.y)}</span> {cur}
            </div>
            <div className="mt-0.5 flex items-center gap-2 opacity-80">
              <span className="h-0.5 w-3 rounded bg-accent" />{yLabel} عند {unitX(active.x)}
            </div>
          </>
        )}
      </FollowTip>

      <details className="group mt-3 text-sm">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-muted transition-colors hover:text-ink
          focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2 transition-transform duration-200 group-open:-rotate-90" aria-hidden><path d="M12 5l-5 5 5 5" /></svg>
          عرض الأرقام كجدول
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-right">
            <thead className="sticky top-0 bg-surface"><tr><th className="border-b border-line px-3 py-2 font-medium">{VARS.find((x) => x.v === v)!.label}</th><th className="border-b border-line px-3 py-2 font-medium">{yLabel}</th></tr></thead>
            <tbody>
              {data.pts.filter((_, k) => k % 4 === 0).map((p) => (
                <tr key={p.x} className="transition-colors hover:bg-bg">
                  <td className="border-b border-line px-3 py-1.5 tabular">{unitX(p.x)}</td>
                  <td className={`border-b border-line px-3 py-1.5 tabular ${p.y < 0 ? "text-loss" : ""}`}><span className="num">{fmt(p.y)}</span> {cur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
