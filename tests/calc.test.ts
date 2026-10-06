// Differential test: the original HTML prototype vs lib/calc.ts on random inputs.
import { readFileSync } from "node:fs";
import { calculate, fmt, priceForTarget, DEFAULT_INPUTS, type Inputs } from "../lib/calc.ts";

const html = readFileSync(new URL("./fixtures/prototype.html", import.meta.url), "utf8");
const els: Record<string, any> = {};
for (const m of html.matchAll(/<(?:input|select|label|div|span|b|ul|p|button)[^>]*\sid="([^"]+)"[^>]*>/g)) {
  const vm = /value="([^"]*)"/.exec(m[0]);
  els[m[1]] = { value: vm ? vm[1] : "", checked: false, innerHTML: "", textContent: "", className: "", hidden: false, disabled: false, listeners: {} as any,
    addEventListener(t: string, f: Function) { (this.listeners[t] ||= []).push(f); } };
}
(globalThis as any).document = { getElementById: (id: string) => els[id], title: "" };
(globalThis as any).window = { addEventListener() {}, print() {} };
new Function(/<script>([\s\S]*)<\/script>/.exec(html)![1])();
const strip = (s: string) => s.replace(/<[^>]+>/g, "");

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a: string[]) => a[Math.floor(rnd() * a.length)];
const r = (max: number) => (rnd() < 0.15 ? pick(["0", "", "-5", "abc"]) : (rnd() * max).toFixed(rnd() < 0.5 ? 0 : 2));

let fails = 0;
const N = 600;
for (let t = 0; t < N; t++) {
  const inp: Inputs = {
    ...DEFAULT_INPUTS,
    price: r(500), disc: r(60), cost: r(300), vatOn: rnd() < 0.4, vat: r(20), ship: r(40), comm: r(10),
    fixedMonthly: r(400), orders: r(1000), feeVat: r(20), ret: r(40), retShip: r(40),
    adMode: pick(["order", "budget", "cpc"]) as Inputs["adMode"], ads: r(60), adBudget: r(5000), cpc: r(5), conv: r(10),
    payments: Array.from({ length: 5 }, () => ({ share: r(100), pct: r(8), fixed: r(3) })),
  };
  const map: Record<string, string> = { price: inp.price, disc: inp.disc, cost: inp.cost, vat: inp.vat, ship: inp.ship, comm: inp.comm,
    fixedm: inp.fixedMonthly, orders: inp.orders, feevat: inp.feeVat, ret: inp.ret, retship: inp.retShip, admode: inp.adMode,
    ads: inp.ads, adbudget: inp.adBudget, cpc: inp.cpc, conv: inp.conv };
  inp.payments.forEach((p, k) => { map["sh" + (k + 1)] = p.share; map["pc" + (k + 1)] = p.pct; map["fx" + (k + 1)] = p.fixed; });
  for (const k in map) els[k].value = map[k];
  els.vatOn.checked = inp.vatOn;
  els.price.listeners.input.forEach((f: Function) => f());

  const o = calculate(inp);
  const got = {
    profit: fmt(o.profit),
    margin: o.marginPct === null ? "-" : fmt(o.marginPct) + "%",
    monthly: fmt(o.monthlyProfit),
    beo: o.breakEvenOrders === null ? "غير ممكن" : fmt(o.breakEvenOrders),
    cpa: o.maxAdCost > 0 ? fmt(o.maxAdCost) : "لا يوجد هامش",
    roas: o.breakEvenRoas === null ? "غير ممكن" : fmt(o.breakEvenRoas) + "x",
    minp: o.minPrice === null ? "غير ممكن بهذه الرسوم"
      : fmt(o.minPrice) + (o.discount > 0 && o.discount < 1 ? "قبل الخصم: " + fmt(o.minPriceBeforeDiscount!) : ""),
  };
  for (const k of Object.keys(got) as (keyof typeof got)[]) {
    // budget mode: the prototype ignored that the monthly ad budget is a fixed cost (fixed on purpose, tested below)
    if (k === "beo" && inp.adMode === "budget") continue;
    const want = strip(els[k].innerHTML);
    if (want !== got[k]) { fails++; if (fails <= 5) console.log("MISMATCH", t, k, "proto=", want, "new=", got[k]); }
  }
}

