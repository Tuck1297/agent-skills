#!/usr/bin/env node
// Exports a deck to PowerPoint (.pptx), each slide as it looks at its last build.
//
//   node export-pptx.mjs <deck folder or deck.html> [--out file.pptx]
//        [--fonts embed|keep|office] [--flatten] [--scale 1|1.5|2] [--no-builds] [--preview]
//
// Text stays editable: every heading, paragraph, bullet, label and table cell becomes a
// PowerPoint text box with the deck's font, size, color and line breaks. Charts made with
// data-chart become native PowerPoint charts. Everything else (backgrounds, shapes, icons,
// app mockups, diagrams, photos) becomes pictures. Speaker notes go to the notes pane.
// Builds (data-step, data-exit) become click animations, data-morph becomes Morph, each
// slide gets the nearest PowerPoint transition, hidden slides stay hidden, and section
// slides start PowerPoint sections. Interactive slides are exported in the state they open
// in. The data list is already filled in.
//
// --fonts embed    (default) put the deck's Google Fonts inside the .pptx, each weight under
//                  the name Office gives it ("Sora", "Sora ExtraBold"), with the browser's
//                  kerning folded into letter spacing so lines break in the same places.
// --fonts keep     name the fonts but don't embed them (smaller file; install them where
//                  the deck is presented).
// --fonts office   swap the deck's fonts for ones every Office install has (Calibri,
//                  Georgia, Consolas). Text reflows a little.
// --flatten        leave the text in the pictures: looks exactly like the HTML on any
//                  computer, but the text can't be edited in PowerPoint.
// --scale 1.5      sharper pictures (bigger file). Default 1 (1920x1080).
// --preview        Windows with PowerPoint: render the .pptx back and save HTML | PowerPoint
//                  comparison sheets in .check/pptx/compare-N.png.
// Output: <deck folder>/dist/<title>.pptx (unless --out).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { args, deckFile, folderName, usage } from "./lib/engine.mjs";
import { buildDeckIcons, loadDeps } from "./lib/icons.mjs";
import { fileUrl, launch } from "./lib/browser.mjs";
import { patchSlide, shapeIds, timingXml, transitionXml } from "./lib/pptx-xml.mjs";
import { createFonts, embedFonts } from "./lib/pptx-fonts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const opt = args(process.argv.slice(2));
const file = deckFile(opt._[0]);
if (!file || !fs.existsSync(file)) {
  console.log(usage(fileURLToPath(import.meta.url), 28));
  process.exit(1);
}
const deckDir = path.dirname(file);
const scale = Math.min(3, Math.max(1, parseFloat(opt.scale) || 1));
const fontsMode = ["office", "keep"].includes(opt.fonts) ? opt.fonts : "embed";

const req = loadDeps({ versions: { pptxgenjs: "4.0.1" }, size: "about 5 MB" });
const PptxGenJS = req("pptxgenjs");
const JSZip = req("jszip");

try {
  buildDeckIcons(file, { log: (m) => console.error(m) });
} catch (e) {
  console.error(`Icons: could not build engine/icons.js (${e.message})`);
}

