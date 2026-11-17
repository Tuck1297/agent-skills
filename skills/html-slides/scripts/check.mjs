#!/usr/bin/env node
// Checks a deck in a headless browser (Chrome, Edge, Chromium or Brave) and writes
// <deck folder>/.check/: slide-01.png ... (each slide in its final state), sheet.png (all
// slides on one page), audit.json, and deck.pdf with --pdf.
//
//   node check.mjs <deck folder or deck.html> [--pdf] [--slides 3,5-7] [--theme pitch]
//        [--no-shots] [--no-sheet] [--transitions | --transitions=all] [--hotspots]
//
// Reports: text that overflows or is cut off, text too small to read, overfull slides,
// broken images, {{values}} missing from the data list, unknown icons, JavaScript errors
// and files that failed to load. Look at the PNGs too: the audit can't judge design.
// --transitions freezes each kind of slide transition the deck uses at 25%, 50% and 75%
// (every slide's with =all) into transitions.png, frames in .check/transitions/.
// --hotspots shows every build step of each slide with .hotspot areas (or buttons with
// data-goto-step, data-goto, data-set), each outlined and labeled with where it goes, in
// .check/hotspots/slide-NN-step-MM.png.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { args, deckFile, usage } from "./lib/engine.mjs";
import { buildDeckIcons } from "./lib/icons.mjs";
import { fileUrl, launch } from "./lib/browser.mjs";

const opt = args(process.argv.slice(2));
const file = deckFile(opt._[0]);
if (!file || !fs.existsSync(file)) {
  console.log(usage(fileURLToPath(import.meta.url), 14));
  process.exit(1);
}
const outDir = path.join(path.dirname(file), ".check");
fs.mkdirSync(outDir, { recursive: true });
// Retaking every slide: clear old shots first, so a deck that lost slides leaves no strays.
// --slides and --no-shots keep the shots already there.
if (!opt.slides && !opt["no-shots"])
  for (const f of fs.readdirSync(outDir)) if (/^slide-\d+\.png$/.test(f)) fs.rmSync(path.join(outDir, f));

