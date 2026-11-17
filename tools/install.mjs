#!/usr/bin/env node
// Installs the skills, agents and commands in this repo for Claude Code, Gemini CLI and
// Antigravity, and Codex, each from its one source (tools/lib/render.mjs makes each agent's
// version; tools/agents.json says where each agent keeps them).
//
//   node tools/install.mjs                      everything, for every agent
//   node tools/install.mjs --agent gemini       one agent (or --agent claude,codex)
//   node tools/install.mjs html-slides          only these skills, agents or commands
//                                               (and the guides, scripts and templates they use)
//   --replace     update files that differ from the repo's, and remove ones the repo dropped;
//                 a file edited where it's installed is kept (see below)
//   --force       with --replace, overwrite those edited files too
//   --pull        copy Claude Code files edited in ~/.claude back into the repo, so they
//                 aren't lost; review with git diff
//
// An installed file counts as edited when it matches neither what this installer wrote there
// last time (recorded in ~/.<agent>/.installed-from-<repo>.json) nor, for Claude Code, any
// version in the repo's git history. File dates aren't used: a git checkout changes them.
//   --dry-run     say what would change, change nothing
//   --home <dir>  install under another home folder (to try it out)
//   --list        list what's here and which agents get it
//
// Files are copied, not linked: run it again after editing a skill. Without --replace, a file
// that's already installed and differs is left alone, so local edits survive. Items marked
// draft in tools/agents.json are only installed when named.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SKIP,
  expandHome,
  frontmatterValue,
  itemAgents,
  itemDeps,
  itemFiles,
  itemHomes,
  listItems,
  loadConfig,
  sharedFiles,
  walk,
} from "./lib/render.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.basename(ROOT);
const cfg = loadConfig(ROOT);
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const color = (c) => (s) => (tty ? `\x1b[${c}m${s}\x1b[0m` : s);
const green = color(32);
const yellow = color(33);
const red = color(31);
const dim = color(2);

