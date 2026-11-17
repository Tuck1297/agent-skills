#!/usr/bin/env node
// Reads source materials so a deck can be built from them: what they say, their pictures, and
// for an app walkthrough, the app's screens and where its buttons are. No source code needed.
//
//   node reference.mjs <source> [<source> ...] --deck <deck folder> [--render] [--no-grid]
//        [--device desktop|tablet|phone] [--wait 2] [--every 0.25] [--min-change 3]
//
// A source is a deck (.pptx, .pdf, an HTML deck), a document (.docx, .pdf, .md, .txt),
// screenshots (.png .jpg .webp .gif), a screen recording (.mp4 .mov .webm .m4v), a web page or
// web app (https://... or a local .html page), or a folder holding any of them. For each one it
// writes <deck>/.reference/<name>/reference.md (read it: what the source says, and every screen
// it found) and reference.json, and puts its pictures in <deck>/assets/ref/<name>/ for slides.
//   screenshots  copied, plus grid/ copies with lines every 10% to read hotspot boxes off
//   recordings   each distinct screen, taken once it stops moving (--every: seconds between
//                looks; --min-change: % of the picture that must change to count as new)
//   web pages    a screenshot at the --device size and every button, link and field on it
//                with its exact box in % (--wait: seconds to let the page settle first;
//                --page reads a local .html file as a page even if it looks like a deck)
//   .pptx        also brand.json for new-deck.mjs --brand (theme colors and fonts)
// --render  also a picture of each slide or page (PDF, HTML deck; .pptx needs PowerPoint).
// Without --deck the output goes to ./<name>-reference/ (or --out <folder>/<name>/).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { args, usage } from "./lib/engine.mjs";
import { openZip } from "./lib/zip.mjs";
import { cacheDir } from "./lib/icons.mjs";
import { fileUrl, launch } from "./lib/browser.mjs";

const opt = args(process.argv.slice(2));
const isUrl = (s) => /^https?:\/\//i.test(s);
const given = opt._.map((s) => (isUrl(s) ? s : path.resolve(s)));
const missing = given.filter((s) => !isUrl(s) && !fs.existsSync(s));
if (!given.length || missing.length) {
  if (missing.length) console.log(`Not found: ${missing.join(", ")}\n`);
  console.log(usage(fileURLToPath(import.meta.url), 21));
  process.exit(1);
}
const deckDir = typeof opt.deck === "string" ? path.resolve(opt.deck) : null;
const EVERY = Math.max(0.05, Number(opt.every) || 0.25);
const MIN_CHANGE = opt["min-change"] !== undefined ? Math.max(0.1, Number(opt["min-change"])) : 3;
const WAIT = opt.wait !== undefined ? Math.max(0, Number(opt.wait)) * 1000 : 2000;
const GRID = !opt["no-grid"];
const RENDER = !!opt.render;
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0";
const DEVICES = {
  desktop: { w: 1440, h: 900, dpr: 1, mobile: false },
  tablet: { w: 820, h: 1180, dpr: 2, mobile: true, ua: `${ANDROID} Safari/537.36` },
  phone: { w: 390, h: 844, dpr: 2, mobile: true, ua: `${ANDROID} Mobile Safari/537.36` },
};
if (opt.device !== undefined && !DEVICES[opt.device]) {
  console.log("--device is desktop, tablet or phone");
  process.exit(1);
}
const DEVICE = opt.device || "desktop";

const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
const VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;
const DECKS = /\.(pptx|ppsx|potx)$/i;
const unxml = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
const attr = (tag, a) => (tag.match(new RegExp(`\\b${a}="([^"]*)"`)) || [])[1];
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const pad2 = (n) => String(n).padStart(2, "0");
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
// Runs a function defined here inside the page (its source is sent, so no escaping).
const call = (page, fn, ...a) => page.eval(`(${fn.toString()})(...${JSON.stringify(a)})`);

