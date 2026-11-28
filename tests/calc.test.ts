// Differential test: the original HTML prototype vs lib/calc.ts on random inputs.
import { readFileSync } from "node:fs";
import { calculate, fmt, priceForTarget, DEFAULT_INPUTS, SALLA_SAMPLE_PAYMENTS, type Inputs } from "../lib/calc.ts";

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
// pricing page meta description quotes this example (Salla fees, 25% margin → 115.69)
const pr = priceForTarget(calculate({ ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS }), { kind: "margin", value: "25" });
const prOk = pr.ok && fmt(pr.priceBeforeDiscount) === "115.69";
console.log(prOk ? "pricing page example: 25% margin → 115.69 ✓" : "pricing example FAILED");
// /guide-pricing/ quotes these (pricing-page assumptions, 25% margin)
const gp = (o: Partial<Inputs>) => { const r = calculate({ ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS, ...o }); const t = priceForTarget(r, { kind: "margin", value: "25" }); return [fmt(r.minPrice!), t.ok ? fmt(t.priceBeforeDiscount) : ""].join("/"); };
const guideOk = gp({ cost: "10" }) === "52.51/73.18" && gp({ cost: "20" }) === "62.68/87.35" && gp({}) === "83.01/115.69"
  && gp({ cost: "80" }) === "123.68/172.36" && gp({ cost: "150" }) === "194.85/271.54"
  && gp({ ads: "10" }).endsWith("/99.94") && gp({ ship: "0" }).endsWith("/92.07")
  && fmt(calculate({ ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS, price: "99" }).profit) === "14.15";
console.log(guideOk ? "pricing guide figures ✓" : "pricing guide figures FAILED");
// /salla-vs-zid/ quotes these (55% mada, 40% cards, 5% COD; Salla cards 2.2%, Zid 2.3%)
const vzMix = (card: string) => [{ share: "55", pct: "1", fixed: "1" }, { share: "40", pct: card, fixed: "1" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }, { share: "5", pct: "0", fixed: "0" }];
const vzOk = fmt(calculate({ ...DEFAULT_INPUTS, payments: vzMix("2.2") }).profit) === "15.04" && fmt(calculate({ ...DEFAULT_INPUTS, payments: vzMix("2.3") }).profit) === "15";
console.log(vzOk ? "salla vs zid profit per order 15.04 / 15.00 ✓" : "salla vs zid FAILED");
// /digital-cards-calculator/ quotes these (no ship/returns/ads; 60% mada, 40% cards)
const dc = (price: string, cost: string, m = "60", c = "40") => calculate({ ...DEFAULT_INPUTS, ship: "0", ret: "0", ads: "0", price, cost,
  payments: [{ share: m, pct: "1", fixed: "1" }, { share: c, pct: "2.2", fixed: "1" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }] });
const dcT = priceForTarget(dc("50", "47"), { kind: "amount", value: "3" });
const dcOk = fmt(dc("50", "47").profit) === "1" && fmt(dc("50", "47").minPrice!) === "48.98" && fmt(dc("100", "94").profit) === "3.15"
  && fmt(dc("200", "188").profit) === "7.45" && fmt(dc("500", "470").profit) === "20.34"
  && fmt(dc("50", "47", "100", "0").profit) === "1.28" && fmt(dc("50", "47", "0", "100").profit) === "0.59"
  && dcT.ok && fmt(dcT.priceBeforeDiscount) === "52.04";
console.log(dcOk ? "digital cards page figures ✓" : "digital cards FAILED");
// /guide-margin/ and /guide-bnpl/ quote these
const gmD = { ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS };
const gmR = calculate(gmD);
const gmT = (m: string) => { const t = priceForTarget(gmR, { kind: "margin", value: m }); return t.ok ? fmt(t.priceBeforeDiscount) : ""; };
const gmOk = fmt(gmR.profit) === "15.04" && gmT("10") === "93.59" && gmT("20") === "107.24" && gmT("30") === "125.57"
  && [["99", 7], ["299", 20], ["1000", 67], ["3000", 200]].every(([f, n]) => calculate({ ...gmD, fixedMonthly: String(f) }).breakEvenOrders === n)
  && fmt(calculate({ ...gmD, disc: "10" }).profit) === "6.18";
const bn = (pct: string) => calculate({ ...DEFAULT_INPUTS, price: "300", cost: "150",
  payments: [{ share: "100", pct, fixed: "1" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }, { share: "0", pct: "0", fixed: "0" }] }).profit;
const bnOk = fmt(bn("1")) === "94.36" && fmt(bn("3.3")) === "87.22" && fmt(bn("4")) === "85.05" && fmt(bn("6")) === "78.84" && fmt(bn("8")) === "72.63"
  && Math.ceil(9436 / bn("4")) === 111 && Math.ceil(9436 / bn("6")) === 120 && Math.ceil(9436 / bn("8")) === 130;
console.log(gmOk && bnOk ? "margin and BNPL guide figures ✓" : `margin/BNPL FAILED ${gmOk} ${bnOk}`);
// /guide-import-cost/ and /guide-break-even/ quote these
const ic = (cost: string) => calculate({ ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS, price: "150", cost });
const icM = (cost: string) => calculate({ ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS, price: "150", cost, orders: "100" }).monthlyProfit;
const beG = calculate({ ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS });
const icOk = fmt(ic("50").profit) === "50.3" && fmt(ic("60.90").profit) === "40.49" && fmt(ic("70.04").profit) === "32.26"
  && fmt(icM("50")) === "5,029.67" && fmt(icM("70.04")) === "3,226.07" && fmt(ic("50").minPrice!) === "93.18" && fmt(ic("70.04").minPrice!) === "113.56"
  && fmt(beG.minPrice!) === "83.01" && fmt(beG.maxAdCost) === "35.04" && fmt(beG.breakEvenRoas!) === "2.85"
  && calculate({ ...DEFAULT_INPUTS, payments: SALLA_SAMPLE_PAYMENTS, fixedMonthly: "299" }).breakEvenOrders === 20;
console.log(icOk ? "import-cost and break-even guide figures ✓" : "import/break-even FAILED");
console.log(`${N} random cases × 7 outputs: ${fails === 0 ? "all identical to prototype ✓" : fails + " mismatches ✗"}`);
process.exit(fails === 0 && anchor && codOk && beOk && tgtOk && discOk && budOk && roasOk && prOk && guideOk && vzOk && dcOk && gmOk && bnOk && icOk ? 0 : 1);