// ---------------------------------------------------------------------------
// 1. Read every slide in the browser
const W = 1920;
const H = 1080;
const { page, close } = await launch({ width: W, height: H });
page.dpr = scale;
await page.viewport(W, H);
const plans = [];
let info;
try {
  await page.goto(fileUrl(file, "?static"));
  if (!(await page.eval("!!window.deck"))) throw new Error("window.deck is missing: engine/deck.js did not run");
  await page.eval("deck.settled()");
  await page.eval(fs.readFileSync(path.join(here, "lib", "pptx-page.js"), "utf8"));
  info = await page.eval(`(() => {
    const cs = getComputedStyle(document.documentElement);
    const audit = deck.audit();
    return {
      title: document.title,
      motion: document.documentElement.getAttribute("data-motion") || "moderate",
      fontHead: cs.getPropertyValue("--font-head"),
      fontBody: cs.getPropertyValue("--font-body"),
      ids: deck.slides.map((s) => s.id || ""),
      transitions: audit.slides.map((s) => s.transition || "none"),
      // The theme's colors as hex, for the PowerPoint theme.
      palette: (() => {
        const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
        const hex = (name) => {
          const v = cs.getPropertyValue(name).trim();
          if (!v) return null;
          c.clearRect(0, 0, 1, 1);
          c.fillStyle = "#000";
          c.fillStyle = v;
          c.fillRect(0, 0, 1, 1);
          const d = c.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
        };
        const names = ["bg", "bg-2", "ink", "ink-2", "accent", "accent-2", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"];
        return Object.fromEntries(names.map((n) => [n, hex("--" + n)]));
      })(),
    };
  })()`);
  for (let i = 0; i < info.ids.length; i++) {
    await page.eval(`(async () => { deck.go(${i}, { instant: true }); await deck.settled(); await document.fonts.ready; })()`);
    const plan = await page.eval(`__pptx.analyze({ text: ${!opt.flatten} })`);
    if (opt.preview) plan.html = await page.shot(); // the browser's version, every build shown
    await page.eval("__pptx.pinIconColors(); __pptx.mode('background')");
    plan.background = await page.shot();
    for (const L of plan.layers) {
      if (!L.paints) continue;
      const r = await page.eval(`__pptx.mode("layer", ${L.id})`);
      const pad = 24; // shadows and outlines
      const x = Math.max(0, Math.floor(r.x - pad));
      const y = Math.max(0, Math.floor(r.y - pad));
      const clip = {
        x,
        y,
        width: Math.min(W, Math.ceil(r.x + r.w + pad)) - x,
        height: Math.min(H, Math.ceil(r.y + r.h + pad)) - y,
      };
      if (clip.width < 2 || clip.height < 2) continue;
      L.png = await page.shot({ clip, transparent: true });
      L.clip = { x: clip.x, y: clip.y, w: clip.width, h: clip.height };
      await page.eval("__pptx.mode('background')");
    }
    await page.eval("__pptx.mode(null); __pptx.clearMarks()");
    plan.transition = info.transitions[i];
    plans.push(plan);
    // A live counter in a terminal; piped output (an agent, a log) only gets the total.
    if (process.stderr.isTTY) process.stderr.write(`\rRead slide ${i + 1} of ${info.ids.length}`);
  }
  process.stderr.write(process.stderr.isTTY ? "\n" : `Read ${info.ids.length} slides.\n`);
} finally {
  await close();
}