function slugOf(s) {
  let n;
  if (isUrl(s)) {
    const u = new URL(s);
    n = (u.hostname + u.pathname).replace(/\/+$/, "");
  } else n = path.basename(s).replace(/\.[^.]+$/, "");
  return n.replace(/[^\w.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60) || "source";
}

// Where one source's output goes. `screens` collects every picture for the grid pass.
function placeFor(slug) {
  const outDir = deckDir
    ? path.join(deckDir, ".reference", slug)
    : path.resolve(typeof opt.out === "string" ? path.join(opt.out, slug) : `${slug}-reference`);
  const mediaDir = deckDir ? path.join(deckDir, "assets", "ref", slug) : path.join(outDir, "media");
  return { outDir, mediaDir, slidesDir: path.join(outDir, "slides"), gridDir: path.join(outDir, "grid"), prefix: "", base: deckDir || outDir, screens: [] };
}
// A file inside a folder source shares the folder's places, with its name in front of its files.
const childOf = (ctx, slug) => ({ ...ctx, prefix: `${slug}-`, slidesDir: path.join(ctx.outDir, "slides", slug) });
const relTo = (ctx, p) => path.relative(ctx.base, p).split(path.sep).join("/");
const mediaPath = (ctx, name) => {
  fs.mkdirSync(ctx.mediaDir, { recursive: true });
  return path.join(ctx.mediaDir, ctx.prefix + name);
};

// ---------------------------------------------------------------------------
// PowerPoint
function readPptx(file, ctx) {
  const z = openZip(file);
  const relsOf = (part) => {
    const dir = path.posix.dirname(part);
    const xml = z.text(`${dir}/_rels/${path.posix.basename(part)}.rels`) || "";
    const map = new Map();
    for (const [tag] of xml.matchAll(/<Relationship\b[^>]*>/g)) {
      const external = attr(tag, "TargetMode") === "External";
      const target = attr(tag, "Target");
      map.set(attr(tag, "Id"), {
        type: (attr(tag, "Type") || "").split("/").pop(),
        target: external ? target : path.posix.normalize(path.posix.join(dir, target)),
        external,
      });
    }
    return map;
  };
  const paragraphs = (xml) =>
    [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
      .map(([, p]) => ({
        level: Number(attr(p.match(/<a:pPr\b[^>]*>/)?.[0] || "", "lvl") || 0),
        text: unxml([...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:br\/>/g)].map((m) => (m[1] === undefined ? "\n" : m[1])).join("")).trim(),
      }))
      .filter((p) => p.text);

  const pres = z.text("ppt/presentation.xml");
  const presRels = relsOf("ppt/presentation.xml");
  const ids = [...pres.matchAll(/<p:sldId\b[^>]*>/g)].map(([t]) => ({ id: attr(t, "id"), part: presRels.get(attr(t, "r:id"))?.target }));
  const sectionOf = new Map();
  for (const [, secName, body] of pres.matchAll(/<p14:section name="([^"]*)"[^>]*>([\s\S]*?)<\/p14:section>/g))
    for (const [, id] of body.matchAll(/<p14:sldId id="(\d+)"/g)) sectionOf.set(id, unxml(secName));
  const size = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);

  const used = new Map(); // media part -> [slide numbers]
  const slides = ids.map(({ id, part }, i) => {
    const xml = z.text(part) || "";
    const rels = relsOf(part);
    const layoutPart = [...rels.values()].find((r) => r.type === "slideLayout")?.target;
    const layout = layoutPart ? unxml(attr(z.text(layoutPart)?.match(/<p:cSld\b[^>]*>/)?.[0] || "", "name") || "") : "";
    // The title placeholder, or else (designed decks use plain text boxes) the biggest text.
    const blocks = [];
    for (const [sp] of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
      const ph = attr(sp.match(/<p:ph\b[^>]*>/)?.[0] || "", "type");
      if (["sldNum", "dt", "ftr"].includes(ph)) continue;
      const ps = paragraphs(sp);
      if (!ps.length) continue;
      const sz = Math.max(0, ...[...sp.matchAll(/<a:(?:rPr|defRPr)\b[^>]*\bsz="(\d+)"/g)].map((m) => Number(m[1])));
      blocks.push({ ps, sz, title: ph === "title" || ph === "ctrTitle" });
    }
    let head = blocks.find((b) => b.title);
    if (!head && blocks.some((b) => b.sz)) head = blocks.reduce((a, b) => (b.sz > a.sz ? b : a));
    let title = head ? head.ps.map((p) => p.text.replace(/\n/g, " ")).join(" ") : "";
    const body = blocks.filter((b) => b !== head).flatMap((b) => b.ps);
    const tables = [...xml.matchAll(/<a:tbl>[\s\S]*?<\/a:tbl>/g)].map(([tbl]) =>
      [...tbl.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map(([tr]) =>
        [...tr.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(([tc]) => paragraphs(tc).map((p) => p.text).join(" ")),
      ),
    );
    const media = [];
    for (const [, rid] of xml.matchAll(/r:(?:embed|link)="([^"]+)"/g)) {
      const r = rels.get(rid);
      if (!r || r.external || !/^ppt\/media\//.test(r.target)) continue;
      if (!media.includes(r.target)) media.push(r.target);
      used.set(r.target, [...new Set([...(used.get(r.target) || []), i + 1])]);
    }
    const charts = [];
    for (const [, rid] of xml.matchAll(/<c:chart\b[^>]*r:id="([^"]+)"/g)) {
      const cx = z.text(rels.get(rid)?.target || "") || "";
      const kinds = [...new Set([...cx.matchAll(/<c:(\w+)Chart>/g)].map((m) => m[1]))];
      const series = [...cx.matchAll(/<c:ser>[\s\S]*?<c:tx>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>/g)].map((m) => unxml(m[1]));
      charts.push({ kinds, series });
    }
    const notesPart = [...rels.values()].find((r) => r.type === "notesSlide")?.target;
    let notes = "";
    if (notesPart) {
      const nx = z.text(notesPart) || "";
      for (const [sp] of nx.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g))
        if (attr(sp.match(/<p:ph\b[^>]*>/)?.[0] || "", "type") === "body") notes += paragraphs(sp).map((p) => p.text).join("\n");
    }
    if (!title && body.length) title = body.shift().text;
    return {
      number: i + 1,
      hidden: /<p:sld\b[^>]*\sshow="0"/.test(xml),
      section: sectionOf.get(id),
      layout,
      title,
      body,
      tables,
      charts,
      media,
      notes: notes.trim(),
    };
  });

  // Theme of the first master
  const masterPart = [...presRels.values()].find((r) => r.type === "slideMaster")?.target;
  const themePart = masterPart ? [...relsOf(masterPart).values()].find((r) => r.type === "theme")?.target : "ppt/theme/theme1.xml";
  const theme = z.text(themePart || "ppt/theme/theme1.xml") || "";
  const color = (k) => {
    const m = theme.match(new RegExp(`<a:${k}>([\\s\\S]*?)<\\/a:${k}>`));
    if (!m) return null;
    const v = attr(m[1], "val") && /srgbClr/.test(m[1]) ? attr(m[1], "val") : attr(m[1], "lastClr");
    return v ? "#" + v.toUpperCase() : null;
  };
  const colors = Object.fromEntries(
    ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink"].map((k) => [k, color(k)]),
  );
  const fontHead = attr(theme.match(/<a:majorFont>[\s\S]*?<a:latin\b[^>]*>/)?.[0] || "", "typeface");
  const fontBody = attr(theme.match(/<a:minorFont>[\s\S]*?<a:latin\b[^>]*>/)?.[0] || "", "typeface");
  // Dark decks put a dark color behind the slides.
  const master = masterPart ? z.text(masterPart) || "" : "";
  const bgXml = master.match(/<p:bg>[\s\S]*?<\/p:bg>/)?.[0] || "";
  const scheme = attr(bgXml.match(/<a:schemeClr\b[^>]*>/)?.[0] || "", "val");
  const srgb = attr(bgXml.match(/<a:srgbClr\b[^>]*>/)?.[0] || "", "val");
  const lum = (hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // bg1/tx1 go through the master's color map (dark themes map bg1 to dk1); no <p:bg> means bg1.
  const clrMap = master.match(/<p:clrMap\b[^>]*>/)?.[0] || "";
  const resolve = (name) => colors[attr(clrMap, name) || { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" }[name] || name];
  const bgColor = srgb ? "#" + srgb.toUpperCase() : resolve(scheme || "bg1");
  const dark = bgColor ? lum(bgColor) < 0.4 : false;
  const brand = {
    accent: colors.accent1,
    accent2: colors.accent2,
    bg: bgColor || colors.lt1,
    ink: resolve("tx1") || colors.dk1,
    fontHead: fontHead && !/^\+/.test(fontHead) ? fontHead : undefined,
    fontBody: fontBody && !/^\+/.test(fontBody) ? fontBody : undefined,
    charts: ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"].map((k) => colors[k]).filter(Boolean),
  };

  // Media files
  const files = [];
  const outOf = new Map();
  for (const n of z.names.filter((n) => /^ppt\/media\//.test(n))) {
    const out = mediaPath(ctx, path.posix.basename(n));
    fs.writeFileSync(out, z.read(n));
    outOf.set(n, out);
    files.push({ file: relTo(ctx, out), slides: used.get(n) || [] });
  }
  for (const s of slides) s.media = s.media.map((m) => relTo(ctx, outOf.get(m) || mediaPath(ctx, path.posix.basename(m))));

  return {
    kind: "PowerPoint",
    size: size ? { width: Number(size[1]) / 914400, height: Number(size[2]) / 914400 } : null,
    slides,
    media: files,
    theme: { colors, fontHead, fontBody, dark },
    brand,
  };
}

function renderPptx(file, ctx) {
  if (process.platform !== "win32") return "needs Windows with PowerPoint (or export the deck to PDF and pass that)";
  fs.mkdirSync(ctx.slidesDir, { recursive: true });
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  const ps = path.join(os.tmpdir(), `html-slides-ref-${process.pid}.ps1`);
  // PowerPoint is one process per user: close only this file; quit only if it wasn't open.
  fs.writeFileSync(
    ps,
    `$ErrorActionPreference = 'Stop'
$running = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open(${q(file)}, -1, 0, 0)
try {
  $w = 1920; $h = [int](1920 * $pres.PageSetup.SlideHeight / $pres.PageSetup.SlideWidth)
  foreach ($s in $pres.Slides) { $s.Export((Join-Path ${q(ctx.slidesDir)} ('slide-{0:D2}.png' -f $s.SlideIndex)), 'PNG', $w, $h) }
} finally {
  $pres.Close()
  if (-not $running) { $app.Quit() }
}
`,
  );
  try {
    execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps], { stdio: "ignore", timeout: 600000 });
    return null;
  } catch (e) {
    return `PowerPoint couldn't render it (${e.message.split("\n")[0]})`;
  } finally {
    fs.rmSync(ps, { force: true });
  }
}

// ---------------------------------------------------------------------------
// PDF (a deck or a document), read and drawn by pdf.js in the browser
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/";
async function cached(url) {
  const f = path.join(cacheDir(), "cdn", crypto.createHash("sha1").update(url).digest("hex") + path.extname(url));
  if (!fs.existsSync(f)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} for ${url}`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return f;
}

async function readPdf(file, render, ctx) {
  const lib = await cached(PDFJS + "pdf.min.js");
  const worker = await cached(PDFJS + "pdf.worker.min.js");
  const html = path.join(os.tmpdir(), `html-slides-pdf-${process.pid}.html`);
  // The worker script loaded on the page makes pdf.js work in the page itself (no Worker).
  fs.writeFileSync(html, `<!doctype html><script src="${fileUrl(lib)}"></script><script src="${fileUrl(worker)}"></script>`);
  const { page, close } = await launch({ width: 1920, height: 1080 });
  const slides = [];
  let size = null;
  try {
    await page.goto(fileUrl(html));
    const b64 = fs.readFileSync(file).toString("base64");
    await page.eval(`window.__bytes = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0)); true`);
    const pages = await page.eval(`(async () => {
      window.__doc = await pdfjsLib.getDocument({ data: window.__bytes }).promise;
      return window.__doc.numPages;
    })()`);
    if (render) fs.mkdirSync(ctx.slidesDir, { recursive: true });
    for (let n = 1; n <= pages; n++) {
      const r = await page.eval(`(async () => {
        const p = await window.__doc.getPage(${n});
        const vp = p.getViewport({ scale: 1 });
        const tc = await p.getTextContent();
        // Lines: text items grouped by their baseline, top to bottom.
        const rows = [];
        for (const it of tc.items) {
          if (!it.str) continue;
          const y = Math.round(it.transform[5]);
          const h = Math.abs(it.transform[3]) || it.height;
          let row = rows.find((r) => Math.abs(r.y - y) < h * 0.5);
          if (!row && !it.str.trim()) continue;
          if (!row) rows.push((row = { y, h, parts: [] }));
          row.parts.push({ x: it.transform[4], w: it.width, s: it.str });
          row.h = Math.max(row.h, h);
        }
        rows.sort((a, b) => b.y - a.y);
        // Kerned and letter-spaced text arrives in pieces, spaces included: add a space only
        // across a word-sized gap; a wide gap starts a separate block.
        const lines = [];
        for (const r of rows) {
          let line = null;
          for (const p of r.parts.sort((a, b) => a.x - b.x)) {
            const gap = line ? p.x - line.x1 : 0;
            if (!line || gap > r.h * 1.5) {
              if (!p.s.trim()) continue;
              lines.push((line = { h: r.h, x0: p.x, x1: p.x, text: "" }));
            } else if (gap > r.h * 0.3 && !/\\s$/.test(line.text) && !/^\\s/.test(p.s)) line.text += " ";
            line.text += p.s;
            line.x1 = p.x + p.w;
          }
        }
        for (const l of lines) l.text = l.text.replace(/\\s+/g, " ").trim();
        let png = null;
        if (${!!render}) {
          const scale = 1920 / vp.width;
          const v = p.getViewport({ scale });
          const c = document.createElement("canvas");
          c.width = Math.round(v.width);
          c.height = Math.round(v.height);
          await p.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
          png = c.toDataURL("image/png").split(",")[1];
        }
        return { w: vp.width, h: vp.height, lines, png };
      })()`);
      size ||= { width: r.w / 72, height: r.h / 72 };
      // The title: the biggest line and the lines next to it at the same size.
      const big = r.lines.reduce((a, l) => (l.h > (a?.h || 0) ? l : a), null);
      const same = (l) => Math.abs(l.h - big.h) < big.h * 0.05 && l.x0 < big.x1 && l.x1 > big.x0;
      let head = [];
      if (big) {
        let from = r.lines.indexOf(big);
        let to = from;
        while (from > 0 && same(r.lines[from - 1])) from--;
        while (to < r.lines.length - 1 && same(r.lines[to + 1])) to++;
        head = r.lines.slice(from, to + 1);
      }
      slides.push({
        number: n,
        title: head.map((l) => l.text).join(" "),
        body: r.lines.filter((l) => !head.includes(l)).map((l) => ({ level: 0, text: l.text })),
        tables: [],
        charts: [],
        media: [],
        notes: "",
      });
      if (r.png) fs.writeFileSync(path.join(ctx.slidesDir, `slide-${pad2(n)}.png`), Buffer.from(r.png, "base64"));
    }
  } finally {
    await close();
    fs.rmSync(html, { force: true });
  }
  // Portrait pages are a document (a guide, a manual), landscape ones a deck.
  const doc = size && size.height > size.width;
  return { kind: doc ? "PDF document" : "PDF", pages: doc, size, slides, media: [], slidesRel: render ? relTo(ctx, ctx.slidesDir) : undefined };
}

// ---------------------------------------------------------------------------
// An HTML deck (this engine's, or any page with <section>s)
function looksLikeDeck(file) {
  const html = fs.readFileSync(file, "utf8");
  return (
    /class\s*=\s*["'][^"']*\b(deck|reveal|slides)\b/.test(html) ||
    /<section\b[^>]*class\s*=\s*["'][^"']*\bslide\b/.test(html) ||
    (html.match(/<section\b/g) || []).length >= 3
  );
}

async function readHtmlDeck(file, render, ctx) {
  const { page, close } = await launch({ width: 1920, height: 1080 });
  const slides = [];
  const media = [];
  let shots = false;
  try {
    await page.goto(fileUrl(file, "?static"));
    await page.eval("new Promise((r) => setTimeout(r, 300))");
    const isDeck = await page.eval("!!(window.deck && deck.slides)");
    if (isDeck) await page.eval("deck.settled()");
    const count = await page.eval(`(window.__refSlides = window.deck ? deck.slides : [...document.querySelectorAll("section")]).length || 1`);
    if (render) fs.mkdirSync(ctx.slidesDir, { recursive: true });
    for (let i = 0; i < count; i++) {
      if (isDeck) await page.eval(`(async () => { deck.go(${i}, { instant: true }); await deck.settled(); })()`);
      // Read the slide while it's on screen (innerText follows the layout), with the speaker
      // notes, the footer line and the heading hidden.
      const s = await page.eval(`(() => {
        const s = window.__refSlides[${i}] || document.body;
        const h = s.querySelector("h1, h2, h3");
        const notes = s.querySelector(".notes, aside.notes");
        const css = document.createElement("style");
        css.textContent = "[data-ref-skip], .notes, aside.notes, .slide-chrome { display: none !important; }";
        document.head.append(css);
        if (h) h.setAttribute("data-ref-skip", "");
        const text = (s.innerText || "").split(/\\n+/).map((t) => t.trim()).filter(Boolean);
        if (h) h.removeAttribute("data-ref-skip");
        css.remove();
        const media = [...s.querySelectorAll("img[src], video[src], video source[src], audio[src]")].map((m) => m.getAttribute("src"));
        return { hidden: s.hasAttribute("data-hidden"), title: h ? h.innerText.replace(/\\s+/g, " ").trim() : "", body: text.map((t) => ({ level: 0, text: t })), notes: notes ? notes.textContent.trim() : "", media };
      })()`);
      const local = [];
      for (const m of s.media) {
        if (/^(https?:|data:|blob:)/i.test(m)) continue;
        const p = path.resolve(path.dirname(file), decodeURIComponent(m.split(/[?#]/)[0]));
        if (!fs.existsSync(p)) continue;
        const out = mediaPath(ctx, path.basename(p));
        if (!fs.existsSync(out)) fs.copyFileSync(p, out);
        const r = relTo(ctx, out);
        local.push(r);
        if (!media.some((x) => x.file === r)) media.push({ file: r, slides: [] });
        media.find((x) => x.file === r).slides.push(i + 1);
      }
      slides.push({ number: i + 1, hidden: s.hidden, title: s.title, body: s.body, tables: [], charts: [], media: local, notes: s.notes });
      if (render && isDeck) {
        await page.screenshot(path.join(ctx.slidesDir, `slide-${pad2(i + 1)}.png`));
        shots = true;
      }
    }
  } finally {
    await close();
  }
  return { kind: "HTML deck", size: { width: 13.333, height: 7.5 }, slides, media, slidesRel: shots ? relTo(ctx, ctx.slidesDir) : undefined };
}

// ---------------------------------------------------------------------------
// A web page or web app: a screenshot, and every button, link and field with its box in % of
// the screenshot, so hotspots can be placed exactly.
function pageInfo() {
  const vw = innerWidth;
  const vh = innerHeight;
  const pct = (v, of) => Math.round((v / of) * 1000) / 10;
  const SEL =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="option"], [onclick], [contenteditable="true"]';
  const listed = [];
  const elements = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (listed.some((p) => p.contains(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    // Skip what's covered (by a dialog, a cookie banner): the point at its center isn't it.
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    if (top && !el.contains(top) && !top.contains(el)) continue;
    const img = el.querySelector("img[alt]");
    const label = el.labels && el.labels[0] ? el.labels[0].innerText : "";
    const text = (
      el.getAttribute("aria-label") ||
      el.innerText ||
      label ||
      (el.tagName === "INPUT" && !/password|checkbox|radio/i.test(el.type) ? el.value : "") ||
      el.getAttribute("placeholder") ||
      el.getAttribute("title") ||
      (img && img.alt) ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const tag = el.tagName;
    const kind =
      el.getAttribute("role") ||
      (tag === "A" ? "link" : tag === "INPUT" ? `${el.type || "text"} field` : tag === "TEXTAREA" ? "text box" : tag === "SELECT" ? "menu" : "button");
    const x0 = Math.max(0, r.left);
    const y0 = Math.max(0, r.top);
    const x1 = Math.min(vw, r.right);
    const y1 = Math.min(vh, r.bottom);
    elements.push({ kind, text, href: el.href && !/^javascript:/i.test(el.href) ? el.href : undefined, x: pct(x0, vw), y: pct(y0, vh), w: pct(x1 - x0, vw), h: pct(y1 - y0, vh) });
    listed.push(el);
  }
  const lines = [];
  for (const t of (document.body.innerText || "").split(/\n+/)) {
    const s = t.replace(/\s+/g, " ").trim();
    if (s && !lines.includes(s)) lines.push(s);
  }
  return { title: document.title, url: location.href, width: vw, height: vh, elements, text: lines.join("\n").slice(0, 8000) };
}

async function readPage(target, ctx) {
  const dev = DEVICES[DEVICE];
  const url = isUrl(target) ? target : fileUrl(target);
  const { page, close } = await launch({ width: dev.w, height: dev.h });
  try {
    await page.send("Emulation.setDeviceMetricsOverride", { width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr, mobile: dev.mobile });
    if (dev.mobile) {
      await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await page.send("Emulation.setUserAgentOverride", { userAgent: dev.ua });
    }
    try {
      await page.goto(url);
    } catch (e) {
      throw new Error(`couldn't open ${url} (${e.message})`);
    }
    await page.eval(`new Promise((r) => setTimeout(r, ${WAIT})).then(() => document.fonts && document.fonts.ready)`);
    const info = await call(page, pageInfo);
    const out = mediaPath(ctx, "screen.png");
    await page.screenshot(out);
    const shot = { abs: out, file: relTo(ctx, out), w: dev.w * dev.dpr, h: dev.h * dev.dpr };
    ctx.screens.push(shot);
    const signIn = /sign in|log in|login|password/i.test(info.text.slice(0, 600)) && info.elements.some((e) => /password/i.test(e.kind));
    return { kind: "Web page", device: DEVICE, url: info.url, title: info.title, screens: [shot], elements: info.elements, text: info.text, signIn, errors: [...new Set(page.errors)].slice(0, 5) };
  } finally {
    await close();
  }
}

