#!/usr/bin/env node
// Creates a deck folder: deck.html (from assets/template.html), engine/ (the slide engine),
// assets/ (for images and video).
//
//   node new-deck.mjs [folder] --title "Q3 business review" [--theme corporate] [--motion moderate]
//        [--presenter "Sam Lee"] [--data data.json] [--brand brand.json] [--force]
//
// No folder: the deck gets its own folder named after the title in the user's Documents
// folder (<Documents>/Q3 business review/; HTML_SLIDES_HOME names another parent). A temp or
// scratch folder, or one inside a code repository, is refused (--anywhere: the user asked).
// --data   JSON merged into the deck's data list (the {{values}} the slides use).
// --brand  {"accent":"#0a7cff","accent2":"#..","bg":"#..","ink":"#..","fontHead":"Montserrat",
//          "fontBody":"Open Sans","charts":["#..."]} (reference.mjs writes one from a .pptx).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_DIR, ENGINE_FILES, SKILL_DIR, args, badDeckHome, deckHome, readThemeFonts, usage } from "./lib/engine.mjs";

const opt = args(process.argv.slice(2));
if (opt.help || (!opt._[0] && typeof opt.title !== "string")) {
  console.log(usage(fileURLToPath(import.meta.url), 13));
  process.exit(opt.help ? 0 : 1);
}
const dir = opt._[0] ? path.resolve(opt._[0]) : deckHome(opt.title);
const bad = badDeckHome(dir);
if (bad && !opt.anywhere) {
  console.error(
    `${dir} is ${bad}. A deck's source and its finished files belong together in <Documents>/<title>/: ` +
      `leave the folder out (and HTML_SLIDES_HOME unset) to put it there. Pass --anywhere only if the user asked for this place.`,
  );
  process.exit(1);
}

const THEME_FONTS = readThemeFonts();
const theme = opt.theme || "corporate";
if (!THEME_FONTS[theme]) {
  console.error(`Unknown theme "${theme}". Themes: ${Object.keys(THEME_FONTS).join(", ")}`);
  process.exit(1);
}
const motion = opt.motion || "moderate";
if (!["none", "subtle", "moderate", "heavy"].includes(motion)) {
  console.error(`--motion is none, subtle, moderate or heavy`);
  process.exit(1);
}

const deckFile = path.join(dir, "deck.html");
if (fs.existsSync(deckFile) && !opt.force) {
  console.error(`${deckFile} already exists. Pass --force to replace it.`);
  process.exit(1);
}

const title = typeof opt.title === "string" ? opt.title : "Untitled deck";
let data = {
  deck: { title, subtitle: "", kicker: "", date: "today" },
  presenter: { name: typeof opt.presenter === "string" ? opt.presenter : "", role: "" },
};
if (typeof opt.data === "string") {
  const extra = JSON.parse(fs.readFileSync(opt.data, "utf8"));
  data = { ...data, ...extra, deck: { ...data.deck, ...(extra.deck || {}) }, presenter: { ...data.presenter, ...(extra.presenter || {}) } };
}

const OFFICE_FONTS = new Set(
  "calibri,calibri light,arial,segoe ui,aptos,aptos display,century gothic,georgia,times new roman,verdana,tahoma,garamond,trebuchet ms,cambria,candara,corbel,constantia,franklin gothic,franklin gothic medium,gill sans,gill sans mt,helvetica,helvetica neue,consolas,courier new,book antiqua,palatino linotype,rockwell,tw cen mt"
    .split(","),
);
let brandCss = "";
const extraFonts = [];
if (typeof opt.brand === "string") {
  let b = JSON.parse(fs.readFileSync(opt.brand, "utf8"));
  if (b.brand) b = b.brand;
  const lines = [];
  const hex = (v) => (typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v) ? (v[0] === "#" ? v : "#" + v) : null);
  if (hex(b.accent)) lines.push(`--accent: ${hex(b.accent)};`);
  if (hex(b.accent2)) lines.push(`--accent-2: ${hex(b.accent2)};`);
  if (hex(b.bg)) lines.push(`--bg: ${hex(b.bg)};`);
  if (hex(b.ink)) lines.push(`--ink: ${hex(b.ink)};`);
  (b.charts || []).slice(0, 6).forEach((c, i) => hex(c) && lines.push(`--chart-${i + 1}: ${hex(c)};`));
  for (const [key, cssVar] of [["fontHead", "--font-head"], ["fontBody", "--font-body"]]) {
    const f = b[key];
    if (typeof f !== "string" || !f.trim()) continue;
    lines.push(`${cssVar}: "${f}", system-ui, sans-serif;`);
    if (!OFFICE_FONTS.has(f.toLowerCase()) && !extraFonts.includes(f)) extraFonts.push(f);
  }
  if (lines.length) brandCss = "    html[data-theme] {\n" + lines.map((l) => "      " + l).join("\n") + "\n    }";
}

const fontLinks = [
  '  <link rel="preconnect" href="https://fonts.googleapis.com">',
  '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  `  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${THEME_FONTS[theme]}&display=swap" data-theme-fonts="${theme}">`,
];
if (extraFonts.length) {
  const q = extraFonts.map((f) => "family=" + f.trim().replace(/\s+/g, "+") + ":wght@400;700").join("&");
  fontLinks.push(`  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=swap" data-brand-fonts>`);
}

const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
const html = fs
  .readFileSync(path.join(SKILL_DIR, "assets", "template.html"), "utf8")
  .replace("%%THEME%%", theme)
  .replace("%%MOTION%%", motion)
  .replace("%%FONTS%%", fontLinks.join("\n"))
  .replace("%%BRAND%%", brandCss)
  .replace("%%DATA%%", json);

fs.mkdirSync(path.join(dir, "engine"), { recursive: true });
fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
for (const f of ENGINE_FILES) {
  fs.copyFileSync(path.join(ENGINE_DIR, f), path.join(dir, "engine", f));
}
fs.writeFileSync(deckFile, html);

console.log(`Created ${deckFile}
  theme: ${theme}   motion: ${motion}${extraFonts.length ? `   brand fonts: ${extraFonts.join(", ")}` : ""}
  engine/   the slide engine (deck.js, deck.css, themes.css, icons.js)
  assets/   put images and video here and use src="assets/..."
Next: write the slides in deck.html, then run check.mjs and bundle.mjs.`);
