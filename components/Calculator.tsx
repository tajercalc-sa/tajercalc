"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  calculate, fmt, num, priceForTarget, CURRENCIES, DEFAULT_INPUTS, PAYMENT_METHODS,
  type AdMode, type Inputs, type Target,
} from "@/lib/calc";
import { clearHash, load, readHash, sameAs, save, shareUrl, DEFAULT_SNAPSHOT, type Snapshot } from "@/lib/state";
import { SALLA, type Platform } from "@/lib/platforms";
import type { Var } from "./charts/SensitivityChart";
import { PrintReport } from "./PrintReport";
import { BreakdownBar } from "./charts/BreakdownBar";
import { SensitivityChart } from "./charts/SensitivityChart";
import { InfoTip } from "./ui/InfoTip";
import { useToast } from "./ui/Toast";
import { usePulseKey, useTweened } from "@/lib/motion";

/* ───────── small building blocks ───────── */

// text-base (16px): smaller inputs make iOS Safari zoom the page on focus.
// min-w-0 + w-full: inputs shrink inside grids instead of forcing a horizontal scroll.
const box =
  "block w-full min-w-0 rounded-lg border border-line bg-bg text-base text-ink transition-[border-color,background-color,box-shadow] duration-200 ease-out " +
  "hover:border-muted/60 disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

function NumInput({ value, onChange, suffix, ariaLabel, flashKey, step }: {
  value: string; onChange: (v: string) => void; suffix?: string; ariaLabel?: string; flashKey?: number; step?: string;
}) {
  // Negative numbers are counted as 0 by the math, so say so instead of silently ignoring them.
  const invalid = value.trim() !== "" && parseFloat(value) < 0;
  return (
    <span className="relative mt-1 block">
      <input
        key={flashKey} type="number" inputMode="decimal" min={0} step={step ?? "any"}
        value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined} title={invalid ? "القيمة السالبة تُحسب صفراً" : undefined}
        className={`${box} tabular py-2.5 pr-3 text-right [direction:ltr] ${suffix ? "pl-11" : "pl-3"} ${flashKey ? "just-changed" : ""}
          ${invalid ? "border-loss bg-loss/5 focus-visible:outline-loss" : ""}`}
      />
      {suffix && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{suffix}</span>
      )}
    </span>
  );
}

