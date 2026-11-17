#!/usr/bin/env node
// Adds vetted libraries (assets/libraries.json) to a deck: pinned <script> and <link> tags
// in the right places. Running it again with the same id changes nothing.
//
//   node add-lib.mjs <deck folder or deck.html> chartjs sortable ...
//   node add-lib.mjs --list            what's in the catalog and when to use each
//   node add-lib.mjs <deck> --remove chartjs
//
// Then start each widget from the deck's own <script> with deck.mount(); see
// references/libraries.md. bundle.mjs inlines the files, so a bundled deck works offline.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SKILL_DIR, args, deckFile, usage } from "./lib/engine.mjs";

export function readCatalog() {
  return JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "assets", "libraries.json"), "utf8"));
}

export function libTags(cat, lib) {
  const base = `${cat.cdn}${lib.pkg}@${lib.version}/`;
  const note = `  <!-- lib:${lib.id} ${lib.pkg}@${lib.version} (${lib.license}) -->`;
  return {
    styles: (lib.styles || []).map((f) => `  <link rel="stylesheet" href="${base}${f}" data-lib="${lib.id}">`),
    scripts: (lib.scripts || []).map((f) => `  <script src="${base}${f}" data-lib="${lib.id}"></script>`),
    note,
  };
}

function insertBefore(html, anchor, text) {
  const i = html.indexOf(anchor);
  if (i < 0) return null;
  const lineStart = html.lastIndexOf("\n", i) + 1;
  return html.slice(0, lineStart) + text + "\n" + html.slice(lineStart);
}

export function addLibs(html, ids, cat = readCatalog()) {
  const added = [];
  for (const id of ids) {
    const lib = cat.libs.find((l) => l.id === id || l.pkg === id);
    if (!lib) throw new Error(`No library "${id}" in the catalog. node add-lib.mjs --list shows them.`);
    if (html.includes(`data-lib="${lib.id}"`)) continue;
    const t = libTags(cat, lib);
    if (t.styles.length) {
      const next =
        insertBefore(html, '<link rel="stylesheet" href="engine/deck.css"', [t.note, ...t.styles].join("\n")) ||
        insertBefore(html, "</head>", [t.note, ...t.styles].join("\n"));
      html = next;
    }
    if (t.scripts.length) {
      const block = (t.styles.length ? t.scripts : [t.note, ...t.scripts]).join("\n");
      const next = lib.after
        ? insertBefore(html, "</body>", block)
        : insertBefore(html, '<script src="engine/icons.js"', block) || insertBefore(html, "</body>", block);
      html = next;
    }
    added.push(lib);
  }
  return { html, added };
}

export function removeLibs(html, ids) {
  for (const id of ids) {
    html = html
      .split("\n")
      .filter((line) => !line.includes(`data-lib="${id}"`) && !line.includes(`<!-- lib:${id} `))
      .join("\n");
  }
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opt = args(process.argv.slice(2));
  const cat = readCatalog();
  if (opt.list) {
    for (const l of cat.libs) {
      console.log(`${l.id.padEnd(14)} ${l.name} ${l.version}${l.large ? "  (large)" : ""}${l.online ? "  (needs internet: " + l.online + ")" : ""}`);
      console.log(`${" ".repeat(15)}${l.use}`);
      if (l.gotcha) console.log(`${" ".repeat(15)}Watch out: ${l.gotcha}`);
    }
    process.exit(0);
  }
  const file = deckFile(opt._[0]);
  if (!file || !fs.existsSync(file)) {
    console.log(usage(fileURLToPath(import.meta.url), 10));
    process.exit(1);
  }
  let html = fs.readFileSync(file, "utf8");
  if (opt.remove) {
    const ids = [typeof opt.remove === "string" ? opt.remove : null, ...opt._.slice(1)].filter(Boolean);
    fs.writeFileSync(file, removeLibs(html, ids));
    console.log(`Removed ${ids.join(", ")} from ${file}`);
    process.exit(0);
  }
  const ids = opt._.slice(1);
  if (!ids.length) {
    console.error("Name at least one library. node add-lib.mjs --list shows them.");
    process.exit(1);
  }
  const r = addLibs(html, ids, cat);
  fs.writeFileSync(file, r.html);
  if (!r.added.length) console.log("Already there; nothing changed.");
  for (const l of r.added) {
    console.log(`Added ${l.name} ${l.version} (window.${l.global || "(CSS only)"})${l.online ? `. Note: ${l.online}` : ""}`);
    if (l.gotcha) console.log(`  Watch out: ${l.gotcha}`);
  }
}
