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
