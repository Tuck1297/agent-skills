#!/usr/bin/env node
// Bundles a deck into ONE self-contained .html file: the engine, icons, libraries
// (add-lib.mjs), the theme's Google Fonts and local images, video and audio are all
// inlined, so it opens offline, by email, from a USB stick, or as a hosted page.
// JPEG and PNG images become WebP when that makes them smaller (encoded by the Chrome or
// Edge on this computer), an image shown more than once is stored once, and it warns when
// the file is too big to email or to publish as one page.
//
//   node bundle.mjs <deck folder or deck.html> [--out file.html] [--all-fonts]
//        [--keep-media] [--no-fonts] [--quality 0.8] [--max-px 2560] [--no-webp]
//
// --keep-media   leave video/audio as files next to the bundle (copied to dist/assets/)
// --all-fonts    keep every font subset (Cyrillic, Greek, Vietnamese...), not just Latin
// --quality      WebP quality from 0 to 1 (default 0.8); lower is smaller and softer
// --max-px       scale images down so the longest side is at most this (default 2560, 0 = never)
// --no-webp      keep images exactly as they are (no WebP, no scaling)
// --no-dedupe    write an image out again each time it's shown
// Output: <deck folder>/dist/<title>.html (unless --out).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { args, deckFile, folderName, usage } from "./lib/engine.mjs";
import { buildDeckIcons, cacheDir } from "./lib/icons.mjs";
import { imageSize, shrinkImages } from "./lib/images.mjs";

