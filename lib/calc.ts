// Pure profit math. No React, no DOM: the same function runs in the UI,
// the print report and the tests. Ported line-for-line from the HTML prototype.

export type AdMode = "order" | "budget" | "cpc";

export type PaymentRow = {
  /** share of orders, any scale (normalised against the total) */
  share: string;
  /** percentage fee */
  pct: string;
  /** fixed fee per transaction */
  fixed: string;
};

export type Inputs = {
  price: string;
  disc: string;
  cost: string;
  vatOn: boolean;
  vat: string;
  ship: string;
  comm: string;
  fixedMonthly: string;
  orders: string;
  payments: PaymentRow[];
  feeVat: string;
  /** COD confirmation rate %: share of incoming orders that confirm and get shipped. 100 = no confirmation step. */
  confirm: string;
  ret: string;
  retShip: string;
  adMode: AdMode;
  ads: string;
  adBudget: string;
  cpc: string;
  conv: string;
};

export type Part = { key: string; label: string; value: number };

export type Result = {
  priceAfterDiscount: number;
  discount: number; // 0..1
  /** ad cost carried by each SHIPPED order (after confirmation) */
  adPerOrder: number;
  /** ad cost per order that was delivered and paid; null when every order is returned */
  adPerPaidOrder: number | null;
  /** break-even ad cost in the same unit the visitor types: per incoming order, before confirmation */
  maxAdCostPerLead: number;
  paymentShareTotal: number;
  sharesBalanced: boolean;
  profit: number;
  isLoss: boolean;
  marginPct: number | null;
  monthlyProfit: number;
  /** orders a month that cover the fixed costs (plus the ad budget in budget mode); null = impossible */
  breakEvenOrders: number | null;
  maxAdCost: number; // cpa; <=0 means no margin
  breakEvenRoas: number | null;
  minPrice: number | null; // after discount
  /** profit per order is linear in the price after discount: profit = priceSlope × P − costPerOrder */
  priceSlope: number;
  costPerOrder: number;
  minPriceBeforeDiscount: number | null;
  parts: Part[]; // the 6 costs + net profit (raw, may be negative)
};

