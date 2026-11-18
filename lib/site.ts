export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "حاسبة تاجر",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://tajercalc.com").replace(/\/$/, ""),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "tajercalc@gmail.com",
  // AdSense publisher id (public; it also appears in ads.txt)
  adsClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-5102038600553073",
  adSlots: {
    afterTool: process.env.NEXT_PUBLIC_AD_SLOT_AFTER_TOOL || "",
    inArticle: process.env.NEXT_PUBLIC_AD_SLOT_IN_ARTICLE || "",
  },
  /** date the fee figures were last checked against official pages */
  feesReviewed: "1 أكتوبر 2026",
};

export const NAV = [
  { href: "/", label: "الحاسبة" },
  { href: "/guides/", label: "المقالات" },
  { href: "/about/", label: "من نحن" },
  { href: "/contact/", label: "تواصل معنا" },
];

/** Articles, grouped for the /guides/ hub (also listed in the footer and the sitemap). */
export const ARTICLES = [
  { href: "/guide-profit/", label: "دليل حساب الربح", group: "profit",
    desc: "كيف تحسب صافي ربح الطلب خطوة بخطوة: التكلفة والشحن ورسوم الدفع والمرتجعات والإعلان، بمثال كامل." },
  { href: "/guide-pricing/", label: "دليل التسعير", group: "profit",
    desc: "بكم تبيع منتجك؟ أقل سعر بدون خسارة، وليش المنتج الرخيص يحتاج مضاعفة أكبر، وأثر الحزم والشحن والخصم." },
  { href: "/guide-cod-returns/", label: "الدفع عند الاستلام والمرتجعات", group: "profit",
    desc: "كيف تأكل نسبة المرتجعات والتأكيد ربحك في الدفع عند الاستلام، وكم تتحمل قبل ما تخسر." },
  { href: "/salla-fees/", label: "رسوم سلة", group: "fees",
    desc: "أسعار باقات سلة ورسوم مدى والبطاقات مع الضريبة، والرسوم حسب قيمة الطلب، وكم طلب يغطي الاشتراك." },
  { href: "/zid-fees/", label: "رسوم زد", group: "fees",
    desc: "أسعار باقات زد ورسوم زد باي ورسوم الإيداع، وكم يبقى لك من كل طلب." },
  { href: "/salla-vs-zid/", label: "سلة أو زد", group: "fees",
    desc: "مقارنة التكاليف بالأرقام: كم تدفع شهرياً في كل منصة عند 50 و100 و300 طلب، ومتى يفرق الفرق." },
] as const;

/** Landing pages: the same calculator, preset for one search intent, with its own article. */
export const TOOLS = [
  { href: "/salla-profit-calculator/", label: "حاسبة أرباح سلة" },
  { href: "/zid-profit-calculator/", label: "حاسبة أرباح زد" },
  { href: "/cod-calculator/", label: "حاسبة الدفع عند الاستلام" },
  { href: "/roas-calculator/", label: "حاسبة ROAS والإعلانات" },
  { href: "/pricing-calculator/", label: "حاسبة سعر البيع" },
  { href: "/digital-cards-calculator/", label: "حاسبة أرباح بطاقات الشحن" },
];