// ---------------------------------------------------------------------------
// 2. Build the presentation
const inch = (v) => Math.round((v / 144) * 10000) / 10000;
const firstFamily = (list) => (list.split(",")[0] || "").trim().replace(/^["']|["']$/g, "");
const OFFICE_FONTS = new Set(
  "Calibri,Calibri Light,Cambria,Candara,Consolas,Constantia,Corbel,Arial,Arial Black,Segoe UI,Segoe UI Semibold,Georgia,Times New Roman,Verdana,Tahoma,Trebuchet MS,Garamond,Century Gothic,Courier New,Aptos,Aptos Display,Franklin Gothic Medium,Gill Sans MT,Lucida Console,Palatino Linotype,Book Antiqua,Impact"
    .split(",")
    .map((f) => f.toLowerCase()),
);
const officeFor = (generic) => (generic === "serif" ? "Georgia" : generic === "mono" ? "Consolas" : "Calibri");
const isOffice = (f) => OFFICE_FONTS.has(String(f).toLowerCase());
const fonts = createFonts({ log: (m) => console.log(m) });
if (fontsMode === "embed")
  for (const plan of plans) {
    for (const t of plan.texts) for (const line of t.lines) for (const r of line) if (!isOffice(r.st.font)) fonts.use(r.st.font, r.st.weight, r.st.italic);
    for (const c of plan.charts) if (c.spec.font && !isOffice(c.spec.font)) fonts.use(c.spec.font, 400, false);
  }
await fonts.prepare();
// Letter spacing in points, plus the browser's kerning (PowerPoint doesn't kern web fonts),
// unless the font is swapped for an Office one.
function spacingOf(r) {
  const px = r.st.spacing + (fontsMode === "office" ? 0 : r.kern || 0);
  const pt = Math.round(px * 0.5 * 100) / 100;
  return pt || undefined;
}
// The font name, bold and italic to write on a run.
// Windows fonts that Office lists under a separate name for some weights.
const SYSTEM_WEIGHTS = {
  "segoe ui": { 200: "Segoe UI Light", 300: "Segoe UI Light", 350: "Segoe UI Semilight", 600: "Segoe UI Semibold", 800: "Segoe UI Black", 900: "Segoe UI Black" },
  arial: { 800: "Arial Black", 900: "Arial Black" },
  bahnschrift: { 300: "Bahnschrift Light", 350: "Bahnschrift SemiLight", 600: "Bahnschrift SemiBold" },
};
function faceOf(st) {
  const f = st.font || officeFor(st.generic);
  if (fontsMode === "office" && !isOffice(f)) return { name: officeFor(st.generic), bold: st.bold, italic: st.italic };
  const embedded = fonts.faceFor(f, st.weight, st.italic);
  if (embedded) return embedded;
  const named = SYSTEM_WEIGHTS[f.toLowerCase()]?.[st.weight];
  if (named) return { name: named, bold: false, italic: st.italic };
  return { name: f, bold: st.bold, italic: st.italic };
}
const usedFonts = new Set();

function slideFor(target) {
  const t = String(target).trim().replace(/^#\/?/, "");
  if (/^\d+$/.test(t)) return Number(t);
  const i = info.ids.indexOf(t);
  return i >= 0 ? i + 1 : undefined;
}

function formatCode(kind, arg) {
  const parts = String(arg ?? "").split(/[:,\s]+/).filter(Boolean);
  const decPart = parts.find((p) => /^\d+$/.test(p));
  const dec = decPart === undefined ? 0 : Number(decPart);
  const d = dec > 0 ? "." + "0".repeat(dec) : "";
  if (kind === "percent") return `#,##0${d}"%"`;
  if (kind === "compact") return '[>=1000000]#,##0.0,,"M";[>=1000]#,##0.0,"K";#,##0';
  if (kind === "money") {
    const cur = (parts.find((p) => /^[A-Za-z]{3}$/.test(p)) || "USD").toUpperCase();
    let sym = "$";
    try {
      sym = new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).formatToParts(1).find((p) => p.type === "currency").value;
    } catch {}
    return `"${sym}"#,##0${d}`;
  }
  return `#,##0${d}`;
}

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.title = info.title;
const themeFace = (list, weight) => {
  const f = firstFamily(list);
  return f ? faceOf({ font: f, weight, italic: false, bold: weight >= 600 }).name : "Calibri";
};
pres.theme = { headFontFace: themeFace(info.fontHead, 400), bodyFontFace: themeFace(info.fontBody, 400) };
if (fontsMode === "office") pres.theme = { headFontFace: "Calibri", bodyFontFace: "Calibri" };

const CHART_TYPES = { bar: "bar", hbar: "bar", line: "line", area: "area", pie: "pie", donut: "doughnut" };
let section = info.title || "Slides";
pres.addSection({ title: section });
const counts = { text: 0, pictures: 0, charts: 0, animations: 0 };
const names = []; // per slide: { clicks: Map(step -> [{name, exit, text}]) }

plans.forEach((plan, si) => {
  if (plan.layout === "layout-section" && si > 0) {
    section = plan.title || `Section ${si + 1}`;
    pres.addSection({ title: section });
  }
  const slide = pres.addSlide({ sectionTitle: section });
  slide.background = { data: "image/png;base64," + plan.background.toString("base64") };
  if (plan.notes) slide.addNotes(plan.notes);

  const layers = plan.layers;
  const effStep = (L) => (L.step !== undefined ? L.step : L.parent >= 0 ? effStep(layers[L.parent]) : undefined);
  const effExit = (L) => (L.exit !== undefined ? L.exit : L.parent >= 0 ? effExit(layers[L.parent]) : undefined);
  const morphOf = (L) => (L.morph ? L.morph : L.parent >= 0 ? morphOf(layers[L.parent]) : undefined);
  const anim = new Map();
  const join = (layerId, name, text) => {
    if (opt["no-builds"] || layerId < 0) return;
    const L = layers[layerId];
    const s = effStep(L);
    const e = effExit(L);
    if (s !== undefined) (anim.get(s) || anim.set(s, []).get(s)).push({ name, exit: false, text });
    if (e !== undefined) (anim.get(e) || anim.set(e, []).get(e)).push({ name, exit: true, text });
  };

  // Pictures for builds and morphs
  for (const L of layers) {
    if (!L.png) continue;
    const name = L.morph ? "!!" + L.morph : `pic ${si + 1}.${L.id}`;
    slide.addImage({
      data: "image/png;base64," + L.png.toString("base64"),
      x: inch(L.clip.x),
      y: inch(L.clip.y),
      w: inch(L.clip.w),
      h: inch(L.clip.h),
      objectName: name,
    });
    counts.pictures++;
    join(L.id, name, false);
  }

  // Native charts
  plan.charts.forEach((c, ci) => {
    const s = c.spec;
    const type = CHART_TYPES[s.type];
    const name = `chart ${si + 1}.${ci}`;
    const pie = type === "pie" || type === "doughnut";
    const single = s.series.length === 1;
    let colors = s.series.map((x) => x.color);
    if (pie) colors = s.labels.map((_, i) => s.palette[i % s.palette.length]);
    else if (single && type === "bar" && s.highlight !== null)
      colors = s.labels.map((_, i) => (i === s.highlight ? s.series[0].color : s.muted || "BBBBBB"));
    const font = s.font ? faceOf({ font: s.font, weight: 400, italic: false, bold: false }).name : "Calibri";
    const size = Math.round(s.fontSize * 0.5 * 0.85);
    const code = formatCode(s.format, s.formatArg);
    const series = () => s.series.map((x) => ({ name: x.name || " ", labels: [...s.labels], values: [...x.values] }));
    const data = series();
    // A PowerPoint area has no outline; the deck's single-series area chart has a line and
    // dots on top, so draw it as area + line.
    const what =
      type === "area" && single
        ? [
            { type: "area", data, options: { chartColors: colors, chartColorsOpacity: 30 } },
            { type: "line", data: series(), options: { chartColors: colors, lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 9 } },
          ]
        : type;
    slide.addChart(
      what,
      Array.isArray(what) ? undefined : data,
      {
        x: inch(c.frame.x),
        y: inch(c.frame.y),
        w: inch(c.frame.w),
        h: inch(c.frame.h),
        objectName: name,
        barDir: s.type === "hbar" ? "bar" : "col",
        barGapWidthPct: 60,
        chartColors: colors,
        chartColorsOpacity: type === "area" ? 40 : undefined,
        holeSize: 62,
        lineSize: 3,
        lineDataSymbol: "circle",
        lineDataSymbolSize: 9,
        showLegend: pie || !single,
        legendPos: pie ? "r" : "b",
        legendFontFace: font,
        legendFontSize: size,
        legendColor: s.ink2 || s.ink,
        showValue: s.showValues && (type === "bar" || pie),
        showPercent: false,
        dataLabelFormatCode: code,
        // outEnd is only valid on bars; PowerPoint refuses the file for it on a line or area
        dataLabelPosition: pie ? "bestFit" : type === "bar" ? "outEnd" : undefined,
        dataLabelColor: pie ? "FFFFFF" : s.ink,
        dataLabelFontFace: font,
        dataLabelFontSize: size,
        catAxisLabelColor: s.ink2 || s.ink,
        valAxisLabelColor: s.ink2 || s.ink,
        catAxisLabelFontFace: font,
        valAxisLabelFontFace: font,
        catAxisLabelFontSize: size,
        valAxisLabelFontSize: size,
        valAxisLabelFormatCode: code,
        // The deck's bar charts have no grid or value scale, only a baseline under the
        // categories; its line and area charts have a grid with values.
        valGridLine: type === "bar" ? { style: "none" } : { color: s.line || "DDDDDD", size: 1 },
        valAxisHidden: type === "bar",
        catGridLine: { style: "none" },
        catAxisLineShow: type === "bar",
        catAxisLineColor: s.axis || s.line || "999999",
        catAxisLineSize: 1.5,
        catAxisMajorTickMark: "none",
        valAxisLineShow: false,
      },
    );
    counts.charts++;
    join(c.layer, name, false);
  });

  // Links to other slides that are on the slide from the start become clickable areas (added
  // last, on top); their text then isn't a hyperlink, so PowerPoint doesn't underline it.
  const areaLinks = (plan.links || []).filter((l) => l.layer < 0 && slideFor(l.goto));
  const byArea = new Set(areaLinks.map((l) => l.goto));

  // Editable text
  const perLayer = new Map();
  for (const t of plan.texts) {
    const runs = [];
    t.lines.forEach((line, li) => {
      if (!line.length) line = [{ text: " ", st: (t.lines.find((l) => l.length) || [{}])[0].st }];
      line.forEach((r, ri) => {
        const st = r.st;
        const face = faceOf(st);
        usedFonts.add(face.name);
        const link = st.href ? { url: st.href } : st.goto && !byArea.has(st.goto) && slideFor(st.goto) ? { slide: slideFor(st.goto) } : undefined;
        runs.push({
          text: r.text,
          options: {
            fontFace: face.name,
            fontSize: Math.round(st.size * 0.5 * 100) / 100,
            color: st.color,
            bold: face.bold,
            italic: face.italic,
            underline: st.underline ? { style: "sng" } : undefined,
            strike: st.strike ? "sngStrike" : undefined,
            charSpacing: spacingOf(r),
            transparency: st.alpha < 0.98 ? Math.round((1 - st.alpha) * 100) : undefined,
            superscript: st.valign === "super" || undefined,
            subscript: st.valign === "sub" || undefined,
            hyperlink: link,
            softBreakBefore: li > 0 && ri === 0 ? true : undefined,
          },
        });
      });
    });
    const f = t.frame;
    const extra = Math.max(10, f.w * 0.05);
    let x = f.x;
    if (t.align === "center") x -= extra / 2;
    else if (t.align === "right") x -= extra;
    // With exact line spacing PowerPoint puts the first baseline 0.75 of a line below the
    // top of the box (any font, any size), so place the box from the browser's baseline.
    const top = t.baseline != null ? t.baseline - 0.75 * t.lineHeight : f.y;
    let name = `text ${si + 1}.${t.id}`;
    if (t.layer >= 0) {
      const m = morphOf(layers[t.layer]);
      if (m) {
        const n = perLayer.get(t.layer) || 0;
        perLayer.set(t.layer, n + 1);
        name = `!!${m}~${n}`;
      }
    }
    slide.addText(runs, {
      x: inch(x),
      y: inch(top),
      w: inch(f.w + extra),
      h: inch(Math.max(f.h, t.lineHeight * t.lines.length)),
      margin: 0,
      valign: "top",
      align: ["left", "center", "right", "justify"].includes(t.align) ? t.align : "left",
      lineSpacing: Math.round(t.lineHeight * 0.5 * 100) / 100,
      paraSpaceBefore: 0,
      paraSpaceAfter: 0,
      wrap: false, // the browser's line breaks are already in the text
      fit: "none",
      isTextBox: true,
      rotate: t.angle ? Math.round(t.angle * 10) / 10 : undefined,
      objectName: name,
    });
    counts.text++;
    join(t.layer, name, true);
  }
  for (const l of areaLinks) {
    const target = slideFor(l.goto);
    slide.addShape(pres.shapes.RECTANGLE, {
      x: inch(l.frame.x),
      y: inch(l.frame.y),
      w: inch(l.frame.w),
      h: inch(l.frame.h),
      fill: { color: "FFFFFF", transparency: 100 }, // clear, but still takes the click
      line: { type: "none" },
      hyperlink: { slide: target, tooltip: l.label || `Slide ${target}` },
      objectName: `link to slide ${target}`,
    });
    counts.links = (counts.links || 0) + 1;
  }
  names.push(anim);
});

// ---------------------------------------------------------------------------
// 3. Transitions, animations, hidden slides
const raw = await pres.write({ outputType: "nodebuffer" });
const zip = await JSZip.loadAsync(raw);
for (let i = 0; i < plans.length; i++) {
  const p = `ppt/slides/slide${i + 1}.xml`;
  const entry = zip.file(p);
  if (!entry) continue;
  let xml = await entry.async("string");
  const ids = shapeIds(xml);
  const clicks = [...names[i].entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, shapes]) =>
      shapes
        .map((s) => ({ spid: ids.get(s.name), exit: s.exit, text: s.text }))
        .filter((s) => s.spid)
        .sort((a, b) => a.exit - b.exit),
    )
    .filter((c) => c.length);
  counts.animations += clicks.length;
  let kind = i === 0 ? "none" : plans[i].transition;
  if (info.motion === "none") kind = "none";
  else if (info.motion === "subtle" && kind !== "none") kind = "fade";
  xml = patchSlide(xml, { transition: transitionXml(kind), timing: timingXml(clicks), hidden: plans[i].hidden });
  // pptxgenjs turns kerning on with letter spacing; the spacing already holds the browser's kerning.
  if (fontsMode !== "office") xml = xml.replace(/ kern="0"/g, "");
  zip.file(p, xml);
}
// The deck's colors become the PowerPoint theme, so shapes and text added in PowerPoint match
// (and a dark deck gets light text on a dark background by default).
{
  const p = info.palette;
  const lum = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  if (p.bg && p.ink) {
    const dark = lum(p.bg) < lum(p.ink);
    const [dk1, lt1] = dark ? [p.bg, p.ink] : [p.ink, p.bg];
    const [dk2, lt2] = dark ? [p["bg-2"] || p.bg, p["ink-2"] || p.ink] : [p["ink-2"] || p.ink, p["bg-2"] || p.bg];
    const accents = [...new Set([p.accent, p["accent-2"], ...[1, 2, 3, 4, 5, 6].map((n) => p["chart-" + n])].filter(Boolean))].slice(0, 6);
    while (accents.length < 6) accents.push(accents[accents.length - 1] || "4472C4");
    const clr = (tag, v) => `<a:${tag}><a:srgbClr val="${v}"/></a:${tag}>`;
    const name = (info.title || "Deck").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const scheme =
      `<a:clrScheme name="${name}">` +
      clr("dk1", dk1) +
      clr("lt1", lt1) +
      clr("dk2", dk2) +
      clr("lt2", lt2) +
      accents.map((a, i) => clr(`accent${i + 1}`, a)).join("") +
      clr("hlink", p.accent || accents[0]) +
      clr("folHlink", p["accent-2"] || accents[1]) +
      "</a:clrScheme>";
    for (const n of Object.keys(zip.files).filter((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n)))
      zip.file(n, (await zip.file(n).async("string")).replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme));
    if (dark)
      for (const n of Object.keys(zip.files).filter((n) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(n)))
        zip.file(
          n,
          (await zip.file(n).async("string")).replace(/<p:clrMap\b[^>]*\/>/, () => '<p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'),
        );
  }
}
const embeddedCount = fontsMode === "embed" ? await embedFonts(zip, fonts.embedded()) : 0;
const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outFile =
  typeof opt.out === "string" ? path.resolve(opt.out) : path.join(deckDir, "dist", `${folderName(info.title || path.basename(deckDir))}.pptx`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, out);