const opt = args(process.argv.slice(2));
const file = deckFile(opt._[0]);
if (!file || !fs.existsSync(file)) {
  console.log(usage(fileURLToPath(import.meta.url), 17));
  process.exit(1);
}
const deckDir = path.dirname(file);
const warnings = [];
function numberOption(name, def, ok) {
  if (opt[name] === undefined) return def;
  const v = Number(opt[name]);
  if (typeof opt[name] === "string" && ok(v)) return v;
  warnings.push(`--${name} ${opt[name] === true ? "needs a value" : `${opt[name]} is out of range`}; used ${def}`);
  return def;
}
const quality = numberOption("quality", 0.8, (q) => q > 0 && q <= 1);
const maxPx = numberOption("max-px", 2560, (n) => Number.isInteger(n) && n >= 0);

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
const isInline = (u) => /^(data:|blob:|#|mailto:|tel:|javascript:|html-slides-media:)/i.test(u);

// Images go in as a short placeholder, one per distinct image, and become data: URIs at the
// end, after they've been made WebP and repeats have been pointed at one stored copy.
const media = new Map(); // id -> { buf, mime, label }
const MEDIA_TOKEN = /html-slides-media:([0-9a-f]{16})/g;
// Bytes each inlined file adds to the bundle, for the size report.
const weights = new Map();
const weigh = (label, bytes) => weights.set(label, (weights.get(label) || 0) + bytes);
function inlineData(buf, mime, label) {
  if (mime.startsWith("image/")) {
    const id = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
    if (!media.has(id)) media.set(id, { buf, mime, label });
    return `html-slides-media:${id}`;
  }
  const uri = dataUri(buf, mime);
  weigh(mime.startsWith("font/") ? "fonts" : label, uri.length);
  return uri;
}

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
  return inlineData(fs.readFileSync(p), mime, path.relative(deckDir, p).split(path.sep).join("/"));
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
        map.set(ref, inlineData(await fetchCached(abs), MIME[extOf(abs)] || "application/octet-stream", abs.split(/[?#]/)[0]));
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
  weigh(src.replace(/^https?:\/\/[^/]+\/(npm\/)?/i, ""), js.length);
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

// ---------- images: WebP, and one stored copy of each repeated image ----------
const ids = [...new Set([...html.matchAll(MEDIA_TOKEN)].map((m) => m[1]))];
// For the size warning: how many images --max-px 1920 would scale down.
const over1920 = ids.filter((id) => {
  const size = imageSize(media.get(id).buf);
  return size && Math.max(size.w, size.h) > 1920;
}).length;
const shrunk = { count: 0, before: 0, after: 0 };
if (ids.length && !opt["no-webp"]) {
  const { results, error } = await shrinkImages(
    ids.map((id) => media.get(id)),
    { quality, maxPx, onEncode: (n) => console.log(`Making ${n} image(s) WebP (cached for next time)...`) },
  );
  if (error) warnings.push(`some images were kept as they are: ${error}`);
  ids.forEach((id, i) => {
    if (!results[i]) return;
    const m = media.get(id);
    shrunk.count++;
    shrunk.before += m.buf.length;
    shrunk.after += results[i].buf.length;
    Object.assign(m, results[i]);
  });
}
const uris = new Map(ids.map((id) => [id, dataUri(media.get(id).buf, media.get(id).mime)]));

// An <img> whose image is shown more than once gets data-media-src="mN" instead of its own
// copy, and MEDIA_LOADER sets its src from #deck-media before the engine runs, so the
// engine, overview and presenter view only ever see ordinary <img src>.
const MEDIA_LOADER = `// bundle.mjs stored each image shown more than once a single time, in #deck-media.
(function () {
  var media = JSON.parse(document.getElementById("deck-media").textContent);
  function put(root) {
    var imgs = root.querySelectorAll("[data-media-src]");
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute("src", media[imgs[i].getAttribute("data-media-src")]);
      imgs[i].removeAttribute("data-media-src");
    }
    var templates = root.querySelectorAll("template");
    for (var j = 0; j < templates.length; j++) put(templates[j].content);
  }
  put(document);
})();`;
const IMG_SRC = /(<img\b[^>]*?\s)(?:data-)?src\s*=\s*(["'])html-slides-media:([0-9a-f]{16})\2/gi;
const imgUses = new Map(); // id -> how many <img> show it
const stored = new Map(); // id -> its key in #deck-media
if (!opt["no-dedupe"]) {
  for (const m of html.matchAll(IMG_SRC)) imgUses.set(m[3], (imgUses.get(m[3]) || 0) + 1);
  html = html.replace(IMG_SRC, (m, pre, q, id) => {
    if (imgUses.get(id) < 2) return m;
    if (!stored.has(id)) stored.set(id, "m" + stored.size);
    return `${pre}data-media-src="${stored.get(id)}"`;
  });
}
const dedupe = { images: stored.size, uses: 0, saved: 0 };
if (stored.size) {
  const store = Object.fromEntries([...stored].map(([id, key]) => [key, uris.get(id)]));
  const block =
    `<script type="application/json" id="deck-media">${JSON.stringify(store)}</script>\n` +
    `<script>\n${MEDIA_LOADER}\n</script>\n`;
  // Before the first script after the deck (the engine), else at the end of <body>.
  const end = html.lastIndexOf("</main>");
  const at = end < 0 ? -1 : html.indexOf("<!--html-slides-script-", end);
  if (at >= 0) html = html.slice(0, at) + block + html.slice(at);
  else if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, () => block + "</body>");
  else html += block;
  for (const id of stored.keys()) {
    const size = uris.get(id).length;
    weigh(media.get(id).label, size);
    dedupe.uses += imgUses.get(id);
    dedupe.saved += (imgUses.get(id) - 1) * size;
  }
}
html = html.replace(MEDIA_TOKEN, (m, id) => {
  weigh(media.get(id).label, uris.get(id).length);
  return uris.get(id);
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
const MB = 1048576;
const mbText = (b) => `${(b / MB).toFixed(1)} MB`;
const bytes = fs.statSync(out).size;
console.log(`Wrote ${out} (${mbText(bytes)}, ${icons.count} icons)`);
if (copied.length) console.log(`Copied ${copied.length} media file(s) next to it in ${path.join(path.dirname(out), "assets")}`);
// Sizes below are as they sit in the file: base64 makes each one about a third bigger.
if (shrunk.count)
  console.log(`  ${shrunk.count} image(s) made WebP: ${mbText((shrunk.before * 4) / 3)} -> ${mbText((shrunk.after * 4) / 3)}`);
if (dedupe.images)
  console.log(`  ${dedupe.images} image(s) shown ${dedupe.uses} times are stored once (saves ${mbText(dedupe.saved)})`);

// Where a big file stops working. Email base64-encodes an attachment again, which adds
// about a third, so the file itself has to be about a quarter under the limit.
const LIMITS = [
  { mb: 16, factor: 1, text: "hosts that cap one page at 16 MB (claude.ai Artifacts do)" },
  { mb: 20, factor: 4 / 3, text: "an Outlook.com attachment: about 15 MB fits its 20 MB limit once email encodes it" },
  { mb: 25, factor: 4 / 3, text: "a Gmail attachment, probably: about 18.7 MB fits its 25 MB limit (Gmail sends a Drive link instead)" },
];
const over = LIMITS.filter((l) => bytes * l.factor > l.mb * MB);
if (over.length) {
  console.log(`  Size warning: at ${mbText(bytes)} it's too big for`);
  for (const l of over) console.log(`    - ${l.text}`);
  const heaviest = [...weights].sort((a, b) => b[1] - a[1]).filter(([, b]) => b >= 0.1 * MB).slice(0, 5);
  if (heaviest.length) {
    console.log("  Heaviest parts:");
    for (const [label, b] of heaviest) console.log(`    ${mbText(b).padStart(8)}  ${label}`);
  }
  const tips = [];
  if ([...weights.keys()].some(isMedia)) tips.push("--keep-media puts video and audio next to the file");
  if (opt["no-webp"] && ids.length) tips.push("leave out --no-webp");
  if (shrunk.count) tips.push(`a lower --quality (now ${quality})`);
  if (!opt["no-webp"] && over1920 && (maxPx === 0 || maxPx > 1920)) tips.push(`--max-px 1920 (${over1920} image(s) are bigger)`);
  if (heaviest.some(([label]) => /\.js$/i.test(label) && !/^engine\//.test(label)))
    tips.push("remove libraries the deck doesn't use (add-lib.mjs --remove)");
  tips.push("crop screenshots to the part that matters, or share a link instead of the file");
  console.log(`  To make it smaller: ${tips.join("; ")}.`);
}
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
