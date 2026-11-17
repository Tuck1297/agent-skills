#!/usr/bin/env node
// Bundles a deck into ONE self-contained .html file: the engine, icons, libraries
// (add-lib.mjs), the theme's Google Fonts and local images, video and audio are all
// inlined, so it opens offline, by email, from a USB stick, or as a hosted page.
//
//   node bundle.mjs <deck folder or deck.html> [--out file.html] [--all-fonts]
//        [--keep-media] [--no-fonts]
//
// --keep-media   leave video/audio as files next to the bundle (copied to dist/assets/)
// --all-fonts    keep every font subset (Cyrillic, Greek, Vietnamese...), not just Latin
// Output: <deck folder>/dist/<title>.html (unless --out).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { args, deckFile, folderName, usage } from "./lib/engine.mjs";
import { buildDeckIcons, cacheDir } from "./lib/icons.mjs";

const opt = args(process.argv.slice(2));
const file = deckFile(opt._[0]);
if (!file || !fs.existsSync(file)) {
  console.log(usage(fileURLToPath(import.meta.url), 12));
  process.exit(1);
}
const deckDir = path.dirname(file);
const warnings = [];

const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", svg: "image/svg+xml", ico: "image/x-icon", mp4: "video/mp4", webm: "video/webm",
  mov: "video/quicktime", m4v: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
  m4a: "audio/mp4", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf",
  json: "application/json", pdf: "application/pdf", css: "text/css", js: "text/javascript",
};
const extOf = (p) => (p.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";
const isMedia = (p) => /^(mp4|webm|mov|m4v|mp3|wav|ogg|m4a)$/.test(extOf(p));
const dataUri = (buf, mime) => `data:${mime};base64,${buf.toString("base64")}`;
// "</script" would end the inline script and "<!--" can confuse the HTML parser.
// \x21 is "!" and is valid in strings and in every kind of regex.
const escScript = (js) => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\x21--");
const isRemote = (u) => /^https?:\/\//i.test(u);
const isInline = (u) => /^(data:|blob:|#|mailto:|tel:|javascript:)/i.test(u);

// ---------- network, cached ----------
const netDir = path.join(cacheDir(), "cdn");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
async function fetchCached(url) {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  const f = path.join(netDir, key);
  // Pinned CDN files never change; Google Fonts CSS can, so re-fetch it after a day.
  const pinned = /cdn\.jsdelivr\.net\/npm\/[^/]+@\d|unpkg\.com\/[^/]+@\d|cdnjs\.cloudflare\.com|fonts\.gstatic\.com/.test(url);
  if (fs.existsSync(f) && (pinned || Date.now() - fs.statSync(f).mtimeMs < 86400000)) return fs.readFileSync(f);
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(netDir, { recursive: true });
  fs.writeFileSync(f, buf);
  return buf;
}

// ---------- local files ----------
const copied = [];
function localPath(ref, baseDir) {
  const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
  const p = path.resolve(baseDir, clean);
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
}
function inlineLocal(ref, baseDir, { media = true } = {}) {
  if (!ref || isInline(ref) || isRemote(ref)) return ref;
  const p = localPath(ref, baseDir);
  if (!p) {
    warnings.push(`not found: ${ref}`);
    return ref;
  }
  if (isMedia(p) && (opt["keep-media"] || !media)) {
    const target = path.join("assets", path.relative(deckDir, p).replace(/^(\.\.[\\/])+/, "").replace(/^assets[\\/]/, ""));
    copied.push([p, target]);
    return target.split(path.sep).join("/");
  }
  const mime = MIME[extOf(p)] || "application/octet-stream";
  return dataUri(fs.readFileSync(p), mime);
}

// url(...) inside CSS, relative to the CSS file (local path or remote URL)
async function inlineCssUrls(css, base) {
  // In @font-face, keep only woff2 sources when there is one.
  css = css.replace(/src\s*:\s*([^;}]+)/g, (m, list) => {
    if (!/woff2/.test(list)) return m;
    const parts = list.split(/,(?![^(]*\))/).filter((p) => /woff2|local\(/.test(p));
    return "src: " + parts.join(",");
  });
  const refs = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]);
  const map = new Map();
  for (const ref of new Set(refs)) {
    if (isInline(ref)) continue;
    try {
      if (isRemote(base) || isRemote(ref)) {
        const abs = new URL(ref, isRemote(base) ? base : undefined).href;
        map.set(ref, dataUri(await fetchCached(abs), MIME[extOf(abs)] || "application/octet-stream"));
      } else {
        map.set(ref, inlineLocal(ref, base));
      }
    } catch (e) {
      warnings.push(`could not inline ${ref} (${e.message})`);
    }
  }
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, ref) => (map.has(ref) ? `url("${map.get(ref)}")` : m));
}