// ---------------------------------------------------------------------------
// Word documents (a user guide, a how-to, release notes)
function readDocx(file, ctx) {
  const z = openZip(file);
  const xml = z.text("word/document.xml");
  if (!xml) throw new Error("not a Word document (no word/document.xml)");
  const rels = new Map();
  for (const [tag] of (z.text("word/_rels/document.xml.rels") || "").matchAll(/<Relationship\b[^>]*>/g))
    rels.set(attr(tag, "Id"), { target: attr(tag, "Target") || "", external: attr(tag, "TargetMode") === "External" });
  const styleName = new Map();
  for (const [, body] of (z.text("word/styles.xml") || "").matchAll(/<w:style\b([\s\S]*?)<\/w:style>/g)) {
    const id = attr(body, "w:styleId");
    const nm = attr(body.match(/<w:name\b[^>]*>/)?.[0] || "", "w:val");
    if (id) styleName.set(id, (nm || id).toLowerCase());
  }
  const textOf = (x) =>
    unxml(
      [...x.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g)]
        .map((m) => (m[1] !== undefined ? m[1] : m[0] === "<w:tab/>" ? " " : "\n"))
        .join(""),
    )
      .replace(/[ \t]+/g, " ")
      .trim();
  const blocks = [];
  const saved = new Map();
  for (const [x] of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)) {
    if (x.startsWith("<w:tbl>")) {
      const rows = [...x.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map(([tr]) =>
        [...tr.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map(([tc]) =>
          [...tc.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
            .map(([p]) => textOf(p))
            .filter(Boolean)
            .join(" "),
        ),
      );
      if (rows.length) blocks.push({ type: "table", rows });
      continue;
    }
    for (const [, rid] of x.matchAll(/r:embed="([^"]+)"/g)) {
      const r = rels.get(rid);
      if (!r || r.external) continue;
      const part = path.posix.normalize(path.posix.join("word", r.target));
      if (!z.has(part)) continue;
      if (!saved.has(part)) {
        const out = mediaPath(ctx, path.posix.basename(part));
        fs.writeFileSync(out, z.read(part));
        const shot = { abs: out, file: relTo(ctx, out) };
        if (IMAGE.test(out)) ctx.screens.push(shot);
        saved.set(part, shot);
      }
      blocks.push({ type: "picture", file: saved.get(part).file });
    }
    const text = textOf(x);
    if (!text) continue;
    const sid = attr(x.match(/<w:pStyle\b[^>]*>/)?.[0] || "", "w:val");
    const style = styleName.get(sid) || (sid || "").toLowerCase();
    const heading = style.match(/^heading\s*(\d)/);
    if (style === "title") blocks.push({ type: "heading", level: 1, text });
    else if (heading) blocks.push({ type: "heading", level: Number(heading[1]), text });
    else if (/<w:numPr>/.test(x) || /^list/.test(style))
      blocks.push({ type: "item", level: Number(attr(x.match(/<w:ilvl\b[^>]*>/)?.[0] || "", "w:val") || 0), text });
    else blocks.push({ type: "text", text });
  }
  return { kind: "Word document", blocks, screens: [...saved.values()].filter((s) => IMAGE.test(s.abs)) };
}

// Markdown and plain text: copied in as they are (long files are cut).
function readText(file) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return { kind: /\.(md|markdown)$/i.test(file) ? "Markdown" : "Text", text: clip(text, 30000), length: text.length };
}