// COD example from the conversation: 100 incoming orders × 20 ad = 2,000; 90% confirm → 90 shipped; 70% delivered → 63 paid.
// Real ad cost per paid order = 2000 / 63 = 31.75, per shipped order = 2000 / 90 = 22.22.
const cod = calculate({ ...DEFAULT_INPUTS, adMode: "order", ads: "20", confirm: "90", ret: "30" });
const codOk = fmt(cod.adPerOrder) === "22.22" && fmt(cod.adPerPaidOrder!) === "31.75";
console.log(codOk ? "COD confirmation example: 22.22 per shipped, 31.75 per paid ✓" : `COD example FAILED ${cod.adPerOrder} ${cod.adPerPaidOrder}`);
// break-even ad cost (per incoming order) must make profit exactly 0
const be = calculate({ ...DEFAULT_INPUTS, ads: String(cod.maxAdCostPerLead), confirm: "90", ret: "30" });
const beOk = Math.abs(be.profit) < 1e-9;
console.log(beOk ? "break-even ad cost per incoming order gives profit 0 ✓" : `break-even FAILED ${be.profit}`);

// "بكم أبيع؟" with the default numbers (Salla fees): 30% margin → 125.57, 30 SAR per order → 116.90, 90% impossible (returns + fees)
const d0 = calculate(DEFAULT_INPUTS);
const tm = priceForTarget(d0, { kind: "margin", value: "30" });
const ta = priceForTarget(d0, { kind: "amount", value: "30" });
const ti = priceForTarget(d0, { kind: "margin", value: "90" });
// and the price it returns must actually give that margin when typed back into the calculator
const back = tm.ok ? calculate({ ...DEFAULT_INPUTS, price: String(tm.priceBeforeDiscount) }) : null;
const tgtOk = tm.ok && fmt(tm.price) === "125.57" && ta.ok && fmt(ta.price) === "116.9" && !ti.ok && ti.reason === "impossible"
  && fmt(ti.maxMarginPct) === "88.52" && back !== null && Math.abs(back.marginPct! - 30) < 1e-9;
console.log(tgtOk ? "target price: 30% → 125.57, 30 SAR → 116.90, 90% impossible (max 88.52%), round-trip margin = 30% ✓" : "target price FAILED");
// with a discount the visitor types the price BEFORE the discount
const dd = calculate({ ...DEFAULT_INPUTS, disc: "20" });
const td = priceForTarget(dd, { kind: "margin", value: "30" });
const backD = td.ok ? calculate({ ...DEFAULT_INPUTS, disc: "20", price: String(td.priceBeforeDiscount) }) : null;
const discOk = backD !== null && Math.abs(backD.marginPct! - 30) < 1e-9;
console.log(discOk ? "target price with 20% discount round-trips to 30% margin ✓" : "target with discount FAILED");

// anchor cases from the conversation
const salla = calculate({ ...DEFAULT_INPUTS, cost: "0", ship: "0", ret: "0", retShip: "0", ads: "0",
  payments: [{ share: "100", pct: "1", fixed: "1" }, ...DEFAULT_INPUTS.payments.slice(1).map(() => ({ share: "0", pct: "0", fixed: "0" }))] });
const anchor = fmt(salla.profit) === "97.7";
console.log(anchor ? "anchor Salla 100 via mada = 97.7 ✓" : "anchor FAILED " + salla.profit);
// budget mode: break-even orders must be exactly where the monthly profit turns non-negative (what the chart shows)
const bud = { ...DEFAULT_INPUTS, adMode: "budget" as const, adBudget: "2000", fixedMonthly: "99" };
const bo = calculate(bud).breakEvenOrders!;
const mAt = (n: number) => calculate({ ...bud, orders: String(n) }).monthlyProfit;
const budOk = bo === 60 && mAt(bo) >= 0 && mAt(bo - 1) < 0;
console.log(budOk ? "budget mode: 99 + 2,000 budget → 60 orders, matches the monthly-profit crossing ✓" : `budget beo FAILED ${bo}`);
// break-even ROAS with confirmation: price ÷ break-even ad cost per incoming order (COD page: 4.53x)
const codPage = calculate({ ...DEFAULT_INPUTS, confirm: "75", ret: "20",
  payments: [{ share: "30", pct: "1", fixed: "1" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }, { share: "70", pct: "0", fixed: "0" }] });
const roasOk = Math.abs(codPage.breakEvenRoas! - 100 / codPage.maxAdCostPerLead) < 1e-9 && fmt(codPage.breakEvenRoas!) === "4.53";
console.log(roasOk ? "break-even ROAS with 75% confirmation = 4.53x ✓" : `ROAS FAILED ${codPage.breakEvenRoas}`);
console.log(`${N} random cases × 7 outputs: ${fails === 0 ? "all identical to prototype ✓" : fails + " mismatches ✗"}`);
process.exit(fails === 0 && anchor && codOk && beOk && tgtOk && discOk && budOk && roasOk ? 0 : 1);