// Google Fonts CSS: keep latin + latin-ext subsets (or all), inline the woff2 files.
async function googleFontsCss(href) {
  let css = (await fetchCached(href.replace(/&amp;/g, "&"))).toString("utf8");
  if (!opt["all-fonts"]) {
    const blocks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/);
    const kept = blocks.filter((b) => !/^\/\*/.test(b) || /^\/\*\s*(latin|latin-ext)\s*\*\//.test(b));
    css = kept.join("");
  }
  return inlineCssUrls(css, href);
}

// ---------- the deck ----------
const icons = buildDeckIcons(file);
if (icons.unknown.length) warnings.push(`unknown icons (left blank): ${icons.unknown.join(", ")}`);

let html = fs.readFileSync(file, "utf8");
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i")) || [])[2];

// Stylesheets
const linkRe = /<link\b[^>]*>/gi;
const links = [...html.matchAll(linkRe)].map((m) => m[0]);
for (const tag of links) {
  const rel = (attr(tag, "rel") || "").toLowerCase();
  const href = attr(tag, "href");
  if (rel === "preconnect" || rel === "dns-prefetch") {
    html = html.replace(tag, "");
    continue;
  }
  if (rel !== "stylesheet" || !href) continue;
  const marks = [];
  for (const a of ["data-theme-fonts", "data-brand-fonts", "data-lib"]) {
    const v = attr(tag, a);
    if (v !== undefined) marks.push(`${a}="${v}"`);
    else if (new RegExp(`\\s${a}(\\s|>|/)`).test(tag)) marks.push(a);
  }
  let css;
  try {
    if (/fonts\.googleapis\.com/.test(href)) {
      if (opt["no-fonts"]) continue;
      css = await googleFontsCss(href);
    } else if (isRemote(href)) {
      css = await inlineCssUrls((await fetchCached(href)).toString("utf8"), href);
    } else {
      const p = localPath(href, deckDir);
      if (!p) {
        warnings.push(`stylesheet not found: ${href}`);
        continue;
      }
      css = await inlineCssUrls(fs.readFileSync(p, "utf8"), path.dirname(p));
    }
  } catch (e) {
    warnings.push(`kept link to ${href} (${e.message})`);
    continue;
  }
  html = html.replace(tag, () => `<style${marks.length ? " " + marks.join(" ") : ""}>\n${css}\n</style>`);
}

// Scripts with src
const scriptRe = /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/script>/gi;
for (const m of [...html.matchAll(scriptRe)]) {
  const [tag, , src] = m;
  let js;
  try {
    if (isRemote(src)) js = (await fetchCached(src)).toString("utf8");
    else {
      const p = localPath(src, deckDir);
      if (!p) {
        warnings.push(`script not found: ${src}`);
        continue;
      }
      js = fs.readFileSync(p, "utf8");
    }
  } catch (e) {
    warnings.push(`kept link to ${src} (${e.message})`);
    continue;
  }
  const lib = attr(tag, "data-lib");
  const type = attr(tag, "type");
  const open = `<script${type ? ` type="${type}"` : ""}${lib ? ` data-lib="${lib}"` : ""}${/\sdefer[\s>]/.test(tag) && !type ? ' type="module"' : ""}>`;
  html = html.replace(tag, () => `${open}\n${escScript(js)}\n</script>`);
}

