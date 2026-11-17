// Turns the one source of each skill, agent and command into one agent's version.
//
// Sources are written for Claude Code: skills/<name>/SKILL.md (plus the skill's scripts,
// references and assets), agents/<name>.md, commands/<name>.md, and the shared guides/,
// scripts/ and templates/ they read. For another agent (tools/agents.json):
//   - paths into Claude's folders become that agent's (~/.claude/guides/x.md becomes
//     ~/.codex/guides/x.md, ~/.claude/agents/x.md becomes ~/.codex/skills/x/SKILL.md);
//   - agents and commands become skills (<name>/SKILL.md);
//   - the frontmatter name is the folder name, and Claude's model names become the agent's;
//   - per-item settings from agents.json are applied (frontmatter keys, which agents get it).
// Two markers work in any Markdown file:
//   <!-- agent: gemini, codex -->text only Gemini and Codex get<!-- /agent -->
//   <!-- as-is -->text whose paths stay as written<!-- /as-is -->
// Either can be inline or have its two markers on lines of their own around whole lines.
// Every agent's version drops the markers. Only Markdown is changed; scripts, images and
// other files are copied as they are.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const KINDS = { skill: "skills", agent: "agents", command: "commands" };
export const SHARED = ["guides", "scripts", "templates"];
// Never copied: dependencies, check output and editor or OS clutter.
export const SKIP = new Set(["node_modules", ".git", ".check", ".reference", ".DS_Store", "Thumbs.db", "desktop.ini"]);

export function loadConfig(root) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "tools", "agents.json"), "utf8"));
  cfg.items ||= {};
  if (!cfg.agents?.claude) throw new Error("tools/agents.json needs a claude agent: the sources are written for it");
  return cfg;
}

export const expandHome = (p, home = os.homedir()) => (p.startsWith("~/") ? path.join(home, p.slice(2)) : path.resolve(p));

// Every skill, agent and command under root.
export function listItems(root) {
  const items = [];
  const skills = path.join(root, "skills");
  if (fs.existsSync(skills))
    for (const d of fs.readdirSync(skills, { withFileTypes: true }))
      if (d.isDirectory() && fs.existsSync(path.join(skills, d.name, "SKILL.md")))
        items.push({ name: d.name, kind: "skill", path: path.join(skills, d.name), main: path.join(skills, d.name, "SKILL.md") });
  for (const kind of ["agent", "command"]) {
    const dir = path.join(root, KINDS[kind]);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir))
      if (f.endsWith(".md")) items.push({ name: f.slice(0, -3), kind, path: path.join(dir, f), main: path.join(dir, f) });
  }
  const seen = new Map();
  for (const it of items) {
    if (seen.has(it.name)) throw new Error(`"${it.name}" is both a ${seen.get(it.name)} and a ${it.kind}; names must be unique`);
    seen.set(it.name, it.kind);
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

// The agents an item is installed for.
export const itemAgents = (item, cfg) => (cfg.items[item.name]?.only || Object.keys(cfg.agents)).filter((a) => cfg.agents[a]);

// ---------------------------------------------------------------- text
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

// Runs fn over each marked region; whole-line markers take their lines with them.
function regions(text, open, close, fn) {
  const o = open.source;
  const c = close.source;
  text = text.replace(new RegExp(`^[ \\t]*${o}[ \\t]*\\r?\\n([\\s\\S]*?)^[ \\t]*${c}[ \\t]*(?:\\r?\\n|$)`, "gm"), (...m) => fn(m.slice(1, -2)));
  return text.replace(new RegExp(`${o}([\\s\\S]*?)${c}`, "g"), (...m) => fn(m.slice(1, -2)));
}

export function agentBlocks(text, agent, cfg) {
  const known = new Set(Object.keys(cfg.agents));
  text = regions(text, /<!-- agent: ([\w ,-]+) -->/, /<!-- \/agent -->/, ([list, body]) => {
    const names = list.split(",").map((s) => s.trim()).filter(Boolean);
    for (const n of names) if (!known.has(n)) throw new Error(`unknown agent "${n}" in an agent block (known: ${[...known].join(", ")})`);
    return names.includes(agent) ? body : "";
  });
  if (/<!-- \/?agent\b/.test(text)) throw new Error("an agent block isn't closed with <!-- /agent -->");
  return text;
}

// From Claude's paths to the agent's, longest first.
export function pathMap(agent, cfg) {
  if (agent === "claude") return [];
  const claude = cfg.agents.claude;
  const a = cfg.agents[agent];
  const map = [];
  for (const kind of SHARED) if (claude.shared?.[kind] && a.shared?.[kind]) map.push([`${claude.shared[kind]}/`, `${a.shared[kind]}/`]);
  map.push([`${claude.skills[0]}/`, `${a.skills[0]}/`]);
  for (const [from, to] of Object.entries(a.paths || {})) map.push([from, to]);
  return map.sort((x, y) => y[0].length - x[0].length);
}

function rewritePaths(text, agent, cfg) {
  if (agent === "claude") return text;
  const claude = cfg.agents.claude;
  const skills = cfg.agents[agent].skills[0];
  // Claude's agents and commands are skills elsewhere.
  for (const kind of ["agents", "commands"]) {
    const from = claude[kind].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`${from}/([\\w.-]+?)\\.md`, "g"), (m, n) => `${skills}/${n}/SKILL.md`);
  }
  const map = pathMap(agent, cfg);
  // One pass, so a replacement is never rewritten again.
  const re = new RegExp(map.map(([f]) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const to = new Map(map);
  return text.replace(re, (m) => to.get(m));
}

// "Claude Code", "Claude" and "CLAUDE.md" become the agent's, as whole words only (not in
// claude.ai, ~/.claude or Claude-Session).
function rewriteNames(text, agent, cfg) {
  const names = Object.entries(cfg.agents[agent].names || {}).sort((x, y) => y[0].length - x[0].length);
  if (!names.length) return text;
  const re = new RegExp(`(?<![\\w./-])(?:${names.map(([n]) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`, "g");
  const to = new Map(names);
  return text.replace(re, (m) => to.get(m));
}

// The frontmatter as ordered [key, raw lines] pairs, so keys can be set without
// reformatting the rest.
function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) return null;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const entries = [];
  for (const line of m[1].split(/\r?\n/)) {
    const k = line.match(/^([A-Za-z_][\w-]*)\s*:/);
    if (k || !entries.length) entries.push([k ? k[1] : null, [line]]);
    else entries.at(-1)[1].push(line);
  }
  return { entries, body: text.slice(m[0].length), eol, after: m[2] };
}
const joinFrontmatter = ({ entries, body, eol, after }) =>
  `---${eol}${entries.flatMap(([, lines]) => lines).join(eol)}${eol}---${after || eol}${body}`;