// ---------------------------------------------------------------- arguments
const opts = { agents: [], names: [], replace: false, force: false, pull: false, dryRun: false, home: os.homedir(), list: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const value = () => {
    if (i + 1 >= argv.length) fail(`${a} needs a value`);
    return argv[++i];
  };
  if (a === "--agent" || a === "-a") opts.agents.push(...value().split(","));
  else if (a.startsWith("--agent=")) opts.agents.push(...a.slice(8).split(","));
  else if (a === "--replace") opts.replace = true;
  else if (a === "--force") opts.force = true;
  else if (a === "--pull") opts.pull = true;
  else if (a === "--dry-run" || a === "-n") opts.dryRun = true;
  else if (a === "--home") opts.home = path.resolve(value());
  else if (a === "--list") opts.list = true;
  else if (a === "--help" || a === "-h") {
    const lines = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n");
    console.log(lines.slice(1, lines.findIndex((l) => l.startsWith("import "))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(0);
  } else if (a.startsWith("-")) fail(`unknown option ${a} (--help lists them)`);
  else opts.names.push(a);
}
function fail(msg) {
  console.error(red(`Error: ${msg}`));
  process.exit(1);
}

const known = Object.keys(cfg.agents);
if (!opts.agents.length || opts.agents.includes("all")) opts.agents = known;
for (const a of opts.agents) if (!known.includes(a)) fail(`unknown agent "${a}" (${known.join(", ")}, or all)`);

const all = listItems(ROOT);
const byName = new Map(all.map((i) => [i.name, i]));
for (const n of opts.names) if (!byName.has(n)) fail(`no skill, agent or command called "${n}" (--list shows them)`);

if (opts.list) {
  if (!all.length) console.log("Nothing here yet.");
  const w = Math.max(0, ...all.map((i) => i.name.length));
  for (const i of all) {
    const flags = [cfg.items[i.name]?.private && "private", cfg.items[i.name]?.draft && "draft: only installed when named"].filter(Boolean);
    console.log(`${i.name.padEnd(w)}  ${i.kind.padEnd(7)}  ${itemAgents(i, cfg).join(", ")}${flags.length ? dim(`  (${flags.join(", ")})`) : ""}`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------- writing
const counts = { new: 0, updated: 0, same: 0, skipped: 0, edited: 0, removed: 0 };
const skippedItems = [];
const editedInstalled = []; // { agent, dest, src }: installed copies edited where they're installed
let currentAgent = "";
let lastIds = new Map(); // installed file -> content id this installer wrote there last time
let ids = new Map(); // the same, for this run (saved in the manifest)

// A file's content id: its git blob id, with LF line endings for text (how git stores it).
const isText = (b) => !b.subarray(0, 8000).includes(0);
const lf = (b) => (isText(b) ? Buffer.from(b.toString("utf8").replace(/\r\n/g, "\n")) : b);
const blobId = (b) => crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");
const contentId = (b) => blobId(lf(b));

// Every object id in this repo's git history (empty when it isn't a git checkout).
let history;
function repoVersions() {
  if (!history) {
    history = new Set();
    try {
      const out = execFileSync("git", ["-C", ROOT, "rev-list", "--all", "--objects"], { encoding: "utf8", maxBuffer: 512 << 20, stdio: ["ignore", "pipe", "ignore"] });
      for (const line of out.split("\n")) if (line) history.add(line.split(" ")[0]);
    } catch {
      // not a git checkout: only the manifest tells what was installed
    }
  }
  return history;
}

// True when an installed file holds something this repo put there: what this installer wrote
// last time, or (Claude Code's copies are the sources' own format) any version the repo has had.
// Gemini's and Codex's copies are made from the sources, so with no record they count as ours.
function isOurs(file) {
  const old = fs.readFileSync(file);
  const id = contentId(old);
  const last = lastIds.get(path.resolve(file));
  if (id === last) return true;
  if (currentAgent === "claude") return repoVersions().has(id) || repoVersions().has(blobId(old));
  return !last;
}

// Writes one file; returns what happened.
function put(dest, data, src) {
  const next = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const abs = path.resolve(dest);
  const done = (result) => {
    if (result === "edited" || result === "skipped") {
      if (lastIds.has(abs)) ids.set(abs, lastIds.get(abs));
    } else ids.set(abs, contentId(next));
    return result;
  };
  const exists = fs.existsSync(dest);
  if (exists) {
    const old = fs.readFileSync(dest);
    // Text that differs only in line endings (CRLF from a Windows checkout) is the same text.
    if (Buffer.compare(old, next) === 0 || (isText(old) && lf(old).equals(lf(next)))) return done("same");
    if (!isOurs(dest)) {
      editedInstalled.push({ agent: currentAgent, dest, src });
      if (!opts.force) return done("edited");
    }
    if (!opts.replace) return done("skipped");
  }
  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (exists && fs.lstatSync(dest).isSymbolicLink()) fs.rmSync(dest);
    fs.writeFileSync(dest, next);
    if (src && process.platform !== "win32") fs.chmodSync(dest, fs.statSync(src).mode & 0o777);
  }
  return done(exists ? "updated" : "new");
}

function remove(file) {
  if (!opts.dryRun) fs.rmSync(file, { force: true });
  counts.removed++;
}

// One line per item or folder: what happened to its files.
function report(label, results, removed = 0) {
  const n = (k) => results.filter((r) => r === k).length;
  for (const k of ["new", "updated", "same", "skipped", "edited"]) counts[k] += n(k);
  const parts = [];
  if (n("new") === results.length && results.length) parts.push(green("new"));
  else {
    if (n("new")) parts.push(green(`${n("new")} new`));
    if (n("updated")) parts.push(green(`${n("updated")} updated`));
    if (removed) parts.push(green(`${removed} removed`));
    if (n("skipped")) parts.push(yellow(`${n("skipped")} differ, kept (--replace updates them)`));
    if (n("edited")) parts.push(yellow(`${n("edited")} edited where installed, kept`));
    if (!parts.length) parts.push(dim("up to date"));
  }
  if (n("skipped")) skippedItems.push(label);
  console.log(`  ${label.padEnd(40)} ${parts.join(", ")}`);
}

// What this repo installed last time, per agent, so --replace can remove what it dropped.
const manifestPath = (agent) => path.join(expandHome(cfg.agents[agent].skills[0], opts.home), "..", `.installed-from-${REPO}.json`);
function readManifest(agent) {
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath(agent), "utf8"));
    return { files: m.files || [], ids: m.ids || {} };
  } catch {
    return { files: [], ids: {} };
  }
}

// ---------------------------------------------------------------- one agent
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const claudeOnlyNotes = [];

function installAgent(agent) {
  const a = cfg.agents[agent];
  currentAgent = agent;
  const wanted = (i) => (opts.names.length ? opts.names.includes(i.name) : !cfg.items[i.name]?.draft);
  const items = all.filter((i) => itemAgents(i, cfg).includes(agent) && wanted(i));
  const notHere = opts.names.filter((n) => !items.some((i) => i.name === n));
  console.log(`\n${a.label} ${dim(`(${agent})`)}`);
  if (notHere.length) console.log(dim(`  not for ${a.label}: ${notHere.join(", ")}`));
  const drafts = opts.names.length ? [] : all.filter((i) => cfg.items[i.name]?.draft && itemAgents(i, cfg).includes(agent));
  if (drafts.length) console.log(dim(`  drafts, not installed unless named: ${drafts.map((i) => i.name).join(", ")}`));
  const written = [];
  // What this repo installed here last time; only those files are ever removed.
  const manifest = readManifest(agent);
  const before = manifest.files.map((f) => path.resolve(opts.home, f));
  const installedBefore = new Set(before);
  lastIds = new Map(Object.entries(manifest.ids).map(([f, id]) => [path.resolve(opts.home, f), id]));
  ids = new Map();

  // Older installs kept skills in other folders; move those out so nothing loads twice.
  for (const old of a.retire || []) {
    const dir = expandHome(old, opts.home);
    for (const i of items) {
      const from = path.join(dir, i.kind === "skill" || agent !== "claude" ? i.name : `${i.name}.md`);
      if (!fs.existsSync(path.join(from, "SKILL.md"))) continue;
      const to = path.join(opts.home, path.relative(opts.home, dir).split(path.sep)[0], ".skills-backup", stamp, path.basename(path.dirname(dir)), i.name);
      if (!opts.dryRun) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(from, to);
      }
      console.log(`  ${yellow("moved")} ${path.relative(opts.home, from)} ${dim(`to ${path.relative(opts.home, to)}`)}`);
    }
  }

  // Skills, agents and commands.
  for (const i of items) {
    const files = itemFiles(i, agent, cfg);
    if (agent !== "claude") {
      const main = files.find((f) => f.rel.endsWith("SKILL.md") && f.rel.split("/").length === 2)?.data || "";
      const hits = (a.claudeOnly || []).filter((t) => main.includes(t));
      if (hits.length) claudeOnlyNotes.push(`${agent}: ${i.name} (${hits.join(", ")})`);
      const desc = frontmatterValue(main, "description") || "";
      if (!desc || desc.length > 1024) console.log(yellow(`  ${i.name}: its description is ${desc ? `${desc.length} characters; the Agent Skills format allows 1024` : "missing"}, so ${a.label} may skip it (set a shorter one under others in tools/agents.json)`));
    }
    for (const home of itemHomes(i, agent, cfg, opts.home)) {
      const results = files.map((f) => put(path.join(home, f.rel), f.data, f.src));
      let removed = 0;
      const folder = path.join(home, i.name);
      // Files of this skill the repo no longer has (only ones it installed; yours stay).
      if (opts.replace && (i.kind === "skill" || agent !== "claude") && fs.existsSync(folder)) {
        const keep = new Set(files.map((f) => f.rel.slice(i.name.length + 1)));
        for (const rel of walk(folder))
          if (!keep.has(rel) && !rel.split("/").some((p) => SKIP.has(p)) && installedBefore.has(path.resolve(folder, rel)) && isOurs(path.join(folder, rel))) {
            remove(path.join(folder, rel));
            removed++;
          }
      }
      written.push(...files.map((f) => path.join(home, f.rel)));
      report(`${path.relative(opts.home, home).split(path.sep).join("/")}/${i.name}`, results, removed);
    }
  }

  // Guides, scripts and templates: all of them, or the ones the named items use.
  let only;
  if (opts.names.length) {
    only = new Set();
    for (const i of items) for (const d of itemDeps(ROOT, i, cfg, all).shared) only.add(d);
  }
  const byKind = new Map();
  for (const f of sharedFiles(ROOT, agent, cfg, only)) {
    const dest = path.join(expandHome(a.shared[f.kind], opts.home), f.rel);
    if (!byKind.has(f.kind)) byKind.set(f.kind, []);
    byKind.get(f.kind).push(put(dest, f.data, f.src));
    written.push(dest);
  }
  for (const [kind, results] of byKind) report(`${path.relative(opts.home, expandHome(a.shared[kind], opts.home)).split(path.sep).join("/")}/`, results);

  // This agent's own files (hooks, docs, its instructions file): only on a full install.
  if (!opts.names.length)
    for (const x of a.extras || []) {
      const from = path.join(ROOT, x.from);
      if (!fs.existsSync(from)) continue;
      const to = expandHome(x.to, opts.home);
      const pairs = fs.statSync(from).isDirectory() ? walk(from).map((r) => [path.join(from, r), path.join(to, r)]) : [[from, to]];
      const results = pairs.map(([s, d]) => {
        const data = fs.readFileSync(s);
        if (s.endsWith(".json")) {
          try {
            JSON.parse(data.toString("utf8").replace(/^﻿/, ""));
          } catch (e) {
            console.log(red(`  ${x.from}: ${path.basename(s)} isn't valid JSON (${e.message})`));
          }
        }
        written.push(d);
        return put(d, data, s);
      });
      report(`${path.relative(opts.home, to).split(path.sep).join("/")}${fs.statSync(from).isDirectory() ? "/" : ""}`, results);
    }

  // A full install with --replace removes what an earlier install of this repo put there and
  // the repo no longer has. A partial install only adds to the record.
  const now = new Set(written.map((f) => path.resolve(f)));
  if (opts.replace && !opts.names.length) {
    const dropped = before.filter((f) => !now.has(f) && fs.existsSync(f));
    const gone = dropped.filter((f) => isOurs(f));
    for (const f of dropped.filter((f) => !gone.includes(f)))
      console.log(`  ${yellow("kept")} ${path.relative(opts.home, f).split(path.sep).join("/")} ${dim("(no longer in the repo, but edited where installed)")}`);
    for (const f of gone) {
      remove(f);
      console.log(`  ${green("removed")} ${path.relative(opts.home, f).split(path.sep).join("/")} ${dim("(no longer in the repo)")}`);
    }
    for (const dir of new Set(gone.map((f) => path.dirname(f))))
      if (!opts.dryRun && fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
  const record = opts.names.length ? new Set([...before, ...now]) : now;
  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(manifestPath(agent)), { recursive: true });
    const rel = (f) => path.relative(opts.home, f).split(path.sep).join("/");
    const files = [...record].sort();
    const recordIds = {};
    for (const f of files) {
      const id = ids.get(f) ?? lastIds.get(f);
      if (id) recordIds[rel(f)] = id;
    }
    fs.writeFileSync(manifestPath(agent), JSON.stringify({ repo: REPO, source: ROOT, installed: new Date().toISOString(), files: files.map(rel), ids: recordIds }, null, 2) + "\n");
  }
}