// ---------------------------------------------------------------------------
// Screenshots
function copyPicture(file, ctx, name = path.basename(file)) {
  const out = mediaPath(ctx, name.replace(/[^\w.-]+/g, "-"));
  if (path.resolve(file) !== path.resolve(out)) fs.copyFileSync(file, out);
  const shot = { abs: out, file: relTo(ctx, out), from: file };
  ctx.screens.push(shot);
  return shot;
}

// ---------------------------------------------------------------------------
// Screen recordings: each screen the video settles on. The video is served over a local
// address so the browser can decode it and read its frames.
function serve(file) {
  const size = fs.statSync(file).size;
  const type = /\.webm$/i.test(file) ? "video/webm" : /\.mkv$/i.test(file) ? "video/x-matroska" : "video/mp4";
  const server = http.createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end('<!doctype html><video muted playsinline preload="auto" src="/video" style="width:2px;height:2px"></video>');
      return;
    }
    if (req.url !== "/video") {
      res.writeHead(404);
      res.end();
      return;
    }
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (m) {
      let start = m[1] ? Number(m[1]) : size - Number(m[2]);
      let end = m[1] && m[2] ? Number(m[2]) : size - 1;
      start = Math.max(0, Math.min(start, size - 1));
      end = Math.min(end, size - 1);
      res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes" });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
      fs.createReadStream(file).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// In the page: step through the video and keep a frame each time the picture has settled on
// something new. A frame is settled when it barely differs from the one before it.
async function scanVideo(every, minChange) {
  const v = document.querySelector("video");
  if (v.readyState < 1)
    await new Promise((res, rej) => {
      v.addEventListener("loadedmetadata", res, { once: true });
      v.addEventListener("error", () => rej(new Error("the browser can't decode this video")), { once: true });
      setTimeout(() => rej(new Error("the video didn't load")), 30000);
    });
  const W = v.videoWidth;
  const H = v.videoHeight;
  const dur = v.duration;
  if (!W || !isFinite(dur)) throw new Error("the browser can't decode this video");
  const tw = 96;
  const th = Math.max(1, Math.round((tw * H) / W));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const g = c.getContext("2d", { willReadFrequently: true });
  const seek = (t) =>
    new Promise((res) => {
      const done = () => res();
      v.addEventListener("seeked", done, { once: true });
      setTimeout(done, 3000);
      v.currentTime = t;
    });
  const grab = () => {
    g.drawImage(v, 0, 0, tw, th);
    const d = g.getImageData(0, 0, tw, th).data;
    const out = new Uint8Array(tw * th);
    for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
    return out;
  };
  const changed = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) n++;
    return n / a.length;
  };
  const times = [];
  for (let t = 0; t < dur; t += every) times.push(Math.round(t * 1000) / 1000);
  times.push(Math.max(0, dur - 0.05));
  const kept = [];
  let prev = null;
  let last = null;
  for (const t of times) {
    await seek(t);
    const cur = grab();
    const still = !prev || changed(prev, cur) < 0.002;
    if (still && (!last || changed(last, cur) * 100 >= minChange)) {
      kept.push(t);
      last = cur;
    }
    prev = cur;
  }
  return { W, H, dur, kept };
}