function pickSlides(spec, count) {
  if (!spec || spec === true) return [...Array(count).keys()];
  const out = new Set();
  for (const part of String(spec).split(",")) {
    const [a, b] = part.split("-").map((n) => parseInt(n, 10));
    for (let i = a; i <= (b || a); i++) if (i >= 1 && i <= count) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

const lines = [];
const say = (s = "") => lines.push(s);
const rel = (p) => path.relative(process.cwd(), p) || p;

// 1. Icons
let iconInfo = { count: 0, unknown: [], suggestions: {} };
try {
  iconInfo = buildDeckIcons(file, { log: (m) => console.error(m) });
} catch (e) {
  say(`Icons: could not build engine/icons.js (${e.message})`);
}

// 2. Browser
const theme = typeof opt.theme === "string" ? `&theme=${encodeURIComponent(opt.theme)}` : "";
const { page, close } = await launch({ width: 1920, height: 1080 });
let report;
let hotspotNote = "";
try {
  await page.goto(fileUrl(file, "?static" + theme));
  const hasDeck = await page.eval("!!window.deck");
  if (!hasDeck) throw new Error("window.deck is missing: engine/deck.js did not run (see errors below)");
  await page.eval("deck.settled()");
  const count = await page.eval("deck.slides.length");

  // 3. Each slide in its final state. Visiting a slide starts its library widgets
  //    (deck.mount) while it is on screen, so they can measure themselves.
  const wanted = new Set(pickSlides(opt.slides, count));
  for (let i = 0; i < count; i++) {
    await page.eval(`(async () => { deck.go(${i}, { instant: true }); await deck.settled(); })()`);
    if (wanted.has(i) && !opt["no-shots"])
      await page.screenshot(path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`));
  }
  report = await page.eval("deck.audit()");

  // 4. Contact sheet
  if (!opt["no-sheet"]) {
    const cols = count <= 6 ? 3 : 4;
    const width = cols * 480 + (cols - 1) * 24 + 48;
    await page.viewport(width, 1000);
    await page.goto(fileUrl(file, "?sheet" + theme));
    await page.eval(`document.documentElement.style.setProperty("--sheet-cols", "${cols}"); deck.settled()`);
    const height = await page.eval("Math.ceil(document.documentElement.scrollHeight)");
    await page.viewport(width, Math.min(height, 16000));
    await page.eval("deck.settled()");
    await page.screenshot(path.join(outDir, "sheet.png"));
  }

  // 5. Transitions, frozen part way
  if (opt.transitions) {
    const tdir = path.join(outDir, "transitions");
    fs.rmSync(tdir, { recursive: true, force: true });
    fs.mkdirSync(tdir, { recursive: true });
    await page.viewport(960, 540);
    await page.goto(fileUrl(file, theme ? "?" + theme.slice(1) : ""));
    await page.eval(`document.head.insertAdjacentHTML("beforeend", "<style>.deck-toast, .deck-controls { display: none !important }</style>"); deck.settled()`);
    const plan = report.slides.filter((s) => !s.hidden && s.transition && s.transition !== "none");
    const seen = new Set();
    const picked = plan.filter((s) => opt.transitions === "all" || (!seen.has(s.transition) && seen.add(s.transition)));
    const fractions = [0.25, 0.5, 0.75];
    for (const s of picked) {
      await page.eval(`(async () => {
        let j = ${s.n - 2};
        while (j > 0 && deck.slides[j].hasAttribute("data-hidden")) j--;
        deck.endTransition();
        deck.go(j, { instant: true });
        await deck.settled();
        deck.go(${s.n - 1}, { dir: 1 });
      })()`);
      for (const fr of fractions) {
        await page.eval(`deck.seekTransition(${fr})`);
        s.frames = s.frames || [];
        const name = `${String(s.n).padStart(2, "0")}-${s.transition}-${fr * 100}.png`;
        await page.screenshot(path.join(tdir, name));
        s.frames.push(name);
      }
      await page.eval("deck.endTransition()");
    }
    // One picture: a row per transition, frozen at each fraction.
    const cell = 400;
    const rows = picked.map((s) => `<div class="label">slide ${s.n} · ${s.transition}</div>` +
      s.frames.map((f) => `<img src="transitions/${f}">`).join("")).join("");
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#1b1b1f;font:600 15px system-ui;color:#eee;display:grid;grid-template-columns:repeat(${fractions.length},${cell}px);gap:8px 12px}.label{grid-column:1/-1;margin-top:8px}img{width:${cell}px;display:block;border-radius:4px}</style>${rows}`;
    const sheetFile = path.join(outDir, "transitions.html");
    fs.writeFileSync(sheetFile, html);
    const width = fractions.length * cell + (fractions.length - 1) * 12 + 32;
    await page.viewport(width, 800);
    await page.goto(fileUrl(sheetFile));
    const height = await page.eval("Math.ceil(document.documentElement.scrollHeight)");
    await page.viewport(width, Math.min(height, 16000));
    await page.screenshot(path.join(outDir, "transitions.png"));
    fs.rmSync(sheetFile);
  }

  // 5b. Hotspots: each build step of every slide with clickable areas, the areas outlined and
  //     labeled with where they go, to see that each one sits on its button.
  if (opt.hotspots) {
    const hdir = path.join(outDir, "hotspots");
    fs.rmSync(hdir, { recursive: true, force: true });
    fs.mkdirSync(hdir, { recursive: true });
    await page.viewport(1920, 1080);
    await page.goto(fileUrl(file, theme ? "?" + theme.slice(1) : ""));
    // .hotspot areas, and any button that jumps to a step or slide or changes a demo's state.
    const HOT = ".hotspot, button[data-goto-step], button[data-goto], a[data-goto], button[data-set], button[data-toggle]";
    const css =
      ".deck-toast, .deck-controls { display: none !important } " +
      "[data-hot-check] { outline: 3px solid #ff00aa !important; outline-offset: 0 !important; background: rgba(255, 0, 170, 0.18) !important } " +
      "[data-hot-check]::before { content: attr(data-hot-check); position: absolute; left: 2px; top: 2px; font: 700 13px/1 system-ui, sans-serif; color: #fff; background: #ff00aa; padding: 3px 5px; border-radius: 4px; white-space: nowrap; z-index: 9 }";
    await page.eval(`deck.setMotion("none"); document.head.insertAdjacentHTML("beforeend", ${JSON.stringify(`<style>${css}</style>`)}); deck.settled()`);
    const list = await page.eval(`deck.slides.map((s, i) => (s.querySelector(${JSON.stringify(HOT)}) ? { i, steps: s.__order.length } : null)).filter(Boolean)`);
    let shots = 0;
    for (const { i, steps } of list) {
      await page.eval(`(async () => { deck.go(${i}, { instant: true }); await deck.settled(); })()`);
      for (let n = 0; n <= steps; n++) {
        await page.eval(`(async () => {
          deck.goStep(${n});
          await deck.settled();
          await new Promise((r) => setTimeout(r, 60));
          // Only what a click there would reach: covered spots (an earlier screen's, under the
          // current one) are left out. Test them all before drawing any label.
          const all = [...deck.slides[${i}].querySelectorAll(${JSON.stringify(HOT)})];
          for (const h of all) h.removeAttribute("data-hot-check");
          const live = all.filter((h) => {
            const r = h.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return false;
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return top && (top === h || h.contains(top));
          });
          for (const h of live) {
            const a = (k) => h.getAttribute(k);
            if (getComputedStyle(h).position === "static") h.style.position = "relative";
            h.setAttribute("data-hot-check", a("data-goto-step") !== null ? "→ step " + a("data-goto-step") : a("data-goto") !== null ? "→ slide " + a("data-goto") : a("data-set") || a("data-toggle") || a("aria-label") || "hotspot");
          }
        })()`);
        await page.screenshot(path.join(hdir, `slide-${String(i + 1).padStart(2, "0")}-step-${String(n).padStart(2, "0")}.png`));
        shots++;
      }
    }
    hotspotNote = list.length
      ? `  hotspots: ${shots} pictures of ${list.length} slide${list.length === 1 ? "" : "s"} in ${rel(hdir)}${path.sep}`
      : "  hotspots: no slide has .hotspot areas or buttons that jump or change state";
  }

  // 6. PDF
  if (opt.pdf) {
    await page.viewport(1920, 1080);
    await page.goto(fileUrl(file, "?print" + theme));
    await page.eval("deck.settled()");
    await page.pdf(path.join(outDir, "deck.pdf"));
  }
} finally {
  await close();
}

// 7. Report
const errors = [...new Set(page.errors)];
const fontErrors = errors.filter((e) => /fonts\.(googleapis|gstatic)\.com/.test(e));
const otherErrors = errors.filter((e) => !fontErrors.includes(e));
report.icons = iconInfo;
report.errors = otherErrors;
report.fontErrors = fontErrors;
fs.writeFileSync(path.join(outDir, "audit.json"), JSON.stringify(report, null, 2));

let problemCount = 0;
say(`${report.title || path.basename(file)}: ${report.slideCount} slides (${report.hiddenCount} hidden), theme ${report.theme}, motion ${report.motion}`);
for (const s of report.slides) {
  const tag = `${String(s.n).padStart(2)}${s.hidden ? " (hidden)" : ""} ${s.title ? `"${s.title.slice(0, 60)}"` : s.id || ""}`;
  if (!s.problems.length) continue;
  say(`  slide ${tag}`);
  for (const p of s.problems) {
    problemCount++;
    say(`     - ${p.type}: ${p.element ? p.element + " " : ""}${p.detail || ""}`.trimEnd());
  }
}
if (report.missingData.length) {
  problemCount += report.missingData.length;
  say(`  missing from the data list: ${report.missingData.join(", ")}`);
}
for (const i of report.issues || []) {
  problemCount++;
  say(`  engine: ${typeof i === "string" ? i : JSON.stringify(i)}`);
}
for (const name of iconInfo.unknown) {
  problemCount++;
  const s = iconInfo.suggestions[name] || [];
  say(`  unknown icon ${name}${s.length ? ` (try ${s.slice(0, 6).join(", ")})` : ""}`);
}
for (const e of otherErrors) {
  problemCount++;
  say(`  error: ${e}`);
  if (/%7B%7B/i.test(e)) say(`     (a src="{{value}}" is fetched before it's filled in: write data-src="{{value}}" instead)`);
}
if (fontErrors.length) say(`  note: Google Fonts did not load (offline?); screenshots use fallback fonts`);
const used = {};
for (const s of report.slides) if (s.transition && !s.hidden) (used[s.transition] = used[s.transition] || []).push(s.n);
const usedList = Object.entries(used).map(([k, v]) => `${k} (${v.length > 6 ? v.length + " slides" : v.join(", ")})`);
if (usedList.length) say(`  transitions: ${usedList.join("; ")}`);
const noNotes = report.slides.filter((s) => !s.hidden && !s.notes).map((s) => s.n);
if (noNotes.length) say(`  no speaker notes on slides ${noNotes.join(", ")}`);
if (hotspotNote) say(hotspotNote);
say(problemCount ? `${problemCount} problem${problemCount === 1 ? "" : "s"} to fix.` : "No problems found.");
say(`Look at: ${rel(outDir)}${path.sep} (slide-NN.png, sheet.png${opt.transitions ? ", transitions.png" : ""}${opt.hotspots ? ", hotspots/" : ""}${opt.pdf ? ", deck.pdf" : ""}, audit.json)`);
console.log(lines.join("\n"));
