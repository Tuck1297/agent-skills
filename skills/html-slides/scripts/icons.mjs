#!/usr/bin/env node
// react-icons for a deck.
//
//   node icons.mjs <deck folder or deck.html>   write engine/icons.js with the icons the deck uses
//   node icons.mjs --search chart line [--set lu,fa6] [--limit 40]   find icon names by words
//   node icons.mjs --sets                       list the icon sets and their prefixes
//
// In slides: <span class="icon" data-icon="LuRocket"></span>. Any react-icons name works
// (FaRocket, MdOutlineSavings, TbChartLine, SiStripe for brand logos); fa6/FaRocket picks a set.
// check.mjs and bundle.mjs run this for you.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { args, deckFile, usage } from "./lib/engine.mjs";
import { SETS, SET_NAMES, buildDeckIcons, loadDeps, searchIcons } from "./lib/icons.mjs";

const opt = args(process.argv.slice(2));

if (opt.sets) {
  for (const s of SETS) console.log(`${s.padEnd(5)} ${SET_NAMES[s] || ""}`);
  console.log("\nPrefixes: Lu Fa Md Tb Pi Hi Ri Bs Io Fi Si Bi Ai Gi Go Gr Ci Cg Di Fc Im Lia Rx Sl Tfi Ti Vsc Wi");
  console.log("Fa means fa then fa6, Hi means hi then hi2, Io means io5 then io; write fa6/FaName to choose.");
} else if (opt.search) {
  const words = [typeof opt.search === "string" ? opt.search : "", ...opt._].filter(Boolean);
  if (!words.length) {
    console.error("--search needs words, for example: --search chart line");
    process.exit(1);
  }
  const sets = typeof opt.set === "string" ? opt.set.split(",").map((s) => s.trim()) : undefined;
  const hits = searchIcons(loadDeps(), words, { sets, limit: Number(opt.limit) || 40 });
  if (!hits.length) console.log(`No icons match "${words.join(" ")}". Try one shorter word.`);
  for (const h of hits) console.log(`${h.name.padEnd(36)} ${SET_NAMES[h.set] || h.set}`);
} else if (opt._[0]) {
  const file = deckFile(opt._[0]);
  const r = buildDeckIcons(file);
  console.log(`${path.relative(process.cwd(), r.file) || r.file}: ${r.count} icon${r.count === 1 ? "" : "s"}`);
  for (const name of r.unknown) {
    const s = r.suggestions[name] || [];
    console.log(`  not found: ${name}${s.length ? `  (try ${s.join(", ")})` : ""}`);
  }
  if (r.unknown.length) process.exitCode = 2;
} else {
  console.log(usage(fileURLToPath(import.meta.url), 10));
  process.exit(1);
}