async function frameAt(t) {
  const v = document.querySelector("video");
  await new Promise((res) => {
    v.addEventListener("seeked", res, { once: true });
    setTimeout(res, 3000);
    v.currentTime = t;
  });
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  return c.toDataURL("image/webp", 0.92).split(",")[1];
}

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function readVideo(file, ctx) {
  const attempt = async (src) => {
    const server = await serve(src);
    const { page, close } = await launch({ width: 800, height: 600 });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const scan = await call(page, scanVideo, EVERY, MIN_CHANGE);
      const screens = [];
      for (const [i, t] of scan.kept.entries()) {
        const out = mediaPath(ctx, `screen-${pad2(i + 1)}.webp`);
        fs.writeFileSync(out, Buffer.from(await call(page, frameAt, t), "base64"));
        const shot = { abs: out, file: relTo(ctx, out), w: scan.W, h: scan.H, t };
        ctx.screens.push(shot);
        screens.push(shot);
      }
      return { kind: "Screen recording", duration: scan.dur, width: scan.W, height: scan.H, every: EVERY, minChange: MIN_CHANGE, screens };
    } finally {
      await close();
      server.close();
    }
  };
  try {
    return await attempt(file);
  } catch (e) {
    // HEVC (iPhone) and other codecs Chrome can't play: convert with ffmpeg when it's there.
    if (!/decode|load/.test(e.message) || !hasFfmpeg()) {
      throw new Error(`${e.message}. Convert it to an H.264 .mp4 first (ffmpeg -i "${path.basename(file)}" -c:v libx264 -pix_fmt yuv420p out.mp4), or take screenshots instead`);
    }
    const tmp = path.join(os.tmpdir(), `html-slides-video-${process.pid}.mp4`);
    try {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", tmp], { stdio: "ignore", timeout: 1800000 });
      const ref = await attempt(tmp);
      ref.converted = true;
      return ref;
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// Sizes for every picture, and a copy with a percentage grid for each screen-sized one, so a
// hotspot's --x --y --w --h can be read off it.
function gridPage(src, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const k = Math.min(1, max.h / h, max.w / w);
      const W = Math.max(1, Math.round(w * k));
      const H = Math.max(1, Math.round(h * k));
      document.body.style.cssText = "margin:0;background:#fff";
      const wrap = document.createElement("div");
      wrap.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden`;
      img.style.cssText = "display:block;width:100%;height:100%";
      wrap.append(img);
      const add = (css, text) => {
        const d = document.createElement("div");
        d.style.cssText = "position:absolute;pointer-events:none;" + css;
        if (text) d.textContent = text;
        wrap.append(d);
      };
      for (let p = 5; p < 100; p += 5) {
        const major = p % 10 === 0;
        const line = major ? "rgba(255,0,170,0.9)" : "rgba(0,150,255,0.55)";
        const style = major ? "solid" : "dashed";
        add(`left:${p}%;top:0;bottom:0;border-left:1px ${style} ${line};box-shadow:0 0 0 0.5px rgba(255,255,255,0.6)`);
        add(`top:${p}%;left:0;right:0;border-top:1px ${style} ${line};box-shadow:0 0 0 0.5px rgba(255,255,255,0.6)`);
        if (!major) continue;
        const tag = "font:700 11px/1 system-ui,sans-serif;color:#fff;background:rgba(255,0,170,0.92);padding:2px 3px;border-radius:3px;";
        add(`${tag}left:${p}%;top:2px;transform:translateX(-50%)`, p);
        add(`${tag}left:${p}%;bottom:2px;transform:translateX(-50%)`, p);
        add(`${tag}top:${p}%;left:2px;transform:translateY(-50%)`, p);
        add(`${tag}top:${p}%;right:2px;transform:translateY(-50%)`, p);
      }
      document.body.append(wrap);
      resolve({ w, h, W, H });
    };
    img.onerror = () => reject(new Error("can't load the picture"));
    img.src = src;
  });
}

async function measureAndGrid(screens, ctx) {
  if (!screens.length) return;
  // A blank page of our own on file: so it may show the local pictures.
  const blank = path.join(os.tmpdir(), `html-slides-grid-${process.pid}.html`);
  fs.writeFileSync(blank, '<!doctype html><meta charset="utf-8"><body></body>');
  const { page, close } = await launch({ width: 800, height: 800 });
  try {
    for (const s of screens) {
      if (/\.svg$/i.test(s.abs)) continue;
      await page.goto(fileUrl(blank));
      let r;
      try {
        r = await call(page, gridPage, fileUrl(s.abs), { w: 1600, h: 1200 });
      } catch {
        s.unreadable = true;
        continue;
      }
      s.w ||= r.w;
      s.h ||= r.h;
      if (!GRID || Math.min(r.w, r.h) < 200) continue;
      await page.viewport(r.W, r.H);
      fs.mkdirSync(ctx.gridDir, { recursive: true });
      const out = path.join(ctx.gridDir, path.basename(s.abs).replace(/\.[^.]+$/, "") + ".png");
      await page.screenshot(out);
      s.grid = relTo(ctx, out);
    }
  } finally {
    await close();
    fs.rmSync(blank, { force: true });
  }
}

// ---------------------------------------------------------------------------
async function readFile(file, ctx) {
  const ext = path.extname(file).toLowerCase();
  if (DECKS.test(file)) {
    const ref = readPptx(file, ctx);
    if (RENDER) {
      ref.renderNote = renderPptx(file, ctx);
      if (!ref.renderNote) ref.slidesRel = relTo(ctx, ctx.slidesDir);
    }
    return ref;
  }
  if (ext === ".pdf") return readPdf(file, RENDER, ctx);
  if (ext === ".html" || ext === ".htm") return !opt.page && looksLikeDeck(file) ? readHtmlDeck(file, RENDER, ctx) : readPage(file, ctx);
  if (ext === ".docx") return readDocx(file, ctx);
  if (/\.(md|markdown|txt)$/i.test(file)) return readText(file);
  if (IMAGE.test(file)) return { kind: "Screenshots", screens: [copyPicture(file, ctx)] };
  if (VIDEO.test(file)) return readVideo(file, ctx);
  if (ext === ".key") throw new Error("Keynote files can't be read: in Keynote, File > Export To > PowerPoint (or PDF), then pass that");
  if (ext === ".ppt" || ext === ".doc") throw new Error(`old ${ext} files can't be read: save it as ${ext}x (or PDF) and pass that`);
  return null;
}

async function readFolder(dir, ctx) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(p);
    }
  };
  walk(dir);
  const parts = [];
  const skipped = [];
  const pictures = files.filter((f) => IMAGE.test(f));
  if (pictures.length)
    parts.push({ name: "Pictures", kind: "Screenshots", screens: pictures.map((f) => copyPicture(f, ctx, path.relative(dir, f).split(path.sep).join("-"))) });
  for (const f of files.filter((f) => !IMAGE.test(f))) {
    try {
      const part = await readFile(f, childOf(ctx, slugOf(f)));
      if (part) parts.push({ name: path.relative(dir, f), ...part });
      else skipped.push(path.relative(dir, f));
    } catch (e) {
      parts.push({ name: path.relative(dir, f), kind: "Unreadable", error: e.message });
    }
  }
  return { kind: "Folder", parts, skipped };
}

