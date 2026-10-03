import { DEFAULT_INPUTS, CURRENCIES, type Inputs, type Target } from "./calc";

/** Everything needed to reproduce a calculation: what goes into the share link and browser storage. */
export type Snapshot = {
  inp: Inputs;
  cur: string;
  productName: string;
  plan: string;
  target: Target;
};

export const DEFAULT_SNAPSHOT: Snapshot = {
  inp: DEFAULT_INPUTS,
  cur: CURRENCIES[0].symbol,
  productName: "",
  plan: "",
  target: { kind: "margin", value: "" },
};

const STORAGE_KEY = "tajer-calc:v1";
const HASH_KEY = "s";

/* base64url of UTF-8 (Arabic product names survive) */
function toB64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Only fields that differ from the defaults → short links. */
function diff(s: Snapshot) {
  const d: Record<string, unknown> = {};
  const i: Record<string, unknown> = {};
  (Object.keys(DEFAULT_INPUTS) as (keyof Inputs)[]).forEach((k) => {
    if (JSON.stringify(s.inp[k]) !== JSON.stringify(DEFAULT_INPUTS[k])) i[k] = s.inp[k];
  });
  if (Object.keys(i).length) d.i = i;
  if (s.cur !== DEFAULT_SNAPSHOT.cur) d.c = s.cur;
  if (s.productName) d.n = s.productName;
  if (s.plan) d.p = s.plan;
  if (s.target.value !== "") d.t = s.target;
  return d;
}

const str = (v: unknown, max = 40) => (typeof v === "string" && v.length <= max ? v : undefined);

/**
 * Rebuilds a snapshot from untrusted data (a link anyone can edit, or old storage).
 * Unknown keys are dropped, wrong types fall back to defaults, strings are length-capped.
 */
function parse(raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const inp: Inputs = { ...DEFAULT_INPUTS, payments: DEFAULT_INPUTS.payments.map((p) => ({ ...p })) };
  const ri = (r.i && typeof r.i === "object" ? r.i : {}) as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_INPUTS) as (keyof Inputs)[]) {
    const v = ri[k];
    if (v === undefined) continue;
    if (k === "vatOn") { if (typeof v === "boolean") inp.vatOn = v; continue; }
    if (k === "adMode") { if (v === "order" || v === "budget" || v === "cpc") inp.adMode = v; continue; }
    if (k === "payments") {
      if (Array.isArray(v) && v.length === 5)
        inp.payments = v.map((row, n) => {
          const o = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
          return { share: str(o.share) ?? inp.payments[n].share, pct: str(o.pct) ?? inp.payments[n].pct, fixed: str(o.fixed) ?? inp.payments[n].fixed };
        });
      continue;
    }
    const s = str(v);
    if (s !== undefined) (inp as Record<string, unknown>)[k] = s;
  }
  const cur = CURRENCIES.some((c) => c.symbol === r.c) ? (r.c as string) : DEFAULT_SNAPSHOT.cur;
  const t = (r.t && typeof r.t === "object" ? r.t : {}) as Record<string, unknown>;
  return {
    inp,
    cur,
    productName: str(r.n, 60) ?? "",
    plan: str(r.p, 10) ?? "",
    target: { kind: t.kind === "amount" ? "amount" : "margin", value: str(t.value, 12) ?? "" },
  };
}

export const isDefault = (s: Snapshot) => Object.keys(diff(s)).length === 0;

/* ── share link ── */
export function shareUrl(s: Snapshot) {
  const base = location.href.split("#")[0];
  const d = diff(s);
  return Object.keys(d).length ? `${base}#${HASH_KEY}=${toB64(JSON.stringify(d))}` : base;
}
export function readHash(): Snapshot | null {
  const m = location.hash.match(new RegExp(`[#&]${HASH_KEY}=([A-Za-z0-9_-]+)`));
  if (!m) return null;
  try { return parse(JSON.parse(fromB64(m[1]))); } catch { return null; }
}
export function clearHash() {
  try { history.replaceState(null, "", location.href.split("#")[0]); } catch { /* file:// in some browsers */ }
}

/* ── browser storage (per visitor, never leaves the device) ── */
export function save(s: Snapshot) {
  try { isDefault(s) ? localStorage.removeItem(STORAGE_KEY) : localStorage.setItem(STORAGE_KEY, JSON.stringify(diff(s))); } catch { /* private mode / blocked */ }
}
export function load(): Snapshot | null {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? parse(JSON.parse(v)) : null; } catch { return null; }
}
