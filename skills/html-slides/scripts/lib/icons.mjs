// react-icons for decks. Icons are named as in react-icons (FaRocket, MdOutlineSavings,
// LuChartLine, fa6/FaRocket to pick a set). They are rendered to SVG once, here in Node,
// and written into the deck's engine/icons.js, so the deck itself needs no React.
//
// react, react-dom and react-icons are installed on first use into a cache folder
// (~/.cache/html-slides, or HTML_SLIDES_CACHE), not into the skill or the deck.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

export const VERSIONS = { react: "19.2.9", "react-dom": "19.2.9", "react-icons": "5.7.0" };

// Name prefix -> react-icons sets to look in, in order.
const PREFIXES = [
  ["Lia", ["lia"]],
  ["Tfi", ["tfi"]],
  ["Vsc", ["vsc"]],
  ["Fa", ["fa", "fa6"]],
  ["Md", ["md"]],
  ["Hi", ["hi", "hi2"]],
  ["Io", ["io5", "io"]],
  ["Bs", ["bs"]],
  ["Bi", ["bi"]],
  ["Ri", ["ri"]],
  ["Tb", ["tb"]],
  ["Pi", ["pi"]],
  ["Lu", ["lu"]],
  ["Fi", ["fi"]],
  ["Si", ["si"]],
  ["Ai", ["ai"]],
  ["Gi", ["gi"]],
  ["Go", ["go"]],
  ["Gr", ["gr"]],
  ["Ci", ["ci"]],
  ["Cg", ["cg"]],
  ["Di", ["di"]],
  ["Fc", ["fc"]],
  ["Im", ["im"]],
  ["Rx", ["rx"]],
  ["Sl", ["sl"]],
  ["Ti", ["ti"]],
  ["Wi", ["wi"]],
];
// Search order: modern, consistent sets first.
export const SETS = [
  "lu", "fa6", "md", "tb", "pi", "hi2", "ri", "bs", "io5", "fi", "si", "fa", "bi", "ai", "hi",
  "gi", "go", "gr", "ci", "cg", "di", "fc", "im", "lia", "rx", "sl", "tfi", "ti", "vsc", "wi", "io",
];
export const SET_NAMES = {
  lu: "Lucide", fa6: "Font Awesome 6", fa: "Font Awesome 5", md: "Material Design", tb: "Tabler",
  pi: "Phosphor", hi2: "Heroicons 2", hi: "Heroicons", ri: "Remix", bs: "Bootstrap", io5: "Ionicons 5",
  io: "Ionicons 4", fi: "Feather", si: "Simple Icons (brand logos)", bi: "BoxIcons", ai: "Ant Design",
  gi: "Game Icons", go: "Octicons", gr: "Grommet", ci: "Circum", cg: "css.gg", di: "Devicons",
  fc: "Flat Color", im: "IcoMoon", lia: "Line Awesome", rx: "Radix", sl: "Simple Line", tfi: "Themify",
  ti: "Typicons", vsc: "VS Code", wi: "Weather",
};

export function cacheDir() {
  return process.env.HTML_SLIDES_CACHE || path.join(os.homedir(), ".cache", "html-slides");
}

// react-icons has no "./package.json" export, so read the files directly.
function installed(dir, versions = VERSIONS) {
  try {
    return Object.entries(versions).every(
      ([name, v]) =>
        JSON.parse(fs.readFileSync(path.join(dir, "node_modules", name, "package.json"), "utf8")).version === v,
    );
  } catch {
    return false;
  }
}

