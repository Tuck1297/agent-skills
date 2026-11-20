// Re-encodes JPEG and PNG images as WebP, and scales down very large ones, in the Chrome,
// Edge, Chromium or Brave already on this computer, so bundle.mjs needs no npm packages.
// Each result is cached by the image's bytes and the settings, so a rebuild only encodes
// images that changed and doesn't start the browser when nothing did.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { launch } from "./browser.mjs";
import { cacheDir } from "./icons.mjs";

// Bump when the encoding changes, so cached results are made again.
const VERSION = 1;
// WebP replaces the original only when it is at least this much smaller (or was scaled down).
const MIN_GAIN = 0.9;

// Runs in the page: decode, scale so the longest side is at most `max`, encode as WebP.
const ENCODER = `window.__toWebp = async (b64, mime, quality, max) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime }), { imageOrientation: "from-image" });
  const scale = max > 0 && Math.max(bmp.width, bmp.height) > max ? max / Math.max(bmp.width, bmp.height) : 1;
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/webp", quality });
  if (blob.type !== "image/webp") return null;
  const out = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < out.length; i += 32768) s += String.fromCharCode.apply(null, out.subarray(i, i + 32768));
  return { b64: btoa(s), w, h, ow: bmp.width, oh: bmp.height };
}; true`;

// An animated PNG has an acTL chunk before its first IDAT; a canvas would keep one frame.
const isAnimatedPng = (buf) => {
  const idat = buf.indexOf("IDAT");
  const actl = buf.indexOf("acTL");
  return actl > 0 && (idat < 0 || actl < idat);
};

// Width and height of a PNG or JPEG from its header, or null.
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < buf.length; ) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // SOF0-SOF15 hold the size; C4, C8 and CC are other segments in that range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

export const canShrink = (mime, buf) =>
  (mime === "image/jpeg" || (mime === "image/png" && !isAnimatedPng(buf))) && buf.length >= 8192;

/**
 * items: [{ buf, mime }]. Returns, in the same order, { buf, mime } for each image that got
 * smaller (WebP), or null to keep the original. Never throws: if no browser is found it
 * returns all nulls and the reason in `error`.
 */
export async function shrinkImages(items, { quality = 0.8, maxPx = 2560, concurrency = 4, onEncode } = {}) {
  const dir = path.join(cacheDir(), "webp");
  const keyOf = (buf) =>
    crypto.createHash("sha1").update(`${VERSION}|${quality}|${maxPx}|`).update(buf).digest("hex");
  const results = new Array(items.length).fill(null);
  const todo = [];
  items.forEach((item, i) => {
    if (!canShrink(item.mime, item.buf)) return;
    const key = keyOf(item.buf);
    const hit = path.join(dir, key + ".webp");
    if (fs.existsSync(path.join(dir, key + ".keep"))) return;
    if (fs.existsSync(hit)) results[i] = { buf: fs.readFileSync(hit), mime: "image/webp" };
    else todo.push({ i, key });
  });
  if (!todo.length) return { results, encoded: 0 };
  if (onEncode) onEncode(todo.length);

  let browser;
  try {
    browser = await launch({ width: 800, height: 600 });
  } catch (e) {
    return { results, encoded: 0, error: e.message };
  }
  const { page, close } = browser;
  fs.mkdirSync(dir, { recursive: true });
  let encoded = 0;
  const failed = [];
  try {
    await page.eval(ENCODER);
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const { i, key } = todo[next++];
        const { buf, mime } = items[i];
        let r = null;
        try {
          r = await page.eval(`__toWebp(${JSON.stringify(buf.toString("base64"))}, ${JSON.stringify(mime)}, ${quality}, ${maxPx})`);
        } catch (e) {
          failed.push(e.message.split("\n")[0]);
          continue;
        }
        encoded++;
        const webp = r && Buffer.from(r.b64, "base64");
        const scaled = r && (r.w !== r.ow || r.h !== r.oh);
        if (webp && webp.length < buf.length * (scaled ? 1 : MIN_GAIN)) {
          fs.writeFileSync(path.join(dir, key + ".webp"), webp);
          results[i] = { buf: webp, mime: "image/webp" };
        } else {
          fs.writeFileSync(path.join(dir, key + ".keep"), "");
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  } finally {
    await close();
  }
  return { results, encoded, error: failed.length ? `${failed.length} image(s) could not be decoded: ${failed[0]}` : undefined };
}