// <style> blocks in the deck: url(...) to local files
html = await replaceAsync(html, /<style\b([^>]*)>([\s\S]*?)<\/style>/gi, async (m, attrs, css) =>
  /data-(theme-fonts|brand-fonts|lib)|url\("data:/.test(attrs) ? m : `<style${attrs}>${await inlineCssUrls(css, deckDir)}</style>`,
);

// Set the scripts aside while the HTML passes below run: library code is full of strings
// like '<img src="' + x + '"' and the engine's comments mention the data list tag.
const asideScripts = [];
html = html.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, (m, attrs) => {
  if (/id\s*=\s*["']deck-data["']/.test(attrs)) return m;
  asideScripts.push(m);
  return `<!--html-slides-script-${asideScripts.length - 1}-->`;
});

// src / poster / href(download) attributes and inline style url()
html = html.replace(/(<(?:img|video|audio|source|track|image|use|embed|object|input)\b[^>]*?\s(?:src|poster|href|data|data-src|data-poster)\s*=\s*)(["'])(.*?)\2/gi, (m, pre, q, ref) =>
  isInline(ref) || isRemote(ref) || /\{\{/.test(ref) ? m : `${pre}${q}${inlineLocal(ref, deckDir)}${q}`,
);
// The deck's logo (main.deck data-logo, data-logo-invert)
html = html.replace(/<main\b[^>]*>/gi, (tag) =>
  tag.replace(/(\sdata-logo(?:-invert)?\s*=\s*)(["'])(.*?)\2/gi, (m, pre, q, ref) =>
    !ref || isInline(ref) || isRemote(ref) || /\{\{/.test(ref) ? m : `${pre}${q}${inlineLocal(ref, deckDir)}${q}`,
  ),
);
html = html.replace(/(<(?:img|source)\b[^>]*?\s(?:data-)?srcset\s*=\s*)(["'])(.*?)\2/gi, (m, pre, q, set) =>
  /\{\{/.test(set) ? m :
  `${pre}${q}${set
    .split(",")
    .map((part) => {
      const [u, d] = part.trim().split(/\s+/);
      return [isInline(u) || isRemote(u) ? u : inlineLocal(u, deckDir), d].filter(Boolean).join(" ");
    })
    .join(", ")}${q}`,
);
html = html.replace(/\sstyle\s*=\s*(["'])(.*?)\1/gi, (m, q, style) => {
  if (!/url\(/.test(style)) return m;
  const out = style.replace(/url\(\s*(&quot;|['"]?)([^'")&]+)\1\s*\)/g, (u, qq, ref) =>
    isInline(ref) || isRemote(ref) ? u : `url(${inlineLocal(ref, deckDir)})`,
  );
  return ` style=${q}${out}${q}`;
});

// Data list: strings that are paths to local media files
html = html.replace(/(<script[^>]*id=["']deck-data["'][^>]*>)([\s\S]*?)(<\/script>)/, (m, open, json, close) => {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    warnings.push("the data list is not valid JSON; left as is");
    return m;
  }
  const walk = (v) => {
    if (typeof v === "string") {
      if (/\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov|m4v|mp3|wav|ogg|m4a)$/i.test(v) && !isRemote(v) && !isInline(v) && localPath(v, deckDir))
        return inlineLocal(v, deckDir);
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return `${open}\n${JSON.stringify(walk(data), null, 2).replace(/</g, "\\u003c")}\n${close}`;
});
html = html.replace(/<!--html-slides-script-(\d+)-->/g, (m, i) => asideScripts[Number(i)]);

// Leftover remote references (will need the internet)
const remote = [...html.matchAll(/<(?:script|link|img|video|source|iframe)\b[^>]*\s(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]);
for (const u of new Set(remote)) warnings.push(`still loads from the internet: ${u}`);

// ---------- write ----------
const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
let name = title.includes("{{") ? "" : title;
if (!name) {
  try {
    const d = JSON.parse((html.match(/<script[^>]*id=["']deck-data["'][^>]*>([\s\S]*?)<\/script>/) || [])[1] || "{}");
    name = (d.deck && d.deck.title) || "";
  } catch {
    /* no data */
  }
}
// Named like the deck folder new-deck.mjs makes ("Q3 review - EMEA.html").
const out =
  typeof opt.out === "string" ? path.resolve(opt.out) : path.join(deckDir, "dist", `${folderName(name || path.basename(deckDir))}.html`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
for (const [src, target] of copied) {
  const dest = path.join(path.dirname(out), target);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
const mb = (fs.statSync(out).size / 1048576).toFixed(1);
console.log(`Wrote ${out} (${mb} MB, ${icons.count} icons)`);
if (copied.length) console.log(`Copied ${copied.length} media file(s) next to it in ${path.join(path.dirname(out), "assets")}`);
if (Number(mb) > 15) console.log("  It is big: hosts that publish one page often cap it at 16 MB (claude.ai Artifacts do). Try --keep-media, or shrink images and video.");
for (const w of [...new Set(warnings)]) console.log("  " + w);

async function replaceAsync(str, re, fn) {
  const parts = [];
  let last = 0;
  for (const m of str.matchAll(re)) {
    parts.push(str.slice(last, m.index), await fn(...m));
    last = m.index + m[0].length;
  }
  parts.push(str.slice(last));
  return parts.join("");
}