/** Same rule as the prototype: empty, invalid and negative numbers count as 0. */
export function num(v: string): number {
  const x = parseFloat(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

export function calculate(i: Inputs): Result {
  const P0 = num(i.price);
  const dsc = Math.min(num(i.disc), 100) / 100;
  const P = P0 * (1 - dsc);
  const C = num(i.cost);
  const S = num(i.ship);
  const c = num(i.comm) / 100;
  const p = Math.min(num(i.ret), 100) / 100;
  const rs = num(i.retShip);
  const N = num(i.orders);
  const FM = num(i.fixedMonthly);

  // Confirmation: "per order" and CPC costs are paid for EVERY incoming order, but only confirmed ones ship.
  // So the ad cost each shipped order carries = cost per incoming order ÷ confirmation rate.
  // A monthly budget is already divided by shipped orders (N), so it is not divided again.
  // Empty or 0 → treated as 100% (no confirmation step).
  const conf = num(i.confirm) > 0 ? Math.min(num(i.confirm), 100) / 100 : 1;
  const A =
    i.adMode === "budget"
      ? N > 0
        ? num(i.adBudget) / N
        : 0
      : i.adMode === "cpc"
        ? num(i.conv) > 0
          ? num(i.cpc) / (num(i.conv) / 100) / conf
          : 0
        : num(i.ads) / conf;

  const incl = i.vatOn;
  const v = num(i.vat) / 100;
  const R = incl ? P / (1 + v) : P;

  // weighted average of payment methods
  const T = i.payments.reduce((s, r) => s + num(r.share), 0);
  let qp = 0;
  let F = 0;
  for (const r of i.payments) {
    const w = T > 0 ? num(r.share) / T : 0;
    qp += (w * num(r.pct)) / 100;
    F += w * num(r.fixed);
  }

  const vf = 1 + num(i.feeVat) / 100;
  const vatAmt = (1 - p) * (P - R);
  const prod = (1 - p) * C;
  const shipT = S + p * rs;
  const comm = (1 - p) * c * P;
  const payT = (1 - p) * (qp * P + F) * vf;
  const retLoss = p * P;

  const profit = P - retLoss - vatAmt - prod - shipT - comm - payT - A;
  const cpa = profit + A;
  const k = (1 - p) * ((incl ? 1 / (1 + v) : 1) - c - qp * vf);
  const cst = (1 - p) * (C + F * vf) + S + p * rs + A;
  const minP = k > 0 ? cst / k : null;

  // A monthly ad budget does not change with the number of orders, so for "how many orders cover my
  // fixed costs" it counts as a fixed cost, and each order contributes its profit before ads (cpa).
  const budgetMode = i.adMode === "budget";
  const fixedTotal = FM + (budgetMode ? num(i.adBudget) : 0);
  const perOrder = budgetMode ? cpa : profit;

  return {
    priceAfterDiscount: P,
    discount: dsc,
    adPerOrder: A,
    adPerPaidOrder: p < 1 ? A / (1 - p) : null,
    maxAdCostPerLead: i.adMode === "budget" ? cpa : cpa * conf,
    paymentShareTotal: T,
    sharesBalanced: Math.abs(T - 100) <= 0.01,
    profit,
    isLoss: profit < 0,
    marginPct: P > 0 ? (profit / P) * 100 : null,
    monthlyProfit: profit * N - FM,
    breakEvenOrders: fixedTotal === 0 ? 0 : perOrder > 0 ? Math.ceil(fixedTotal / perOrder - 1e-9) : null,
    maxAdCost: cpa,
    // Ad platforms report the sales of every incoming order, confirmed or not, so the break-even ROAS
    // compares the price with the break-even ad cost per incoming order (cpa × confirmation rate).
    breakEvenRoas: cpa > 0 && P > 0 ? P / (cpa * conf) : null,
    minPrice: minP,
    priceSlope: k,
    costPerOrder: cst,
    minPriceBeforeDiscount: minP !== null && dsc > 0 && dsc < 1 ? minP / (1 - dsc) : minP,
    parts: [
      { key: "c1", label: "تكلفة المنتج", value: prod },
      { key: "c2", label: "الشحن", value: shipT },
      { key: "c3", label: "العمولة والرسوم", value: comm + payT },
      { key: "c4", label: "المرتجعات", value: retLoss },
      { key: "c5", label: "الضريبة", value: vatAmt },
      { key: "c6", label: "الإعلان", value: A },
      { key: "c7", label: "صافي الربح", value: profit },
    ],
  };
}

export const PAYMENT_METHODS = [
  "مدى",
  "بطاقات ائتمانية",
  "آجل / stc pay",
  "تحويل بنكي",
  "عند الاستلام",
] as const;

export const CURRENCIES = [
  { code: "SAR", symbol: "ر.س", label: "ريال سعودي (ر.س)" },
  { code: "AED", symbol: "د.إ", label: "درهم إماراتي (د.إ)" },
  { code: "KWD", symbol: "د.ك", label: "دينار كويتي (د.ك)" },
  { code: "QAR", symbol: "ر.ق", label: "ريال قطري (ر.ق)" },
  { code: "BHD", symbol: "د.ب", label: "دينار بحريني (د.ب)" },
  { code: "OMR", symbol: "ر.ع", label: "ريال عماني (ر.ع)" },
  { code: "", symbol: "", label: "بدون عملة" },
] as const;

/** Salla plans (official pricing page, screenshots dated 1 Oct 2026). Monthly equivalents. */
export const SALLA_PLANS = [
  { value: "0", label: "Basic مجانية" },
  { value: "99", label: "Plus شهري 99" },
  { value: "82.5", label: "Plus سنوي (990 في السنة)" },
  { value: "299", label: "Pro شهري 299" },
  { value: "249.17", label: "Pro سنوي (2,990 في السنة)" },
] as const;

/** Salla Help Center: mada 1% + 1. Cards: article says 2% + 1, dashboard shows 2.2% + 1 → use the safer 2.2%. */
export const SALLA_SAMPLE_PAYMENTS: PaymentRow[] = [
  { share: "55", pct: "1", fixed: "1" },
  { share: "40", pct: "2.2", fixed: "1" },
  { share: "0", pct: "0", fixed: "0" },
  { share: "0", pct: "0", fixed: "0" },
  { share: "5", pct: "0", fixed: "0" },
];

export const DEFAULT_INPUTS: Inputs = {
  price: "100",
  disc: "0",
  cost: "40",
  vatOn: false,
  vat: "15",
  ship: "15",
  comm: "0",
  fixedMonthly: "0",
  orders: "100",
  // every store pays gateway fees, so the general calculator starts with typical ones (Salla's) instead of 0
  payments: SALLA_SAMPLE_PAYMENTS.map((r) => ({ ...r })),
  feeVat: "15",
  confirm: "100",
  ret: "10",
  retShip: "15",
  adMode: "order",
  ads: "20",
  adBudget: "2000",
  cpc: "1",
  conv: "5",
};

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const fmt = (x: number) => nf.format(x);

/* ───────── "بكم أبيع؟" ───────── */

export type Target = { kind: "margin" | "amount"; value: string };

export type TargetPrice =
  | { ok: true; price: number; priceBeforeDiscount: number; profit: number }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "impossible"; maxMarginPct: number };

/**
 * Price (after discount) that reaches a target, from the linear model profit = k·P − cst:
 *   margin m of the selling price → k·P − cst = m·P → P = cst / (k − m), needs m < k
 *   fixed amount X per order       → k·P − cst = X   → P = (cst + X) / k, needs k > 0
 * As the price grows the margin approaches k, so k is the highest margin any price can reach.
 */
export function priceForTarget(res: Result, t: Target): TargetPrice {
  if (t.value.trim() === "" || !(parseFloat(t.value) >= 0)) return { ok: false, reason: "empty" };
  const k = res.priceSlope, cst = res.costPerOrder;
  const maxMarginPct = Math.max(0, k * 100);
  let P: number;
  if (t.kind === "margin") {
    const m = num(t.value) / 100;
    if (m >= k) return { ok: false, reason: "impossible", maxMarginPct };
    P = cst / (k - m);
  } else {
    if (k <= 0) return { ok: false, reason: "impossible", maxMarginPct };
    P = (cst + num(t.value)) / k;
  }
  const d = res.discount;
  return { ok: true, price: P, priceBeforeDiscount: d > 0 && d < 1 ? P / (1 - d) : P, profit: k * P - cst };
}
