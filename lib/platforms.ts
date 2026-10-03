import { SALLA_PLANS, SALLA_SAMPLE_PAYMENTS, type PaymentRow } from "./calc";

/** Platform-specific bits of the calculator: plan picker, the "fill fees" button and the notes citing sources. */
export type Platform = {
  id: "salla" | "zid";
  name: string;
  plans: readonly { value: string; label: string }[];
  plansNote: string;
  samplePayments: PaymentRow[];
  /** how many leading payment rows the fill button sets fees for (used for the "filled" check and highlight) */
  fillRows: number;
  fillLabel: string;
  feesNote: string;
};

export const SALLA: Platform = {
  id: "salla",
  name: "سلة",
  plans: SALLA_PLANS,
  plansNote: "أسعار باقات سلة من صفحة الأسعار الرسمية (1 أكتوبر 2026) وقد تتغير. الاشتراك السنوي مقسوم على 12 شهراً.",
  samplePayments: SALLA_SAMPLE_PAYMENTS,
  fillRows: 2,
  fillLabel: "عبّئ برسوم سلة (مدى والبطاقات)",
  feesNote:
    "مدى: 1% + 1 ريال (مؤكد من سلة). البطاقات: مقال سلة يذكر 2% + 1 ولوحة التحكم تذكر 2.2% + 1، فالزر يستخدم 2.2% حتى لا يبالغ في ربحك. Apple Pay بنفس رسوم البطاقة المستخدمة. مراجعة: 1 أكتوبر 2026.",
};

/** Zid: zid.sa/ar/pricing and zid.sa/ar/solutions/payments (Growth plan fees), checked 3 Oct 2026. */
export const ZID_PLANS = [
  { value: "0", label: "البداية (مجانية)" },
  { value: "99", label: "الانطلاقة 99 شهرياً" },
  { value: "299", label: "النمو 299 شهرياً" },
] as const;

export const ZID_SAMPLE_PAYMENTS: PaymentRow[] = [
  { share: "50", pct: "1", fixed: "1" },
  { share: "35", pct: "2.3", fixed: "1" },
  { share: "10", pct: "3.3", fixed: "1" },
  { share: "0", pct: "0", fixed: "0" },
  { share: "5", pct: "0", fixed: "0" },
];

export const ZID: Platform = {
  id: "zid",
  name: "زد",
  plans: ZID_PLANS,
  plansNote: "أسعار باقات زد الشهرية من صفحة الأسعار الرسمية (3 أكتوبر 2026) وقد تتغير مع العروض. باقة الاحترافية بسعر حسب الطلب، فأدخلها يدوياً.",
  samplePayments: ZID_SAMPLE_PAYMENTS,
  fillRows: 3,
  fillLabel: "عبّئ برسوم زد باي (مدى والبطاقات والتقسيط)",
  feesNote:
    "رسوم زد باي من صفحة حلول الدفع في زد لباقة النمو: مدى 1% + 1 ريال، البطاقات 2.3% + 1، التقسيط 3.3% + 1، والرسوم لا تشمل الضريبة. Apple Pay حسب البطاقة المستخدمة. قد تختلف في باقتك، فراجعها في لوحة التحكم. مراجعة: 3 أكتوبر 2026.",
};