const mb = (out.length / 1048576).toFixed(1);
console.log(`Wrote ${outFile} (${mb} MB): ${plans.length} slides, ${counts.text} text boxes, ${counts.charts} native charts, ${counts.pictures} build/morph pictures, ${counts.animations} click builds${counts.links ? `, ${counts.links} slide links` : ""}.`);
const embeddedNames = new Set(fonts.embedded().keys());
if (embeddedCount) console.log(`Embedded fonts: ${[...embeddedNames].join(", ")}.`);
const missing = [...usedFonts].filter((f) => !isOffice(f) && !embeddedNames.has(f));
if (missing.length && fontsMode !== "office")
  console.log(`Fonts to install where it's presented: ${missing.join(", ")}. Or export with --fonts office.`);

// ---------------------------------------------------------------------------
// 4. Optional: render the .pptx with PowerPoint to check it
if (opt.preview) {
  const dir = path.join(deckDir, ".check", "pptx");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  if (process.platform !== "win32") {
    console.log("--preview needs Windows with PowerPoint; open the .pptx and look instead.");
  } else {
    plans.forEach((p, i) => p.html && fs.writeFileSync(path.join(dir, `html-${String(i + 1).padStart(2, "0")}.png`), p.html));
    const q = (s) => `'${s.replace(/'/g, "''")}'`;
    const fontNames = [...usedFonts].filter((f) => !isOffice(f));
    const ps = path.join(os.tmpdir(), `html-slides-preview-${process.pid}.ps1`);
    // PowerPoint is one process per user: if it was already open (maybe with the user's own
    // decks), close only this file and leave PowerPoint running.
    fs.writeFileSync(
      ps,
      String.raw`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$have = @{}
foreach ($f in (New-Object System.Drawing.Text.InstalledFontCollection).Families) { $have[$f.Name] = 1 }
$cloud = Join-Path $env:LOCALAPPDATA 'Microsoft\FontCache\4\CloudFonts'
if (Test-Path $cloud) { foreach ($d in Get-ChildItem $cloud -Directory) { $have[$d.Name] = 1 } }
'NOT-INSTALLED:' + ((@(${fontNames.map(q).join(", ") || "''"}) | Where-Object { $_ -and -not $have[$_] }) -join '|')
$running = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open(${q(outFile)}, -1, 0, 0)
try {
  foreach ($s in $pres.Slides) { $s.Export((Join-Path ${q(dir)} ('slide-{0:D2}.png' -f $s.SlideIndex)), 'PNG', 1920, 1080) }
} finally {
  $pres.Close()
  if (-not $running) { $app.Quit() }
}
`,
    );
    try {
      const said = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps], {
        encoding: "utf8",
        timeout: 300000,
      });
      const notHere = ((said.match(/NOT-INSTALLED:(.*)/) || [])[1] || "").trim().split("|").filter(Boolean);
      const sheets = await compareSheets(dir, plans.length);
      console.log(`PowerPoint's rendering next to the browser's (HTML left, PowerPoint right): ${sheets.join(", ")}`);
      if (notHere.length)
        console.log(
          `Not installed on this computer: ${notHere.join(", ")}. If the preview shows a stand-in font, that's why: ` +
            (fontsMode === "embed"
              ? "PowerPoint may not pick up embedded fonts when it renders without a window, or until it restarts. Open the .pptx in PowerPoint to see it as presented."
              : "install the fonts, or export with --fonts embed or --fonts office."),
        );
    } catch (e) {
      console.log(`Preview failed: ${e.message.split("\n")[0]}`);
    } finally {
      fs.rmSync(ps, { force: true });
    }
  }
}

