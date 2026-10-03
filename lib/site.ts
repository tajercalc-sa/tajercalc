export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "حاسبة تاجر",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://tajercalc.com").replace(/\/$/, ""),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "tajercalc@gmail.com",
  adsClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "",
  adSlots: {
    afterTool: process.env.NEXT_PUBLIC_AD_SLOT_AFTER_TOOL || "",
    inArticle: process.env.NEXT_PUBLIC_AD_SLOT_IN_ARTICLE || "",
  },
  /** date the fee figures were last checked against official pages */
  feesReviewed: "1 أكتوبر 2026",
};

export const NAV = [
  { href: "/", label: "الحاسبة" },
  { href: "/guide-profit/", label: "دليل حساب الربح" },
  { href: "/guide-cod-returns/", label: "الدفع عند الاستلام والمرتجعات" },
  { href: "/about/", label: "من نحن" },
  { href: "/contact/", label: "تواصل معنا" },
];

/** Landing pages: the same calculator, preset for one search intent, with its own article. */
export const TOOLS = [
  { href: "/salla-profit-calculator/", label: "حاسبة أرباح سلة" },
  { href: "/zid-profit-calculator/", label: "حاسبة أرباح زد" },
  { href: "/cod-calculator/", label: "حاسبة الدفع عند الاستلام" },
  { href: "/roas-calculator/", label: "حاسبة ROAS والإعلانات" },
  { href: "/pricing-calculator/", label: "حاسبة سعر البيع" },
];
