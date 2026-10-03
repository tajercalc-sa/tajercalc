import { NAV, SITE } from "@/lib/site";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <nav aria-label="القائمة الرئيسية" className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
        <a href="/" className="me-auto flex items-center gap-2 rounded-lg font-bold text-ink transition-opacity duration-200 hover:opacity-80
          focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          {/* same mark as app/icon.svg (the receipt): inline, so it costs no extra request */}
          <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
            <rect width="64" height="64" rx="14" fill="#0b6e4f" />
            <path d="M18 12h28v34l-3.5 4-3.5-4-3.5 4-3.5-4-3.5 4-3.5-4-3.5 4-3.5-4z" fill="#fff" />
            <path d="M23 21h18M23 28h18M23 35h11" stroke="#0b6e4f" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
          <span className="text-lg">{SITE.name}</span>
        </a>
        <div className="order-last flex w-full flex-wrap gap-x-4 gap-y-1 sm:order-none sm:w-auto">
          {NAV.slice(1).map((n) => (
            <a key={n.href} href={n.href}
              className="rounded text-sm text-accent underline-offset-4 transition-colors duration-200 hover:text-ink hover:underline
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{n.label}</a>
          ))}
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line bg-surface text-sm text-muted">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-1 px-4 py-3">
        <span>© {new Date().getFullYear()} {SITE.name}</span>
        <a className="text-accent" href="/privacy/">سياسة الخصوصية</a>
        <a className="text-accent" href="/about/">من نحن</a>
        <a className="text-accent" href="/contact/">تواصل معنا</a>
      </div>
      <p className="mx-auto max-w-5xl px-4 pb-4">الأدوات تقديرية وليست نصيحة مالية أو محاسبية. راجع رسوم منصتك وشركات الدفع والشحن لديك.</p>
    </footer>
  );
}