// ---------------------------------------------------------------- run
// --pull only looks (installs nothing) and then copies Claude Code's edited files back.
const pullWrites = opts.pull && !opts.dryRun;
if (opts.pull) {
  opts.dryRun = true;
  opts.agents = opts.agents.filter((a) => a === "claude");
  if (!opts.agents.length) fail("--pull works for Claude Code only (the other agents' files are made from the repo's)");
}
console.log(`Installing from ${ROOT}${opts.pull ? yellow(" (--pull: checking only, nothing is installed)") : opts.dryRun ? yellow(" (dry run: nothing is changed)") : ""}`);
console.log(dim(`Home: ${opts.home}   Mode: ${opts.replace ? `replace${opts.force ? ", force" : ""}` : "install (installed files that differ are kept)"}`));
for (const agent of opts.agents) installAgent(agent);

console.log(
  `\n${opts.dryRun ? "Would write" : "Wrote"} ${counts.new} new and ${counts.updated} updated files, ${opts.dryRun ? "would remove" : "removed"} ${counts.removed}; ${counts.same} already up to date.`,
);
if (skippedItems.length) console.log(yellow(`${skippedItems.length} installed ${skippedItems.length === 1 ? "copy differs" : "copies differ"} from the repo and ${skippedItems.length === 1 ? "was" : "were"} kept; run again with --replace to update.`));
if (claudeOnlyNotes.length)
  console.log(dim(`\nThese mention Claude Code tools the other agents don't have (fine if the text explains it, otherwise add an agent block):\n  ${claudeOnlyNotes.join("\n  ")}`));