// HTML | PowerPoint, six slides per sheet.
async function compareSheets(dir, n) {
  const out = [];
  const { page, close } = await launch({ width: 1932, height: 1100 });
  try {
    for (let start = 1, sheet = 1; start <= n; start += 6, sheet++) {
      const nums = [];
      for (let k = start; k <= Math.min(n, start + 5); k++) nums.push(String(k).padStart(2, "0"));
      const rows = nums
        .map(
          (nn) =>
            `<div class=row><b>${Number(nn)}</b><img src="${fileUrl(path.join(dir, `html-${nn}.png`))}"><img src="${fileUrl(path.join(dir, `slide-${nn}.png`))}"></div>`,
        )
        .join("");
      const html = path.join(dir, `compare-${sheet}.html`);
      fs.writeFileSync(
        html,
        `<!doctype html><style>body{margin:0;background:#777;font:600 20px system-ui}.row{position:relative;display:flex;gap:4px;margin:0 0 4px 4px}.row img{width:960px;height:540px;display:block;background:#000}.row b{position:absolute;left:8px;top:6px;color:#fff;background:#0009;padding:2px 8px;border-radius:4px}</style>${rows}`,
      );
      await page.viewport(1928, nums.length * 544 + 4);
      await page.goto(fileUrl(html));
      await page.eval("Promise.all([...document.images].map((i) => i.decode().catch(() => {})))");
      const png = path.join(dir, `compare-${sheet}.png`);
      await page.screenshot(png);
      fs.rmSync(html, { force: true });
      out.push(png);
    }
  } finally {
    await close();
  }
  return out;
}
