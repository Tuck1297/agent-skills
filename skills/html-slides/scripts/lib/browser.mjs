// A small headless-browser driver over the Chrome DevTools Protocol, using the Chrome, Edge,
// Chromium or Brave already on this computer. No npm packages; needs Node 22+ (WebSocket).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export function findBrowser() {
  const list = [process.env.DECK_BROWSER, process.env.CHROME_PATH];
  if (process.platform === "win32") {
    const bases = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    for (const b of bases) {
      list.push(
        path.join(b, "Google/Chrome/Application/chrome.exe"),
        path.join(b, "Microsoft/Edge/Application/msedge.exe"),
        path.join(b, "Chromium/Application/chrome.exe"),
        path.join(b, "BraveSoftware/Brave-Browser/Application/brave.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    list.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    );
  } else {
    const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"];
    for (const dir of (process.env.PATH || "").split(":")) for (const n of names) list.push(path.join(dir, n));
  }
  return list.find((p) => p && fs.existsSync(p));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1920, height = 1080 } = {}) {
  if (typeof WebSocket === "undefined") throw new Error("Node 22 or newer is needed (it has WebSocket built in).");
  const exe = findBrowser();
  if (!exe) throw new Error("No Chrome, Edge, Chromium or Brave found. Set DECK_BROWSER to the browser's path.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "html-slides-"));
  const proc = spawn(
    exe,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--hide-scrollbars",
      "--mute-audio",
      "--autoplay-policy=no-user-gesture-required",
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const portFile = path.join(profile, "DevToolsActivePort");
  let wsPath = null;
  for (let i = 0; i < 200 && !wsPath; i++) {
    if (proc.exitCode !== null) throw new Error(`${path.basename(exe)} exited (${proc.exitCode})`);
    if (fs.existsSync(portFile)) {
      const [port, p] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/);
      if (port && p) wsPath = `ws://127.0.0.1:${port}${p}`;
    }
    if (!wsPath) await sleep(100);
  }
  if (!wsPath) throw new Error("The browser did not start its debugging port.");
  const ws = new WebSocket(wsPath);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("Could not connect to the browser."));
  });
  const cdp = new Cdp(ws);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const page = new Page(cdp, sessionId);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Log.enable");
  await page.viewport(width, height);
  const close = async () => {
    try {
      await cdp.send("Browser.close");
    } catch {
      /* already closed */
    }
    ws.close();
    for (let i = 0; i < 20 && proc.exitCode === null; i++) await sleep(100);
    if (proc.exitCode === null) proc.kill();
    for (let i = 0; i < 10; i++) {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
        break;
      } catch {
        await sleep(200);
      }
    }
  };
  return { page, close, exe };
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.errors = [];
    cdp.listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        this.errors.push("JavaScript error: " + ((d.exception && d.exception.description) || d.text).split("\n")[0]);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.errors.push("console.error: " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        const e = msg.params.entry;
        if (!/favicon/.test(e.url || "")) this.errors.push(`${e.source}: ${e.text}${e.url ? " " + e.url : ""}`);
      }
    });
  }
  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }
  waitFor(method, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.cdp.listeners.delete(fn);
        reject(new Error(`timed out waiting for ${method}`));
      }, timeout);
      const fn = (msg) => {
        if (msg.sessionId === this.sessionId && msg.method === method) {
          clearTimeout(t);
          this.cdp.listeners.delete(fn);
          resolve(msg.params);
        }
      };
      this.cdp.listeners.add(fn);
    });
  }
  viewport(width, height) {
    return this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: this.dpr || 1, mobile: false });
  }
  async goto(url) {
    const loaded = this.waitFor("Page.loadEventFired", 60000);
    await this.send("Page.navigate", { url });
    await loaded;
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error((d.exception && d.exception.description) || d.text);
    }
    return r.result.value;
  }
  async screenshot(file, { fullPage = false } = {}) {
    const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  }
  // PNG bytes, optionally clipped to a canvas-pixel box, optionally with a transparent page.
  async shot({ clip, transparent = false } = {}) {
    if (transparent) await this.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    try {
      const r = await this.send("Page.captureScreenshot", {
        format: "png",
        ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
      });
      return Buffer.from(r.data, "base64");
    } finally {
      if (transparent) await this.send("Emulation.setDefaultBackgroundColorOverride", {});
    }
  }
  async pdf(file) {
    const r = await this.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  }
}

export const fileUrl = (p, query = "") => pathToFileURL(path.resolve(p)).href + query;