// Installed copies edited where they're installed: keep them from being lost.
const short = (f) => path.relative(opts.home, f).split(path.sep).join("/");
const day = (f) => fs.statSync(f).mtime.toISOString().slice(0, 10);
const hasMarkers = (f) => /\.md$/i.test(f) && /<!-- (\/?agent\b|\/?as-is -->)/.test(fs.readFileSync(f, "utf8"));
const edits = editedInstalled.sort((x, y) => fs.statSync(y.dest).mtimeMs - fs.statSync(x.dest).mtimeMs);
if (edits.length) {
  console.log(yellow(`\n${edits.length} installed file${edits.length === 1 ? " was" : "s were"} edited where ${edits.length === 1 ? "it's" : "they're"} installed (last changed):`));
  for (const x of edits)
    console.log(`  ${short(x.dest).padEnd(58)} ${day(x.dest)}${x.agent !== "claude" ? dim("  made from the repo: edit the source instead") : x.src && hasMarkers(x.src) ? red("  source has agent blocks: merge by hand") : ""}`);
  const pullable = edits.filter((x) => x.agent === "claude" && x.src && !hasMarkers(x.src));
  if (opts.pull) {
    if (pullWrites) for (const x of pullable) fs.copyFileSync(x.dest, x.src);
    console.log(pullWrites ? green(`Copied ${pullable.length} back into the repo. Review them with git diff, then install again.`) : `--pull would copy ${pullable.length} back into the repo.`);
  } else
    console.log(`${opts.force ? "--force overwrote them." : "They were kept."}${pullable.length ? ` To keep the Claude Code edits, copy them into the repo first: node tools/install.mjs --pull (then review with git diff).` : ""}`);
}
