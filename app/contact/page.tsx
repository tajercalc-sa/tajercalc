import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: `تواصل مع ${SITE.name} للاستفسارات وتصحيح الأرقام والاقتراحات.`,
  alternates: { canonical: "/contact/" },
};

export default function Page() {
  return (
    <main className="prose-ar mx-auto max-w-3xl px-4 py-8">
<h1>تواصل معنا</h1>
<p>للاستفسارات أو تصحيح الأرقام أو الاقتراحات، راسلنا على: <a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
<p>عند الإبلاغ عن خطأ في حساب، اكتب لنا الأرقام التي أدخلتها والنتيجة التي ظهرت لك، لنتمكن من إعادة الحالة.</p>
    </main>
  );
}
