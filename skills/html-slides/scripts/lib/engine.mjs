// Facts read from the engine itself, so the scripts never disagree with deck.js.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ENGINE_DIR = path.join(SKILL_DIR, "assets", "engine");
export const ENGINE_FILES = ["deck.js", "deck.css", "themes.css", "icons.js"];

// THEME_FONTS in deck.js is a plain object literal of strings (theme -> Google Fonts query).
export function readThemeFonts(src = fs.readFileSync(path.join(ENGINE_DIR, "deck.js"), "utf8")) {
  const m = src.match(/const THEME_FONTS = (\{[\s\S]*?\});/);
  return m ? new Function(`return (${m[1]});`)() : {};
}

export function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else out[key] = argv[++i];
    } else out._.push(a);
  }
  return out;
}

// The user's Documents folder (Windows can move it, e.g. to D:\Documents), where each deck
// gets a folder of its own. HTML_SLIDES_HOME names another parent folder.
export function documentsDir() {
  if (process.env.HTML_SLIDES_HOME) return path.resolve(process.env.HTML_SLIDES_HOME);
  const home = os.homedir();
  try {
    if (process.platform === "win32") {
      const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetFolderPath('MyDocuments')"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 15000,
      }).trim();
      if (out && fs.existsSync(out)) return out;
    } else {
      const out = execFileSync("xdg-user-dir", ["DOCUMENTS"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim();
      if (out && out !== home && fs.existsSync(out)) return out;
    }
  } catch {
    /* fall back to ~/Documents */
  }
  return path.join(home, "Documents");
}

// A deck title as a folder name: "Q3 review: EMEA" -> "Q3 review - EMEA".
export function folderName(title) {
  const name = String(title || "Untitled deck")
    .replace(/[<>:"/\\|?*]+/g, " - ")
    .split("")
    .filter((c) => c.charCodeAt(0) >= 32)
    .join("")
    .replace(/\s+/g, " ")
    .replace(/(\s-\s)+/g, " - ")
    .replace(/^[\s.-]+|[\s.]+$/g, "")
    .slice(0, 80)
    .trim();
  return name || "Untitled deck";
}

// Where a deck lives when no folder is given: <Documents>/<deck title>.
export const deckHome = (title) => path.join(documentsDir(), folderName(title));

// Why a folder is no place for a deck, or null. A deck (its source and its finished files)
// never goes in a temporary or session scratch folder, which gets cleared, or inside a code
// repository, even when the deck is about that code: it's the user's document, kept in
// <Documents>/<title>/.
export function badDeckHome(dir) {
  const full = path.resolve(dir);
  const lower = full.toLowerCase();
  const temps = [os.tmpdir(), process.env.TEMP, process.env.TMP, process.env.TMPDIR]
    .filter(Boolean)
    .map((p) => path.resolve(p).toLowerCase());
  if (temps.some((t) => lower === t || lower.startsWith(t + path.sep)) || /[\\/]scratchpad([\\/]|$)/i.test(full))
    return "a temporary folder, which gets cleared";
  // The agents' own folders (Claude Code, Gemini CLI and Antigravity, Codex) hold their
  // settings, temp files and scratch space, not the user's work.
  const agentHomes = [".claude", ".gemini", ".agents", ".codex"].map((d) => path.join(os.homedir(), d).toLowerCase());
  if (agentHomes.some((h) => lower === h || lower.startsWith(h + path.sep))) return "inside an AI agent's own settings folder";
  for (let d = full; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, ".git"))) return `inside a code repository (${d})`;
    if (path.dirname(d) === d) return null;
  }
}

// The deck file for a path that may be the deck folder or the html file.
export function deckFile(p) {
  if (!p) return null;
  const full = path.resolve(p);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return path.join(full, "deck.html");
  return full;
}

export const usage = (file, lines) =>
  fs
    .readFileSync(file, "utf8")
    .split("\n")
    .slice(1, lines + 1)
    .map((l) => l.replace(/^\/\/ ?/, ""))
    .join("\n");
