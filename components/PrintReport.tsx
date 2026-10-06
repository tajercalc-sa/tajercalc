import { fmt, num, PAYMENT_METHODS, type Inputs, type Result, type Target, type TargetPrice } from "@/lib/calc";

const N = ({ v }: { v: number }) => <span className="num">{fmt(v)}</span>;

/**
 * Print-only report. Hidden on screen (#print-report {display:none}); in print it is the only
 * visible child of <body>. Uses tables and flex rows, never CSS grid (RTL + page breaks).
 */
export function PrintReport({ inp, res, cur, productName, siteName, target, tgt, plan, wholesale }: {
  inp: Inputs; res: Result; cur: string; productName: string; siteName: string; target: Target; tgt: TargetPrice;
  /** chosen platform plan, e.g. "سلة: Plus شهري 99" */
  plan?: string;
  /** only when the wholesale helper is open and owns the cost field, so it can't contradict a typed cost */
  wholesale?: { total: number; ship: number; qty: number; unit: number };
}) {
  const M = ({ v }: { v: number }) => <span className="num">{fmt(v)}{cur ? ` ${cur}` : ""}</span>;
  const FM = num(inp.fixedMonthly);

  const inputs: [string, React.ReactNode][] = [
    [res.discount > 0 ? "سعر البيع قبل الخصم" : "سعر البيع", <M key="p" v={num(inp.price)} />],
  ];
  if (res.discount > 0) {
    inputs.push(["نسبة الخصم", <span key="d" className="num">{fmt(res.discount * 100)}%</span>]);
    inputs.push(["السعر بعد الخصم", <M key="pa" v={res.priceAfterDiscount} />]);
  }
  inputs.push([wholesale ? "تكلفة القطعة (من الجملة)" : "تكلفة المنتج", <M key="c" v={num(inp.cost)} />], ["الشحن على المتجر", <M key="s" v={num(inp.ship)} />]);
  if (num(inp.comm) > 0) inputs.push(["عمولة المنصة", <span key="cm" className="num">{fmt(num(inp.comm))}%</span>]);
  if (inp.vatOn) inputs.push(["ضريبة القيمة المضافة", <>السعر شامل <N v={num(inp.vat)} />%</>]);
  if (num(inp.confirm) > 0 && num(inp.confirm) < 100) inputs.push(["نسبة التأكيد", <span key="cf" className="num">{fmt(num(inp.confirm))}%</span>]);
  inputs.push(["نسبة المرتجعات", <span key="r" className="num">{fmt(num(inp.ret))}%</span>]);
  if (num(inp.ret) > 0) inputs.push(["شحن المرتجع", <M key="rs" v={num(inp.retShip)} />]);
  if (inp.adMode === "budget") inputs.push(["ميزانية الإعلان الشهرية", <M key="ab" v={num(inp.adBudget)} />]);
  if (inp.adMode === "cpc") inputs.push(
    ["تكلفة النقرة", <M key="cpc" v={num(inp.cpc)} />],
    ["نسبة التحويل", <span key="cv" className="num">{fmt(num(inp.conv))}%</span>],
  );
  inputs.push(["الإعلان لكل طلب مشحون", <M key="a" v={res.adPerOrder} />]);
  if (res.adPerPaidOrder !== null && num(inp.ret) > 0) inputs.push(["الإعلان لكل طلب مدفوع", <M key="ap" v={res.adPerPaidOrder} />]);
  if (plan) inputs.push(["باقة المنصة", plan]);
  if (FM > 0) inputs.push(["تكاليف شهرية ثابتة", <M key="f" v={FM} />]);
  inputs.push(["عدد الطلبات شهرياً", <N key="o" v={num(inp.orders)} />]);

  const results: [React.ReactNode, React.ReactNode][] = [
    [num(inp.confirm) > 0 && num(inp.confirm) < 100 && inp.adMode !== "budget" ? "أقصى إعلان للطلب قبل التأكيد" : "أقصى تكلفة إعلان للطلب",
      res.maxAdCostPerLead > 0 ? <M v={res.maxAdCostPerLead} /> : "لا يوجد هامش"],
    [<><bdi>ROAS</bdi> التعادل</>, res.breakEvenRoas === null ? "غير ممكن" : <span className="num">{fmt(res.breakEvenRoas)}x</span>],
    ["أقل سعر بيع بدون خسارة", res.minPrice === null ? "غير ممكن بهذه الرسوم" : (
      <><M v={res.minPrice} />{res.discount > 0 && res.discount < 1 && <> (قبل الخصم: <M v={res.minPriceBeforeDiscount!} />)</>}</>
    )],
  ];
  if (tgt.ok) results.push([
    target.kind === "margin" ? <>سعر البيع لهامش <span className="num">{fmt(num(target.value))}%</span></> : <>سعر البيع لربح <M v={num(target.value)} /> للطلب</>,
    <M key="tp" v={tgt.priceBeforeDiscount} />,
  ]);
  if (FM > 0 || inp.adMode === "budget") results.push([
    inp.adMode === "budget" ? "طلبات تغطي الثابت والإعلان شهرياً" : "طلبات التعادل شهرياً",
    res.breakEvenOrders === null ? "غير ممكن" : <N v={res.breakEvenOrders} />,
  ]);

  const pairs = (rows: [React.ReactNode, React.ReactNode][]) => {
    const out = [];
    for (let i = 0; i < rows.length; i += 2) {
      const b = rows[i + 1];
      out.push(
        <tr key={i}>
          <th>{rows[i][0]}</th>
          {b ? <><td>{rows[i][1]}</td><th>{b[0]}</th><td>{b[1]}</td></> : <td colSpan={3}>{rows[i][1]}</td>}
        </tr>,
      );
    }
    return out;
  };

  const barTotal = res.parts.reduce((s, p) => s + Math.max(p.value, 0), 0);
  const breakdown = res.parts.filter((p) => p.key === "c7" || Math.abs(p.value) >= 0.005);
  const pays = inp.payments.map((p, i) => ({ ...p, name: PAYMENT_METHODS[i] })).filter((p) => num(p.share) > 0);
  const anyFee = pays.some((p) => num(p.pct) > 0 || num(p.fixed) > 0);
  const url = typeof location !== "undefined" && location.protocol.startsWith("http")
    ? location.host + location.pathname : "";
  const date = new Date().toLocaleDateString("en-GB");

  return (
    <div id="print-report" aria-hidden="true">
      <table className="pr-wrap">
        <thead><tr><td><div className="pr-space" /></td></tr></thead>
        <tbody><tr><td>
          <div className="pr-top">
            <div>
              <h1>تقرير ربحية{productName.trim() ? `: ${productName.trim()}` : ""}</h1>
              <div className="pr-meta">{date}</div>
            </div>
            <div className="pr-brand">{siteName}</div>
          </div>

          <section>
            <h2>النتائج</h2>
            <div className="pr-hero">
              <div className={`pr-card main${res.isLoss ? " loss" : ""}`}>
                <small>صافي ربح الطلب{res.isLoss ? " (خسارة)" : ""}</small><b><M v={res.profit} /></b>
              </div>
              <div className="pr-card">
                <small>هامش الربح من سعر البيع</small>
                <b>{res.marginPct === null ? "-" : <span className="num">{fmt(res.marginPct)}%</span>}</b>
              </div>
              <div className="pr-card">
                <small>{FM > 0 ? "الربح الشهري بعد التكاليف الثابتة" : "الربح الشهري المتوقع"}</small>
                <b><M v={res.monthlyProfit} /></b>
              </div>
            </div>
            <table><tbody>{pairs(results)}</tbody></table>
          </section>

          <section>
            <h2>ملخص المدخلات</h2>
            <table><tbody>{pairs(inputs)}</tbody></table>
          </section>

          {wholesale && (
            <section>
              <h2>حساب الجملة</h2>
              <table><tbody>{pairs([
                ["إجمالي فاتورة الشراء", <M key="wt" v={wholesale.total} />],
                ["شحن وجمارك الشحنة", <M key="ws" v={wholesale.ship} />],
                ["عدد القطع", <N key="wq" v={wholesale.qty} />],
                ["تكلفة القطعة", <M key="wu" v={wholesale.unit} />],
              ])}</tbody></table>
              <p className="pr-note">تكلفة القطعة = (الفاتورة + الشحن والجمارك) ÷ عدد القطع</p>
            </section>
          )}

          {pays.length > 0 && anyFee && (
            <section>
              <h2>وسائل الدفع</h2>
              <table className="pr-p">
                <thead><tr><th>الوسيلة</th><th>نسبة الطلبات</th><th>الرسم %</th><th>رسم ثابت</th></tr></thead>
                <tbody>
                  {pays.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td><td><N v={num(p.share)} />%</td><td><N v={num(p.pct)} />%</td><td><M v={num(p.fixed)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pr-note">ضريبة القيمة المضافة على رسوم الدفع: <N v={num(inp.feeVat)} />%</p>
            </section>
          )}

          <section>
            <h2>أين يذهب سعر البيع؟</h2>
            <div className="pr-bar">
              {res.parts.map((p) => {
                const w = barTotal > 0 ? (Math.max(p.value, 0) / barTotal) * 100 : 0;
                return w > 0 ? <i key={p.key} style={{ width: `${w}%`, background: `var(--${p.key})` }} /> : null;
              })}
            </div>
            <table className="pr-b">
              <thead><tr><th>البند</th><th>المبلغ</th><th>من السعر</th></tr></thead>
              <tbody>
                {breakdown.map((p) => (
                  <tr key={p.key} className={p.key === "c7" ? "pr-net" : undefined}>
                    <td><span className="sq" style={{ background: `var(--${p.key})` }} />{p.label}</td>
                    <td><M v={p.value} /></td>
                    <td><span className="num">{fmt(res.priceAfterDiscount > 0 ? (p.value / res.priceAfterDiscount) * 100 : 0)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="pr-foot">
            <span>{url ? <>للعودة إلى الحاسبة: <span className="num">{url}</span></> : null}</span>
            <span>تقدير لكل طلب مشحون (المرتجع يعود للمخزون ولا تُحتسب عليه رسوم الدفع). ليست نصيحة مالية، وراجع رسوم منصتك لأنها تتغير.</span>
          </div>
        </td></tr></tbody>
        <tfoot><tr><td><div className="pr-space" /></td></tr></tfoot>
      </table>
    </div>
  );
}
