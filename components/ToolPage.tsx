import { Calculator, type CalculatorPreset } from "./Calculator";
import { AdSlot } from "./AdSlot";
import { SITE, TOOLS } from "@/lib/site";
import type { Platform } from "@/lib/platforms";

/** Layout shared by the landing pages: heading, the preset calculator, the page's own article, related tools. */
export function ToolPage({ href, h1, intro, appName, platform, preset, children }: {
  href: string; h1: string; intro: React.ReactNode; appName: string;
  platform?: Platform; preset: CalculatorPreset; children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: appName,
    url: `${SITE.url}${href}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    inLanguage: "ar",
    offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
  };
  return (
    <main className="mx-auto max-w-5xl px-4 py-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="mb-1 mt-2 text-2xl font-bold leading-snug sm:text-3xl">{h1}</h1>
      <p className="mb-5 max-w-[60ch] text-muted">{intro}</p>

      <Calculator siteName={SITE.name} platform={platform} preset={preset} />

      <AdSlot slot={SITE.adSlots.afterTool} label="بعد الحاسبة" />

      <div className="mx-auto max-w-3xl">
        <article className="prose-ar">{children}</article>
        <nav aria-label="حاسبات أخرى" className="prose-ar mt-8">
          <h2>حاسبات أخرى</h2>
          <ul>
            <li><a href="/">حاسبة أرباح المتجر الإلكتروني (الشاملة)</a></li>
            {TOOLS.filter((t) => t.href !== href).map((t) => <li key={t.href}><a href={t.href}>{t.label}</a></li>)}
          </ul>
        </nav>
      </div>
    </main>
  );
}