// ---------------------------------------------------------------------------
// reference.md
const GRID_HINT =
  "To put a hotspot over a button, read the button's left edge, top edge, width and height off its grid picture (lines every 10%, dashed every 5%) and use them as `--x`, `--y`, `--w`, `--h`. Then check with `check.mjs <deck> --hotspots`.";

function screenLine(s, i) {
  const bits = [`\`${s.file}\``];
  if (s.w) bits.push(`${s.w}×${s.h}`);
  if (s.t !== undefined) bits.push(`at ${clock(s.t)}`);
  if (s.grid) bits.push(`grid \`${s.grid}\``);
  if (s.unreadable) bits.push("(couldn't be read)");
  return `${i + 1}. ${bits.join(" · ")}`;
}

function writeMd(ref, md, depth) {
  const H = (n) => "#".repeat(Math.min(6, depth + n));
  const say = (...l) => md.push(...l);
  switch (ref.kind) {
    case "PowerPoint":
    case "PDF":
    case "PDF document":
    case "HTML deck": {
      const visible = ref.slides.filter((s) => !s.hidden).length;
      const unit = ref.pages ? "pages" : "slides";
      const ratio = ref.size && !ref.pages ? `, ${(ref.size.width / ref.size.height).toFixed(2)}:1 (${ref.size.width.toFixed(2)} x ${ref.size.height.toFixed(2)} in)` : "";
      say(`${ref.kind}: ${ref.slides.length} ${unit}${visible < ref.slides.length ? ` (${ref.slides.length - visible} hidden)` : ""}${ratio}.`);
      const sections = [...new Set(ref.slides.map((s) => s.section).filter(Boolean))];
      if (sections.length) say(`Sections: ${sections.join(" · ")}.`);
      if (ref.theme) {
        const c = ref.theme.colors;
        say(
          `Theme: ${ref.theme.dark ? "dark" : "light"} background; fonts ${ref.theme.fontHead || "?"} (headings) / ${ref.theme.fontBody || "?"} (body); ` +
            `accents ${["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"].map((k) => c[k]).filter(Boolean).join(" ")}; text ${c.dk1} on ${c.lt1}.`,
        );
      }
      if (ref.media.length) say(`Media: ${ref.media.length} files (${ref.media.filter((m) => m.slides.length).length} placed on slides).`);
      if (ref.slidesRel) say(`Pictures of each ${ref.pages ? "page" : "slide"}: ${ref.slidesRel}/slide-NN.png`);
      if (ref.renderNote) say(`No slide pictures: ${ref.renderNote}.`);
      say("");
      for (const s of ref.slides) {
        say(`${H(1)} ${ref.pages ? `Page ${s.number}` : `${s.number}.`} ${s.title || "(no title)"}${s.hidden ? " [hidden]" : ""}${s.layout ? `  · layout: ${s.layout}` : ""}${s.section ? `  · section: ${s.section}` : ""}`);
        let budget = ref.pages ? 4000 : 1500;
        for (const p of s.body) {
          if (budget <= 0) {
            say("- …");
            break;
          }
          const line = `${"  ".repeat(p.level)}- ${clip(p.text.replace(/\n/g, " / "), 300)}`;
          budget -= line.length;
          say(line);
        }
        for (const t of s.tables) {
          say("", ...t.slice(0, 12).map((row, i) => `| ${row.map((c) => clip(c, 60)).join(" | ")} |${i === 0 ? "\n|" + row.map(() => " --- |").join("") : ""}`));
          if (t.length > 12) say(`(${t.length - 12} more rows)`);
        }
        for (const c of s.charts) say(`Chart: ${c.kinds.join(" + ") || "?"}${c.series.length ? ` (series: ${c.series.join(", ")})` : ""}`);
        if (s.media.length) say(`Media: ${s.media.join(", ")}`);
        if (s.notes) say(`Notes: ${clip(s.notes.replace(/\s*\n\s*/g, " "), 800)}`);
        say("");
      }
      break;
    }
    case "Word document": {
      const heads = ref.blocks.filter((b) => b.type === "heading").length;
      say(`Word document: ${heads} heading${heads === 1 ? "" : "s"}, ${ref.screens.length} picture${ref.screens.length === 1 ? "" : "s"}.`, "");
      for (const b of ref.blocks) {
        if (b.type === "heading") say("", `${H(b.level)} ${b.text}`);
        else if (b.type === "item") say(`${"  ".repeat(b.level)}- ${b.text.replace(/\n/g, " / ")}`);
        else if (b.type === "picture") say(`Picture: \`${b.file}\``);
        else if (b.type === "table") {
          say("", ...b.rows.slice(0, 20).map((row, i) => `| ${row.map((c) => clip(c, 80)).join(" | ")} |${i === 0 ? "\n|" + row.map(() => " --- |").join("") : ""}`), "");
          if (b.rows.length > 20) say(`(${b.rows.length - 20} more rows)`);
        } else say(b.text);
      }
      if (ref.screens.length) say("", `${H(1)} Pictures`, "", GRID_HINT, "", ...ref.screens.map(screenLine));
      say("");
      break;
    }
    case "Markdown":
    case "Text":
      say(`${ref.kind}: ${ref.length} characters${ref.length > ref.text.length ? " (cut to the first 30,000)" : ""}.`, "");
      say(ref.kind === "Markdown" ? ref.text.replace(/^(#{1,5}) /gm, (m, h) => `${"#".repeat(Math.min(6, h.length + depth))} `) : ref.text, "");
      break;
    case "Screenshots":
      say(`${ref.screens.length} picture${ref.screens.length === 1 ? "" : "s"}. ${GRID_HINT}`, "", ...ref.screens.map(screenLine), "");
      break;
    case "Screen recording":
      say(
        `Screen recording: ${clock(ref.duration)} long, ${ref.width}×${ref.height}${ref.converted ? " (converted to H.264 to read it)" : ""}. ` +
          `${ref.screens.length} distinct screens (looked every ${ref.every}s; a screen counts as new when ${ref.minChange}% of it changed and it stopped moving). ` +
          `Missing a step? Run again with --min-change 1 or a smaller --every; too many near-duplicates, raise --min-change.`,
        "",
        GRID_HINT,
        "",
        ...ref.screens.map(screenLine),
        "",
      );
      break;
    case "Web page": {
      const s = ref.screens[0];
      say(`Web page: ${ref.url}${ref.title ? ` ("${ref.title}")` : ""}, at ${ref.device} size.`);
      say(`Screenshot: \`${s.file}\` (${s.w}×${s.h})${s.grid ? ` · grid \`${s.grid}\`` : ""}`);
      if (ref.signIn) say("This looks like a sign-in page: the reader can't sign in. Ask the user for screenshots or a screen recording of the screens behind it.");
      if (ref.errors.length) say(`Page errors: ${ref.errors.join(" | ")}`);
      say("", `${H(1)} Buttons, links and fields`, "", "Boxes are % of the screenshot: use them as the hotspot's `--x`, `--y`, `--w`, `--h`.", "");
      if (ref.elements.length) {
        say("| # | Kind | Text | --x | --y | --w | --h | Goes to |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
        ref.elements.forEach((e, i) =>
          say(`| ${i + 1} | ${e.kind} | ${clip(e.text, 50).replace(/\|/g, "/") || "(no text)"} | ${e.x}% | ${e.y}% | ${e.w}% | ${e.h}% | ${e.href ? clip(e.href, 80) : ""} |`),
        );
      } else say("(none found on the visible part of the page)");
      say("", `${H(1)} Text on the page`, "", ref.text || "(none)", "");
      break;
    }
    case "Folder":
      say(`Folder: ${ref.parts.length} part${ref.parts.length === 1 ? "" : "s"}${ref.skipped.length ? `; skipped ${ref.skipped.join(", ")}` : ""}.`, "");
      for (const p of ref.parts) {
        say(`${H(1)} ${p.name} (${p.kind})`, "");
        writeMd(p, md, depth + 1);
      }
      break;
    case "Unreadable":
      say(`Couldn't read it: ${ref.error}`, "");
      break;
  }
}

// ---------------------------------------------------------------------------
// Loose screenshots given together are one source.
const pictures = given.filter((s) => !isUrl(s) && fs.statSync(s).isFile() && IMAGE.test(s));
const sources = given.filter((s) => !pictures.includes(s) || pictures.length === 1);
if (pictures.length > 1) sources.push({ pictures, name: path.basename(path.dirname(pictures[0])) || "screenshots" });

let failures = 0;
for (const src of sources) {
  const label = typeof src === "string" ? (isUrl(src) ? src : path.basename(src)) : `${src.pictures.length} pictures`;
  const slug = typeof src === "string" ? slugOf(src) : slugOf(src.name);
  const ctx = placeFor(slug);
  fs.mkdirSync(ctx.outDir, { recursive: true });
  let ref;
  try {
    if (typeof src !== "string") ref = { kind: "Screenshots", screens: src.pictures.map((f) => copyPicture(f, ctx)) };
    else if (isUrl(src)) ref = await readPage(src, ctx);
    else if (fs.statSync(src).isDirectory()) ref = await readFolder(src, ctx);
    else {
      ref = await readFile(src, ctx);
      if (!ref) throw new Error("don't know how to read this kind of file (see the list at the top of reference.mjs)");
    }
    await measureAndGrid(ctx.screens, ctx);
  } catch (e) {
    console.log(`Couldn't read ${label}: ${e.message}`);
    failures++;
    continue;
  }
  const md =[`# Source: ${typeof src === "string" ? src : src.pictures.map((p) => path.basename(p)).join(", ")}`, ""];
  writeMd(ref, md, 1);
  fs.writeFileSync(path.join(ctx.outDir, "reference.md"), md.join("\n").replace(/\n{3,}/g, "\n\n") + "\n");
  const plain = JSON.parse(JSON.stringify(ref, (k, v) => (k === "abs" ? undefined : v)));
  fs.writeFileSync(path.join(ctx.outDir, "reference.json"), JSON.stringify(plain, null, 2) + "\n");
  const brand = ref.brand || (ref.parts || []).find((p) => p.brand)?.brand;
  if (brand) {
    const b = Object.fromEntries(Object.entries(brand).filter(([, v]) => v !== undefined && v !== null));
    fs.writeFileSync(path.join(ctx.outDir, "brand.json"), JSON.stringify(b, null, 2) + "\n");
  }
  const what = ref.slides
    ? `${ref.slides.length} ${ref.pages ? "pages" : "slides"}`
    : ref.kind === "Folder"
      ? `${ref.parts.length} parts`
      : ref.blocks
        ? `${ref.blocks.length} paragraphs`
        : ref.text && !ref.screens
          ? `${ref.length} characters`
          : "";
  const screens = ctx.screens.length ? `${ctx.screens.length} picture${ctx.screens.length === 1 ? "" : "s"}` : "";
  console.log(`Read ${label}: ${[ref.kind, what, screens].filter(Boolean).join(", ")}.`);
  console.log(`  Outline: ${path.join(ctx.outDir, "reference.md")}`);
  if (ctx.screens.length) console.log(`  Pictures: ${ctx.mediaDir}${path.sep}${ctx.screens.some((s) => s.grid) ? `  (grids in ${ctx.gridDir}${path.sep})` : ""}`);
  if (brand) console.log(`  Brand: ${path.join(ctx.outDir, "brand.json")} (use with new-deck.mjs --brand)`);
  if (ref.slidesRel) console.log(`  Slide pictures: ${path.join(ctx.base, ref.slidesRel)}${path.sep}`);
  if (ref.renderNote) console.log(`  No slide pictures: ${ref.renderNote}.`);
}
process.exit(failures ? 1 : 0);
