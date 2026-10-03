// Post-build: rewrite absolute paths in out/**/*.html to relative ones, so the static site works
// from ANY location: double-clicked file://, VS Code Live Server in a subfolder, GitHub Pages
// without a custom domain (user.github.io/repo/), or a normal domain root.
// Next's runtime finds its chunks from the <script src>, and CSS font urls are already relative.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? (f === "_next" ? [] : walk(p)) : p.endsWith(".html") ? [p] : [];
});

let files = 0, links = 0;
for (const file of walk(OUT)) {
  const depth = relative(OUT, file).split(sep).length - 1;
  const pre = depth === 0 ? "./" : "../".repeat(depth);
  let s = readFileSync(file, "utf8");
  // Assets: src="/_next/…" / href="/_next/…" attributes, and \"/_next/…\" inside the inline RSC payload
  // (CSS + chunk lists). Safe with the webpack build only: webpack identifies chunks by id.
  // Turbopack matches chunks by their literal src string, so this rewrite would break its hydration;
  // that is why `npm run build` uses `next build --webpack`.
  s = s.replace(/(\s(?:src|href)=")\/_next\//g, `$1${pre}_next/`).replace(/\\"\/_next\//g, `\\"${pre}_next/`);
  // internal page links: href="/" and href="/slug/" → explicit index.html (needed for file://)
  s = s.replace(/href="\/((?:[a-z0-9-]+\/)*)"/g, (_, path) => { links++; return `href="${pre}${path}index.html"`; });
  // favicon / other root files referenced as href="/x.ext"
  s = s.replace(/href="\/([a-z0-9-]+\.(?:ico|png|svg|txt|xml|webmanifest)(?:\?[^"]*)?)"/g, `href="${pre}$1"`);
  writeFileSync(file, s);
  files++;
}
console.log(`relative-paths: ${files} pages, ${links} internal links rewritten`);

// CSS: font urls are written as url(/_next/static/media/…) → make them relative to each CSS file.
const walkCss = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walkCss(p) : p.endsWith(".css") ? [p] : [];
});
let css = 0;
for (const file of walkCss(join(OUT, "_next"))) {
  const up = relative(join(file, ".."), join(OUT, "_next")).split(sep).join("/");
  const s = readFileSync(file, "utf8");
  const r = s.replace(/url\(\s*(["']?)\/_next\//g, `url($1${up}/`);
  if (r !== s) { writeFileSync(file, r); css++; }
}
console.log(`relative-paths: ${css} css files rewritten`);

// Webpack runtime: public path is hard-coded as "/_next/". Derive it from the runtime's own <script src>
// instead, so lazily loaded chunks resolve correctly from any folder.
const chunksDir = join(OUT, "_next", "static", "chunks");
const runtime = readdirSync(chunksDir).find((f) => /^webpack-.*\.js$/.test(f));
if (runtime) {
  const p = join(chunksDir, runtime);
  const s = readFileSync(p, "utf8");
  const n = s.split('.p="/_next/"').length - 1;
  if (n !== 1) throw new Error(`relative-paths: expected one public path in ${runtime}, found ${n}`);
  writeFileSync(p, s.replace('.p="/_next/"',
    '.p=(function(){var c=document.currentScript;return c&&c.src?c.src.replace(/static\\/chunks\\/[^/]*$/,""):"/_next/"})()'));
  console.log("relative-paths: webpack public path made relative");
}
