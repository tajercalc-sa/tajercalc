import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SITE } from "@/lib/site";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

// Self-hosted from npm (@fontsource): no request to Google from the visitor or at build time.
// Each CSS file uses unicode-range, so the browser downloads only the Arabic/Latin subsets it needs.
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `حاسبة أرباح المتجر الإلكتروني | ${SITE.name}`, template: `%s | ${SITE.name}` },
  description: "أدوات حسابية مجانية لأصحاب المتاجر الإلكترونية: صافي الربح بعد رسوم الدفع والشحن والمرتجعات والإعلانات.",
  applicationName: SITE.name,
  openGraph: {
    type: "website", locale: "ar_SA", siteName: SITE.name,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "حاسبة أرباح المتجر الإلكتروني: صافي ربح كل طلب" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  alternates: { canonical: "/" },
  // AdSense site verification (harmless before approval: emitted only when configured)
  ...(SITE.adsClient ? { other: { "google-adsense-account": SITE.adsClient } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#10181b" },
  ],
};

// Runs before first paint: applies the saved theme (or the OS one) so there is no light/dark flash.
const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem('theme')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.dataset.themeMode=m;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans leading-relaxed antialiased [padding-bottom:env(safe-area-inset-bottom)]">
        <ToastProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ToastProvider>
        {SITE.adsClient && (
          <Script async strategy="afterInteractive" crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsClient}`} />
        )}
      </body>
    </html>
  );
}