function Field({ label, hint, className, ...rest }: {
  label: string; hint?: string; className?: string;
} & React.ComponentProps<typeof NumInput>) {
  return (
    <label className={`block min-w-0 text-sm text-muted ${className ?? ""}`}>
      {label}
      <NumInput {...rest} />
      {hint && <span className="mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

function Group({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 border-0 border-t border-line px-0 pb-5 pt-4 first:border-t-0 first:pt-0">
      <legend className="float-right mb-3 w-full text-base font-bold text-ink">{title}</legend>
      <div className="clear-both">{children}</div>
      {note && <div className="mt-2 text-xs leading-relaxed text-muted">{note}</div>}
    </fieldset>
  );
}

const Money = ({ v, cur, sign }: { v: number; cur: string; sign?: boolean }) => (
  <span className="tabular whitespace-nowrap">
    <span className="num">{sign && v > 0 ? "−" : ""}{fmt(sign ? Math.abs(v) : v)}</span>{cur ? ` ${cur}` : ""}
  </span>
);

/* ───────── calculator ───────── */

export type CalculatorPreset = {
  /** inputs that differ from the general defaults; also what "reset" returns to on this page */
  inputs?: Partial<Inputs>;
  plan?: string;
  target?: Target;
  /** which variable the sensitivity chart opens on */
  chartVar?: Var;
  /** separate saved copy per page ("" = the home calculator) */
  storageKey?: string;
};

const NO_PRESET: CalculatorPreset = {};

export function Calculator({ siteName, platform = SALLA, preset = NO_PRESET }: {
  siteName: string; platform?: Platform; preset?: CalculatorPreset;
}) {
  // The starting point of this page: home = general defaults, landing pages = their preset.
  const base = useMemo<Snapshot>(() => ({
    ...DEFAULT_SNAPSHOT,
    inp: { ...DEFAULT_INPUTS, ...preset.inputs },
    plan: preset.plan ?? "",
    target: preset.target ?? DEFAULT_SNAPSHOT.target,
  }), [preset]);
  const [inp, setInp] = useState<Inputs>(base.inp);
  const [cur, setCur] = useState<string>(base.cur);
  const [productName, setProductName] = useState("");
  const [plan, setPlan] = useState(base.plan);
  const [target, setTarget] = useState<Target>(base.target);
  const [targetFocus, setTargetFocus] = useState(0); // bumps → chart switches to price mode and focuses the target field
  const [restored, setRestored] = useState(false);   // don't overwrite storage with defaults before reading it
  const [retAs, setRetAs] = useState<"ret" | "delivery">("ret"); // type returns, or delivery rate (= 100 − returns)
  const [filled, setFilled] = useState(0);
  const [payReset, setPayReset] = useState(0); // >0 = payment fields were just reset (replays the highlight on all rows) // >0 = Salla fees just filled (also re-keys inputs to replay the highlight)
  const [mounted, setMounted] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  // Mobile sticky bar hides while the receipt itself is on screen.
  useEffect(() => {
    const el = receiptRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setReceiptVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!filled) return;
    const t = setTimeout(() => setFilled(0), 2600);
    return () => clearTimeout(t);
  }, [filled]);

  const set = useCallback(<K extends keyof Inputs>(k: K, v: Inputs[K]) => setInp((s) => ({ ...s, [k]: v })), []);
  const setPay = useCallback((row: number, k: "share" | "pct" | "fixed", v: string) =>
    setInp((s) => ({ ...s, payments: s.payments.map((r, i) => (i === row ? { ...r, [k]: v } : r)) })), []);

  const res = useMemo(() => calculate(inp), [inp]);
  const tgt = useMemo(() => priceForTarget(res, target), [res, target]);
  const toast = useToast();

  const snapshot = (): Snapshot => ({ inp, cur, productName, plan, target });
  const apply = (s: Snapshot) => { setInp(s.inp); setCur(s.cur); setProductName(s.productName); setPlan(s.plan); setTarget(s.target); };

  // On load: a shared link wins; otherwise bring back this visitor's last numbers.
  useEffect(() => {
    const fromLink = readHash();
    if (fromLink) {
      apply(fromLink);
      clearHash(); // later edits shouldn't look like the sender's numbers
      toast.show("فتحنا الحسبة اللي وصلتك. عدّل عليها براحتك، نسختك منفصلة عن المرسل", { kind: "info", duration: 4500 });
    } else {
      const saved = load(preset.storageKey);
      if (saved && !sameAs(saved, base)) {
        apply(saved);
        toast.show("رجّعنا آخر أرقام كتبتها", {
          kind: "info", duration: 5000,
          action: { label: "ابدأ من جديد", run: () => apply(base) },
        });
      }
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on every change (debounced). Stays in this browser only.
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => save({ inp, cur, productName, plan, target }, base, preset.storageKey), 400);
    return () => clearTimeout(t);
  }, [restored, inp, cur, productName, plan, target, base, preset.storageKey]);

  const share = async () => {
    const url = shareUrl(snapshot());
    const title = productName.trim() ? `حسبة أرباح: ${productName.trim()}` : "حسبة أرباح المتجر";
    // Phones: the native share sheet (WhatsApp etc.). Desktop: copy to clipboard.
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title, url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // older browsers / file:// : fall back to a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove();
      if (!ok) { toast.show("ما قدرنا ننسخ الرابط تلقائياً. انسخه من شريط العنوان بعد تحديث الصفحة", { kind: "error" }); return; }
    }
    toast.show("تم نسخ رابط الحسبة. أي أحد يفتحه يشوف نفس أرقامك");
  };

  const sallaFilled = inp.payments.slice(0, platform.fillRows).every((r, i) =>
    num(r.pct) === num(platform.samplePayments[i].pct) && num(r.fixed) === num(platform.samplePayments[i].fixed));

  // Shown only when the payment section differs from its defaults (e.g. after the Salla fill or manual edits)
  const paymentsChanged =
    JSON.stringify(inp.payments) !== JSON.stringify(base.inp.payments) || inp.feeVat !== base.inp.feeVat;

  const resetPayments = () => {
    const before = { payments: inp.payments, feeVat: inp.feeVat };
    setInp((s) => ({ ...s, payments: base.inp.payments.map((r) => ({ ...r })), feeVat: base.inp.feeVat }));
    setFilled(0);
    setPayReset(Date.now());
    toast.show("رجعت وسائل الدفع للقيم الافتراضية", {
      kind: "info",
      action: { label: "تراجع", run: () => setInp((s) => ({ ...s, payments: before.payments, feeVat: before.feeVat })) },
    });
  };

  const fillSalla = () => {
    const before = inp.payments;
    set("payments", platform.samplePayments.map((r) => ({ ...r })));
    setFilled(Date.now());
    toast.show(`تمت تعبئة رسوم ${platform.name}`, { action: { label: "تراجع", run: () => set("payments", before) } });
  };

  const reset = () => {
    const before = { inp, cur, productName, plan, target };
    apply(base);
    toast.show("رجعت الأرقام للقيم الافتراضية", {
      kind: "info",
      action: { label: "تراجع", run: () => apply(before) },
    });
  };

  const print = () => {
    try {
      window.print();
    } catch {
      toast.show("المتصفح منع نافذة الطباعة هنا. افتح الموقع في نافذة مستقلة ثم جرّب مرة أخرى", { kind: "error" });
    }
  };

  // motion: the hero number counts to its new value; tiles flash when their value changes
  const netShown = useTweened(res.profit);
  const pulse = {
    monthly: usePulseKey(Math.round(res.monthlyProfit * 100)),
    beo: usePulseKey(res.breakEvenOrders),
    cpa: usePulseKey(Math.round(res.maxAdCostPerLead * 100)),
    roas: usePulseKey(res.breakEvenRoas === null ? null : Math.round(res.breakEvenRoas * 100)),
    minp: usePulseKey(res.minPrice === null ? null : Math.round(res.minPrice * 100)),
  };

  const costs = res.parts.filter((p) => p.key !== "c7");
  const FM = num(inp.fixedMonthly);

  const adModes: { v: AdMode; label: string }[] = [
    { v: "order", label: "لكل طلب" },
    { v: "budget", label: "ميزانية شهرية" },
    { v: "cpc", label: "تكلفة النقرة" },
  ];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        {/* ───── inputs ───── */}
        <section aria-label="المدخلات" className="min-w-0 rounded-2xl bg-surface p-4 sm:p-6">
          <Group title="المنتج والسعر">
            <div className="grid grid-cols-2 items-end gap-3">
              <Field label="سعر البيع" suffix={cur} value={inp.price} onChange={(v) => set("price", v)} />
              <Field label="تكلفة المنتج عليك" suffix={cur} value={inp.cost} onChange={(v) => set("cost", v)} />
              <Field label="خصم على السعر" suffix="%" value={inp.disc} onChange={(v) => set("disc", v)}
                hint={res.discount > 0 ? `بعد الخصم: ${fmt(res.priceAfterDiscount)} ${cur}` : undefined} />
              <label className="block min-w-0 text-sm text-muted">
                العملة
                <select value={cur} onChange={(e) => setCur(e.target.value)} className={`${box} mt-1 px-3 py-2.5`}>
                  {CURRENCIES.map((c) => <option key={c.code || "none"} value={c.symbol}>{c.label}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 text-ink">
              <span className="min-w-0">السعر شامل ضريبة القيمة المضافة وأنا مسجل بها</span>
              <input type="checkbox" role="switch" checked={inp.vatOn} onChange={(e) => set("vatOn", e.target.checked)}
                aria-label="السعر شامل ضريبة القيمة المضافة وأنا مسجل بها"
                className="peer relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors
                  before:absolute before:top-0.5 before:right-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform
                  checked:bg-accent checked:before:-translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            </label>
            {inp.vatOn && <Field className="mt-3 max-w-[50%]" label="نسبة الضريبة" suffix="%" value={inp.vat} onChange={(v) => set("vat", v)} />}
          </Group>

          <Group title="الشحن والمنصة"
            note={platform.plansNote}>
            <div className="grid grid-cols-2 items-end gap-3">
              <Field label="الشحن عليك لكل طلب" suffix={cur} value={inp.ship} onChange={(v) => set("ship", v)} />
              <Field label="عمولة المنصة" suffix="%" value={inp.comm} onChange={(v) => set("comm", v)} />
              {platform.plans.length > 0 && <label className="col-span-2 block min-w-0 text-sm text-muted">
                باقة {platform.name}
                <select value={plan} className={`${box} mt-1 px-3 py-2.5`}
                  onChange={(e) => { setPlan(e.target.value); if (e.target.value !== "") set("fixedMonthly", e.target.value); }}>
                  <option value="">لا أستخدم {platform.name}، أو سأدخل التكلفة يدوياً</option>
                  {platform.plans.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>}
              <Field label="تكاليف ثابتة شهرية" suffix={cur} value={inp.fixedMonthly}
                onChange={(v) => { setPlan(""); set("fixedMonthly", v); }} />
              <Field label="الطلبات المشحونة في الشهر" step="1" value={inp.orders} onChange={(v) => set("orders", v)} />
            </div>
          </Group>

          <Group title="وسائل الدفع" note={platform.feesNote}>
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] sm:items-end">
              <span className="hidden sm:block" />
              <span className="text-xs text-muted">من الطلبات</span>
              <span className="text-xs text-muted">رسم بالنسبة</span>
              <span className="text-xs text-muted">رسم ثابت</span>
              {PAYMENT_METHODS.map((m, i) => (
                <div key={m} className="contents">
                  <b className="col-span-3 mt-3 text-sm font-medium text-ink sm:col-span-1 sm:mt-0 sm:self-center">{m}</b>
                  {(["share", "pct", "fixed"] as const).map((k) => (
                    <NumInput key={k} value={inp.payments[i][k]} onChange={(v) => setPay(i, k, v)}
                      suffix={k === "fixed" ? cur : "%"} flashKey={(filled && i < platform.fillRows ? filled : 0) || payReset || undefined}
                      ariaLabel={`${m}: ${k === "share" ? "نسبة الطلبات" : k === "pct" ? "الرسم بالنسبة" : "الرسم الثابت"}`} />
                  ))}
                </div>
              ))}
            </div>
            <p className={`mt-3 text-sm ${res.sharesBalanced ? "text-muted" : "text-warn"}`}>
              مجموع الطلبات: <span className="num tabular">{fmt(res.paymentShareTotal)}%</span>
              {!res.sharesBalanced && "، وستُحسب بالتناسب"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={fillSalla} disabled={sallaFilled}
                className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition duration-200 ease-out
                  hover:bg-accent hover:text-surface active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
                  disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent">
                {platform.fillLabel}
              </button>
              {paymentsChanged && (
                <button type="button" onClick={resetPayments}
                  className="pop-in inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition duration-200 ease-out
                    hover:border-ink hover:text-ink active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <svg viewBox="0 0 20 20" className="size-4 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
                    <path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" />
                  </svg>
                  إعادة ضبط وسائل الدفع
                </button>
              )}
              <span className={`text-sm text-muted transition-opacity duration-200 ${sallaFilled ? "opacity-100" : "opacity-0"}`} aria-hidden={!sallaFilled}>
                رسوم {platform.name} معبأة
              </span>
            </div>
            <Field className="mt-4 max-w-[50%]" label="ضريبة على رسوم الدفع" suffix="%" value={inp.feeVat} onChange={(v) => set("feeVat", v)} />
          </Group>

          <Group title="التأكيد والتوصيل والإعلان">
            <Field label="نسبة التأكيد" suffix="%" value={inp.confirm} onChange={(v) => set("confirm", v)}
              hint="من كل الطلبات اللي تجيك، كم واحد يؤكد وتشحن له. اتركها 100 إذا ما عندك خطوة تأكيد." />
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-muted">بعد الشحن، أعرف</span>
              <div role="radiogroup" aria-label="أكتب نسبة المرتجعات أو نسبة التوصيل" className="grid grid-cols-2 gap-1 rounded-lg bg-bg p-1">
                {([["ret", "المرتجعات"], ["delivery", "التوصيل"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={retAs === k} onClick={() => setRetAs(k)}
                    className={`rounded-md px-3 py-1.5 text-sm transition duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-accent
                      ${retAs === k ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:bg-surface/60 hover:text-ink"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 items-end gap-3">
              {retAs === "ret" ? (
                <Field label="نسبة المرتجعات" suffix="%" value={inp.ret} onChange={(v) => set("ret", v)}
                  hint={inp.ret.trim() !== "" ? `يعني توصيل ${fmt(100 - Math.min(num(inp.ret), 100))}%` : undefined} />
              ) : (
                <Field label="نسبة التوصيل" suffix="%"
                  value={inp.ret.trim() === "" ? "" : String(+(100 - Math.min(num(inp.ret), 100)).toFixed(2))}
                  onChange={(v) => set("ret", v.trim() === "" ? "" : String(+(100 - Math.min(Math.max(parseFloat(v) || 0, 0), 100)).toFixed(2)))}
                  hint={`يعني مرتجعات ${fmt(Math.min(num(inp.ret), 100))}%`} />
              )}
              <Field label="شحن المرتجع عليك" suffix={cur} value={inp.retShip} onChange={(v) => set("retShip", v)}
                hint={retAs === "delivery" || inp.ret.trim() !== "" ? "\u00a0" : undefined} />
            </div>
            <div role="radiogroup" aria-label="طريقة حساب الإعلان" className="mt-4">
              <span className="text-sm text-muted">تكلفة الإعلان أعرفها</span>
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-bg p-1">
                {adModes.map((m) => (
                  <button key={m.v} type="button" role="radio" aria-checked={inp.adMode === m.v} onClick={() => set("adMode", m.v)}
                    className={`min-w-0 rounded-md px-1 py-2 text-sm transition duration-200 ease-out active:scale-95
                      focus-visible:outline-2 focus-visible:outline-accent
                      ${inp.adMode === m.v ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:bg-surface/60 hover:text-ink"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 items-end gap-3">
              {inp.adMode === "order" && <Field label={num(inp.confirm) > 0 && num(inp.confirm) < 100 ? "تكلفة الإعلان لكل طلب قبل التأكيد" : "تكلفة الإعلان لكل طلب"}
                suffix={cur} value={inp.ads} onChange={(v) => set("ads", v)} />}
              {inp.adMode === "budget" && <Field label="الميزانية الإعلانية الشهرية" suffix={cur} value={inp.adBudget} onChange={(v) => set("adBudget", v)} />}
              {inp.adMode === "cpc" && (
                <>
                  <Field label="تكلفة النقرة" suffix={cur} value={inp.cpc} onChange={(v) => set("cpc", v)} />
                  <Field label="نسبة التحويل" suffix="%" value={inp.conv} onChange={(v) => set("conv", v)} />
                </>
              )}
            </div>
            {(inp.adMode !== "order" || num(inp.confirm) > 0 && num(inp.confirm) < 100 || num(inp.ret) > 0) && (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                يعني إعلان كل طلب مشحون <Money v={res.adPerOrder} cur={cur} />
                {res.adPerPaidOrder !== null && num(inp.ret) > 0 && <>، وكل طلب استلمه العميل ودفع <Money v={res.adPerPaidOrder} cur={cur} /></>}
              </p>
            )}
          </Group>
        </section>

        {/* ───── receipt (results) ───── */}
        <section aria-label="النتائج" aria-live="polite" className="min-w-0 lg:sticky lg:top-4">
          <div ref={receiptRef} id="receipt" className="receipt rounded-t-2xl px-5 pb-6 pt-5 sm:px-6">
            <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line pb-3">
              <h2 className="text-base font-bold">إيصال طلب واحد</h2>
              <input type="text" maxLength={60} placeholder="اسم المنتج (اختياري)" value={productName}
                onChange={(e) => setProductName(e.target.value)} aria-label="اسم المنتج (للطباعة)"
                className="w-36 min-w-0 border-0 border-b border-transparent bg-transparent p-0 text-left text-sm text-muted placeholder:text-muted/70 focus:border-accent focus:outline-none sm:w-44" />
            </div>

            <dl className="m-0 text-sm">
              <div className="flex justify-between gap-3 py-2">
                <dt>سعر البيع{res.discount > 0 ? " بعد الخصم" : ""}</dt>
                <dd className="m-0 font-medium"><Money v={res.priceAfterDiscount} cur={cur} /></dd>
              </div>
              {costs.map((p) => (
                <div key={p.key} className={`flex justify-between gap-3 py-1.5 ${Math.abs(p.value) < 0.005 ? "text-muted/70" : ""}`}>
                  <dt className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--${p.key})` }} />{p.label}
                  </dt>
                  <dd className="m-0"><Money v={p.value} cur={cur} sign /></dd>
                </div>
              ))}
            </dl>

            <BreakdownBar parts={res.parts} price={res.priceAfterDiscount} cur={cur} />

            <div className="border-t-2 border-dashed border-ink/40 pt-3">
              <div className="flex items-end justify-between gap-3">
                <span className="font-bold">{res.isLoss ? "خسارة الطلب" : "صافي الطلب"}</span>
                <span data-testid="net" data-value={fmt(res.profit)} aria-label={`${fmt(res.profit)} ${cur}`}
                  className={`text-[2.1rem] font-bold leading-none transition-colors duration-300 sm:text-4xl ${res.isLoss ? "text-loss" : "text-accent"}`}>
                  <Money v={netShown} cur={cur} />
                </span>
              </div>
              <p className="mt-1 text-left text-sm text-muted">
                {res.marginPct === null ? "" : <>هامش <span className="num tabular">{fmt(res.marginPct)}%</span> من سعر البيع</>}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-surface p-5 sm:p-6">
            <dl className="m-0 grid grid-cols-2 gap-x-4 text-sm">
              {([
                [FM > 0 ? "ربح الشهر بعد التكاليف الثابتة" : "ربح الشهر", <Money key="m" v={res.monthlyProfit} cur={cur} />, pulse.monthly,
                  "صافي الطلب مضروباً في عدد طلباتك الشهرية، ناقص التكاليف الثابتة مثل اشتراك المنصة."],
                ["طلبات تغطي التكاليف الثابتة", res.breakEvenOrders === null ? "غير ممكن" : <span key="b" className="num tabular">{fmt(res.breakEvenOrders)}</span>, pulse.beo,
                  "عدد الطلبات اللي تحتاجها في الشهر حتى يغطي ربحها تكاليفك الثابتة. صفر يعني ما عندك تكاليف ثابتة."],
                [num(inp.confirm) > 0 && num(inp.confirm) < 100 && inp.adMode !== "budget" ? "أقصى إعلان للطلب قبل التأكيد" : "أقصى ما تدفعه إعلاناً للطلب",
                  res.maxAdCostPerLead > 0 ? <Money key="c" v={res.maxAdCostPerLead} cur={cur} /> : "لا يوجد هامش", pulse.cpa,
                  "أعلى تكلفة إعلان تقدر تدفعها للحصول على طلب واحد قبل ما يصير الطلب خاسراً (CPA التعادل). إذا عندك خطوة تأكيد، الرقم بنفس طريقة منصة الإعلانات: لكل طلب قبل التأكيد."],
                [<span key="r"><bdi>ROAS</bdi> التعادل</span>, res.breakEvenRoas === null ? "غير ممكن" : <span key="rv" className="num tabular">{fmt(res.breakEvenRoas)}x</span>, pulse.roas,
                  "العائد على الإعلان اللازم حتى لا تخسر: سعر البيع مقسوماً على أقصى تكلفة إعلان. لو عائد حملتك أقل من هذا الرقم فهي خاسرة."],
              ] as [React.ReactNode, React.ReactNode, number, string][]).map(([k, v, pk, help], i) => (
                <div key={i} className="min-w-0 border-b border-line py-3">
                  <dt className="flex items-center text-muted">{k}<InfoTip label={typeof k === "string" ? k : "ROAS التعادل"}>{help}</InfoTip></dt>
                  <dd className="m-0 mt-0.5 text-lg font-bold"><span key={pk} className={pk ? "value-pulse px-0.5" : ""}>{v}</span></dd>
                </div>
              ))}
              <div className="col-span-2 min-w-0 py-3">
                <dt className="flex items-center text-muted">أقل سعر بيع بدون خسارة
                  <InfoTip label="أقل سعر بيع بدون خسارة">السعر اللي يكون عنده صافي الطلب صفراً بعد كل الرسوم والمرتجعات والإعلان.</InfoTip></dt>
                <dd key={pulse.minp} className={`m-0 mt-0.5 text-lg font-bold ${pulse.minp ? "value-pulse" : ""}`}>
                  {res.minPrice === null ? "غير ممكن بهذه الرسوم" : <>
                    <Money v={res.minPrice} cur={cur} />
                    {res.discount > 0 && res.discount < 1 && (
                      <span className="ms-2 text-sm font-normal text-muted">(قبل الخصم <Money v={res.minPriceBeforeDiscount!} cur={cur} />)</span>
                    )}
                  </>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-normal">
                  {tgt.ok ? (
                    <span>
                      {target.kind === "margin" ? <>لهامش <span className="num">{fmt(num(target.value))}%</span></> : <>لربح <Money v={num(target.value)} cur={cur} /> للطلب</>}
                      {" "}بِع بـ <b><Money v={tgt.priceBeforeDiscount} cur={cur} /></b>
                    </span>
                  ) : tgt.reason === "impossible" ? (
                    <span className="text-warn">هدفك غير ممكن بهذه التكاليف</span>
                  ) : null}
                  <button type="button" onClick={() => setTargetFocus((n) => n + 1)}
                    className="rounded text-accent underline underline-offset-4 transition-colors duration-200 hover:text-ink active:opacity-70
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    {tgt.ok || tgt.reason === "impossible" ? "غيّر هدفك" : "بكم أبيع لأربح اللي أبيه؟"}
                  </button>
                </div>
                </dd>
              </div>
            </dl>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={print}
                className="flex-1 rounded-lg bg-accent px-4 py-3 font-medium text-surface shadow-sm transition duration-200 ease-out
                  hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                اطبع أو احفظ كـ PDF
              </button>
              <button type="button" onClick={share} aria-label="شارك الحسبة"
                className="rounded-lg border border-accent px-4 py-3 text-sm font-medium text-accent transition duration-200 ease-out hover:bg-accent hover:text-surface
                  active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                شارك
              </button>
              <button type="button" onClick={reset}
                className="rounded-lg border border-line px-4 py-3 text-sm text-muted transition duration-200 ease-out hover:border-ink hover:text-ink
                  active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                إعادة الضبط
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              تقدير لكل طلب مشحون: المنتج المرتجع يعود للمخزون، ولا تُحتسب العمولة ورسوم الدفع على الطلب المرتجع،
              وتكلفة المنتج بدون ضريبة. راجع رسوم منصتك لأنها تتغير.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-6"><SensitivityChart inp={inp} cur={cur} target={target} setTarget={setTarget} focusTarget={targetFocus} initialVar={preset.chartVar} /></div>

      {/* ───── mobile: net result always in reach while editing ───── */}
      <div aria-hidden={receiptVisible}
        className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-2.5 backdrop-blur transition-transform lg:hidden
          pb-[calc(0.625rem+env(safe-area-inset-bottom))] ${receiptVisible ? "translate-y-full" : "translate-y-0"}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-xs text-muted">{res.isLoss ? "خسارة الطلب" : "صافي الطلب"}</span>
            <span className={`text-xl font-bold transition-colors duration-300 ${res.isLoss ? "text-loss" : "text-accent"}`}><Money v={netShown} cur={cur} /></span>
          </div>
          <a href="#receipt" tabIndex={receiptVisible ? -1 : 0}
            className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm text-ink transition duration-200 hover:border-ink active:scale-95
              focus-visible:outline-2 focus-visible:outline-accent">عرض الإيصال</a>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden />

      {mounted && createPortal(
        <PrintReport inp={inp} res={res} cur={cur} productName={productName} siteName={siteName} target={target} tgt={tgt} />,
        document.body,
      )}
    </>
  );
}
