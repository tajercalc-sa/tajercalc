import type { Metadata } from "next";
import { ARTICLES, TOOLS } from "@/lib/site";

export const metadata: Metadata = {
  title: "مقالات وأدلة للتجار: حساب الربح والتسعير ورسوم سلة وزد",
  description:
    "كل أدلة حاسبة تاجر في مكان واحد: حساب صافي الربح، والتسعير، والدفع عند الاستلام والمرتجعات، ورسوم سلة وزد ومقارنتها، بأمثلة محسوبة.",
  alternates: { canonical: "/guides/" },
};

const GROUPS = [
  { id: "profit", title: "حساب الربح والتسعير" },
  { id: "fees", title: "رسوم المنصات" },
] as const;

export default function Page() {
  return (
    <main className="prose-ar mx-auto max-w-3xl px-4 py-8">
<h1>مقالات وأدلة للتجار</h1>
<p>أدلة عملية لأصحاب المتاجر الإلكترونية، تشرح كيف تحسب ربحك وتسعّر منتجاتك وتفهم رسوم المنصات. كل رقم فيها محسوب بنفس الحاسبات الموجودة في الموقع، ومصادر الرسوم صفحات المنصات الرسمية.</p>

{GROUPS.map((g) => (
  <section key={g.id}>
    <h2>{g.title}</h2>
    <ul>
      {ARTICLES.filter((a) => a.group === g.id).map((a) => (
        <li key={a.href}><a href={a.href}><strong>{a.label}</strong></a>: {a.desc}</li>
      ))}
    </ul>
  </section>
))}

<h2>الحاسبات</h2>
<p>لكل حالة حاسبة معبأة مسبقاً، وكلها مجانية وتشتغل في متصفحك:</p>
<ul>
  <li><a href="/">الحاسبة الرئيسية</a>: صافي ربح الطلب والشهر بعد كل التكاليف.</li>
  {TOOLS.map((t) => <li key={t.href}><a href={t.href}>{t.label}</a></li>)}
</ul>
    </main>
  );
}