// Returns a require() rooted in the cache folder, installing the packages if needed.
// versions: { name: exact version } (react-icons and react by default).
export function loadDeps({ log = console.error, versions = VERSIONS, size = "about 90 MB" } = {}) {
  const dir = cacheDir();
  const pkg = path.join(dir, "package.json");
  if (installed(dir, versions)) return createRequire(pkg);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(pkg)) {
    fs.writeFileSync(pkg, JSON.stringify({ name: "html-slides-cache", private: true }, null, 2) + "\n");
  }
  const specs = Object.entries(versions).map(([n, v]) => `${n}@${v}`).join(" ");
  log(`Installing ${specs} into ${dir} (first run only, ${size})...`);
  execSync(`npm install --save-exact --no-audit --no-fund --loglevel=error ${specs}`, {
    cwd: dir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (!installed(dir, versions)) throw new Error(`${specs} did not install into ${dir}`);
  return createRequire(pkg);
}

// "FaRocket" -> { sets: ["fa", "fa6"], icon: "FaRocket" }; "fa6/FaRocket" -> { sets: ["fa6"], ... }
export function parseName(name) {
  const forced = name.match(/^([a-z0-9]+)[/:]([A-Z][A-Za-z0-9]*)$/);
  if (forced) return { sets: [forced[1]], icon: forced[2] };
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return null;
  const hit = PREFIXES.find(([p]) => name.startsWith(p) && /[A-Z0-9]/.test(name[p.length] || ""));
  return hit ? { sets: hit[1], icon: name } : null;
}

export function makeRenderer(req) {
  const React = req("react");
  const { renderToStaticMarkup } = req("react-dom/server");
  const mods = new Map();
  const load = (set) => {
    if (!mods.has(set)) {
      try {
        mods.set(set, req(`react-icons/${set}`));
      } catch {
        mods.set(set, null);
      }
    }
    return mods.get(set);
  };
  const find = (name) => {
    const p = parseName(name);
    if (!p) return null;
    for (const set of p.sets) {
      const m = load(set);
      if (m && typeof m[p.icon] === "function") return { set, Comp: m[p.icon] };
    }
    return null;
  };
  const render = (name) => {
    const hit = find(name);
    if (!hit) return null;
    return renderToStaticMarkup(React.createElement(hit.Comp, { "aria-hidden": "true", focusable: "false" }))
      .replace(/\s(height|width)="1em"/g, "")
      .replace(/\sstyle="[^"]*"/, "");
  };
  return { load, find, render };
}

// Icon names a deck uses: data-icon="..." attributes, plus strings in the data list that look
// like icon names (for data-icon="{{item.icon}}").
export function iconNamesIn(html) {
  const literal = new Set();
  for (const m of html.matchAll(/data-icon\s*=\s*["']([^"'{}]+)["']/g)) literal.add(m[1].trim());
  const fromData = new Set();
  const named = new Set(); // data values under an "icon" key: a typo there should be reported
  const block = html.match(/<script[^>]*id=["']deck-data["'][^>]*>([\s\S]*?)<\/script>/);
  if (block) {
    const walk = (v, key = "") => {
      if (typeof v === "string") {
        if (parseName(v.trim())) fromData.add(v.trim());
        if (/icon$/i.test(key) && v.trim()) named.add(v.trim());
      } else if (Array.isArray(v)) for (const x of v) walk(x, key);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    try {
      walk(JSON.parse(block[1]));
    } catch {
      /* invalid JSON is reported by the deck itself */
    }
  }
  for (const n of named) fromData.add(n);
  return { literal: [...literal], fromData: [...fromData].filter((n) => !literal.has(n)), named: [...named] };
}

export function searchIcons(req, words, { sets = SETS, limit = 60 } = {}) {
  const { load, find } = makeRenderer(req);
  const terms = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
  const hits = [];
  for (const set of sets) {
    const m = load(set);
    if (!m) continue;
    for (const key of Object.keys(m)) {
      if (typeof m[key] !== "function" || !/^[A-Z]/.test(key)) continue;
      const lower = key.toLowerCase();
      if (!terms.every((t) => lower.includes(t))) continue;
      const bare = find(key);
      hits.push({ name: bare && bare.set === set ? key : `${set}/${key}`, set, len: key.length });
    }
  }
  hits.sort((a, b) => SETS.indexOf(a.set) - SETS.indexOf(b.set) || a.len - b.len);
  return hits.slice(0, limit);
}

// Words in an icon name, for suggestions: "FaRocketLaunch" -> ["rocket", "launch"]
export const nameWords = (name) =>
  name
    .replace(/^[a-z0-9]+[/:]/, "")
    .replace(/^(Lia|Tfi|Vsc|[A-Z][a-z])/, "")
    .replace(/^(Outline|Solid|Mini|Fill|Regular|Ios|Md)/, "")
    .split(/(?=[A-Z0-9])/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !["outline", "outlined", "fill", "filled", "solid", "round", "sharp", "line"].includes(w));

// Writes <deck dir>/engine/icons.js with the icons the deck uses. Returns a summary.
export function buildDeckIcons(deckHtml, { log = console.error } = {}) {
  const html = fs.readFileSync(deckHtml, "utf8");
  const out = path.join(path.dirname(deckHtml), "engine", "icons.js");
  const { literal, fromData, named } = iconNamesIn(html);
  const header = `/* react-icons ${VERSIONS["react-icons"]} used by this deck (MIT; each icon set keeps its own license, see react-icons). Written by scripts/icons.mjs. */\n`;
  if (!literal.length && !fromData.length) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, header + "window.DECK_ICONS = {};\n");
    return { file: out, count: 0, unknown: [], suggestions: {} };
  }
  const req = loadDeps({ log });
  const r = makeRenderer(req);
  const icons = {};
  const unknown = [];
  for (const name of [...literal, ...fromData]) {
    const svg = r.render(name);
    if (svg) icons[name] = svg;
    else if (literal.includes(name) || named.includes(name)) unknown.push(name);
  }
  const suggestions = {};
  for (const name of unknown) {
    const words = nameWords(name);
    const pick = words.sort((a, b) => b.length - a.length)[0];
    suggestions[name] = pick ? searchIcons(req, [pick], { limit: 8 }).map((h) => h.name) : [];
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, header + "window.DECK_ICONS = " + JSON.stringify(icons, null, 1) + ";\n");
  return { file: out, count: Object.keys(icons).length, unknown, suggestions };
}
