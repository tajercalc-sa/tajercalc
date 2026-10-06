// Shared behaviour for the calculator's number fields (text inputs, not type="number"):
//  - Arabic-Indic / Persian digits and the Arabic decimal mark are converted, so an Arabic keyboard works
//  - only digits and one decimal point are kept, and leading zeros are dropped ("00100" → "100")
//  - clicking into the empty part of a right-aligned field puts the caret after the last digit,
//    not before the first one (where typing would prepend: 100 → 00100)

const DIGITS: Record<string, string> = {};
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (DIGITS[d] = String(i)));
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (DIGITS[d] = String(i)));

export function cleanNumber(raw: string): string {
  let s = raw.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]).replace(/[٫,]/g, ".").replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  s = s.replace(/^0+(?=\d)/, ""); // keep a single 0 before a decimal point
  return s.startsWith(".") ? "0" + s : s;
}

export function caretToEnd(e: React.SyntheticEvent<HTMLInputElement>) {
  // runs on click, after the browser has placed the caret (mouse and touch alike)
  const el = e.currentTarget;
  if (el.selectionStart === 0 && el.selectionEnd === 0 && el.value) el.setSelectionRange(el.value.length, el.value.length);
}