const yamlValue = (v) => (typeof v === "string" ? v : Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v));
function setKey(fm, key, value, { first = false } = {}) {
  const line = `${key}: ${yamlValue(value)}`;
  const at = fm.entries.findIndex(([k]) => k === key);
  if (at >= 0) fm.entries[at] = [key, [line]];
  else if (first) fm.entries.unshift([key, [line]]);
  else fm.entries.push([key, [line]]);
}
export function frontmatterValue(text, key) {
  const fm = splitFrontmatter(stripBom(text));
  const e = fm?.entries.find(([k]) => k === key);
  if (!e) return undefined;
  const v = e[1].join("\n").replace(/^[^:]*:\s*/, "").trim();
  // A block scalar (description: > or |): the indented lines below it.
  const block = v.match(/^([|>])[-+]?[ \t]*\n([\s\S]*)$/);
  if (block) return block[2].split("\n").map((l) => l.trim()).join(block[1] === ">" ? " " : "\n").trim();
  return v.replace(/^(["'])([\s\S]*)\1$/, "$2");
}

// Any Markdown file (a skill's SKILL.md or references, a guide) for one agent.
export function renderMarkdown(text, agent, cfg, where = "") {
  text = stripBom(text);
  try {
    text = agentBlocks(text, agent, cfg);
    const kept = [];
    text = regions(text, /<!-- as-is -->/, /<!-- \/as-is -->/, ([body]) => `\u0000${kept.push(body) - 1}\u0000`);
    if (/<!-- \/?as-is -->/.test(text)) throw new Error("an as-is block isn't closed with <!-- /as-is -->");
    if (agent !== "claude") text = rewriteNames(rewritePaths(text, agent, cfg), agent, cfg);
    return text.replace(/\u0000(\d+)\u0000/g, (m, i) => kept[i]);
  } catch (e) {
    throw new Error(`${where}: ${e.message}`);
  }
}

// The item's main file (SKILL.md, or the agent's or command's .md) for one agent.
export function renderMain(text, item, agent, cfg) {
  text = renderMarkdown(text, agent, cfg, item.main);
  if (agent === "claude") return text;
  const a = cfg.agents[agent];
  let fm = splitFrontmatter(text);
  if (!fm) {
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    fm = { entries: [], body: text, eol, after: eol };
  }
  // Skills are named after their folder (the Agent Skills format requires it).
  setKey(fm, "name", item.name, { first: true });
  const model = fm.entries.find(([k]) => k === "model")?.[1][0].replace(/^[^:]*:\s*/, "").trim();
  if (model && a.models?.[model]) setKey(fm, "model", a.models[model]);
  if (item.kind === "command" && !model && a.commandModel) setKey(fm, "model", a.commandModel);
  // others: keys for every agent but Claude; then the agent's own.
  for (const [k, v] of Object.entries({ ...cfg.items[item.name]?.others, ...cfg.items[item.name]?.[agent] })) setKey(fm, k, v);
  return joinFrontmatter(fm);
}

// ---------------------------------------------------------------- files
// Every file of a folder, relative paths with forward slashes.
export function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out.sort();
}

const isMd = (p) => p.toLowerCase().endsWith(".md");

// The files an item becomes for one agent: [{ rel, data }], rel relative to the folder the
// item is installed in (itemHomes). A skill's rel starts with its folder name.
export function itemFiles(item, agent, cfg) {
  if (item.kind !== "skill") {
    const data = renderMain(fs.readFileSync(item.path, "utf8"), item, agent, cfg);
    return [{ rel: agent === "claude" ? `${item.name}.md` : `${item.name}/SKILL.md`, data, src: item.path }];
  }
  return walk(item.path).map((rel) => {
    const src = path.join(item.path, rel);
    const data =
      rel === "SKILL.md"
        ? renderMain(fs.readFileSync(src, "utf8"), item, agent, cfg)
        : isMd(rel)
          ? renderMarkdown(fs.readFileSync(src, "utf8"), agent, cfg, src)
          : fs.readFileSync(src);
    return { rel: `${item.name}/${rel}`, data, src };
  });
}

// The folders an item's files go under for one agent.
export function itemHomes(item, agent, cfg, home) {
  const a = cfg.agents[agent];
  if (agent === "claude" && item.kind !== "skill") return [expandHome(a[KINDS[item.kind]], home)];
  return a.skills.map((d) => expandHome(d, home));
}

// The shared files (guides, scripts, templates) for one agent: [{ kind, rel, data }].
// only, when given, is a set of "kind/rel" to keep.
export function sharedFiles(root, agent, cfg, only) {
  const out = [];
  for (const kind of SHARED) {
    if (!cfg.agents[agent].shared?.[kind]) continue;
    const dir = path.join(root, kind);
    if (!fs.existsSync(dir)) continue;
    for (const rel of walk(dir)) {
      if (only && !only.has(`${kind}/${rel}`) && !only.has(`${kind}/${rel.split("/")[0]}`)) continue;
      const src = path.join(dir, rel);
      out.push({ kind, rel, src, data: isMd(rel) ? renderMarkdown(fs.readFileSync(src, "utf8"), agent, cfg, src) : fs.readFileSync(src) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- what an item uses
// The Markdown and other text files of an item, as [{ file, text }].
export function itemTexts(item) {
  const files = item.kind === "skill" ? walk(item.path).map((r) => path.join(item.path, r)) : [item.path];
  return files
    .filter((f) => /\.(md|mjs|cjs|js|ts|json|sh|py|txt|ya?ml|html|css)$/i.test(f))
    .map((f) => ({ file: f, text: fs.readFileSync(f, "utf8") }));
}

// What an item needs from the rest of the repo: { shared: Set("guides/x.md", "scripts/doc-tool"),
// items: Set(name), why: Map(dep -> file) }. Follows guides into the guides they name.
export function itemDeps(root, item, cfg, all = listItems(root)) {
  const claude = cfg.agents.claude;
  const shared = new Set();
  const items = new Set(cfg.items[item.name]?.requires || []);
  const why = new Map();
  const byName = new Map(all.map((i) => [i.name, i]));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scan = (text, file) => {
    for (const kind of SHARED) {
      if (!claude.shared?.[kind]) continue;
      for (const m of text.matchAll(new RegExp(`${esc(claude.shared[kind])}/([\\w.-]+)`, "g"))) {
        const dep = `${kind}/${m[1]}`;
        if (fs.existsSync(path.join(root, kind, m[1])) && !shared.has(dep)) {
          shared.add(dep);
          why.set(dep, file);
          if (kind === "guides" && isMd(m[1])) scan(fs.readFileSync(path.join(root, kind, m[1]), "utf8"), path.join(root, kind, m[1]));
        }
      }
    }
    for (const [kind, dir] of [["skills", claude.skills[0]], ["agents", claude.agents], ["commands", claude.commands]])
      for (const m of text.matchAll(new RegExp(`${esc(dir)}/([\\w-]+)`, "g")))
        if (byName.has(m[1]) && m[1] !== item.name && !items.has(m[1])) {
          items.add(m[1]);
          why.set(m[1], file);
        }
  };
  for (const { file, text } of itemTexts(item)) scan(text, file);
  return { shared, items, why };
}
