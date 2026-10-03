import type { Metadata } from "next";
import { Calculator } from "@/components/Calculator";
import { HomeArticle } from "@/components/HomeArticle";
import { AdSlot } from "@/components/AdSlot";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  // absolute: the home title already carries the brand
  title: { absolute: `حاسبة أرباح المتجر الإلكتروني: صافي الربح بعد الرسوم والإعلانات | ${SITE.name}` },
  description:
    "احسب صافي ربح كل طلب في متجرك الإلكتروني بعد رسوم مدى والبطاقات والشحن والمرتجعات والإعلانات والخصومات، مع حد التعادل في ROAS وأقل سعر بيع. مجانية وتعمل في متصفحك.",
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "حاسبة أرباح المتجر الإلكتروني",
  url: `${SITE.url}/`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  inLanguage: "ar",
  offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
};

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="mb-1 mt-2 text-2xl font-bold leading-snug sm:text-3xl">حاسبة أرباح المتجر الإلكتروني</h1>
      <p className="mb-5 max-w-[60ch] text-muted">
        اعرف صافي ربح كل طلب بعد العمولات ورسوم وسائل الدفع والمرتجعات والإعلانات. الأرقام تُحسب فوراً داخل متصفحك ولا تُرسل لأي خادم.
      </p>

      <Calculator siteName={SITE.name} />

      {/* Ad #1: after the user already has the result, far from inputs and buttons */}
      <AdSlot slot={SITE.adSlots.afterTool} label="بعد الحاسبة" />

      <div className="mx-auto max-w-3xl">
        <HomeArticle />
      </div>
    </main>
  );
}
