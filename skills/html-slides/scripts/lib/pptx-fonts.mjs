// Embeds the deck's Google Fonts in the .pptx so it looks the same on a computer that
// doesn't have them installed. PowerPoint embeds TrueType fonts as Embedded OpenType
// (.fntdata) and knows four faces per family name (regular, bold, italic, bold italic), so
// each weight is used under its own legacy family name the way Office lists it:
// "Sora" (400 and 700), "Sora ExtraBold" (800), "Sora Light" (300)...

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cacheDir } from "./icons.mjs";

const dir = path.join(cacheDir(), "fonts");

// No user agent: Google Fonts answers with static TrueType files, one per weight and style.
async function get(url, maxAgeMs = Infinity) {
  const f = path.join(dir, crypto.createHash("sha1").update(url).digest("hex"));
  if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < maxAgeMs) return fs.readFileSync(f);
  const r = await fetch(url, { headers: { "user-agent": "" } });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, buf);
  return buf;
}

const faces = (css) =>
  [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
    italic: /font-style:\s*italic/.test(body),
    weight: Number((body.match(/font-weight:\s*(\d+)/) || [])[1] || 400),
    url: (body.match(/url\((https:[^)]+\.ttf)\)/) || [])[1],
  }));

// The weights and styles Google has for a family; null when it isn't a Google font.
const available = new Map();
async function stylesOf(family) {
  if (!available.has(family)) {
    const all = [100, 200, 300, 400, 500, 600, 700, 800, 900].flatMap((w) => [w, `${w}i`]).join(",");
    const url = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family).replace(/%20/g, "+")}:${all}`;
    available.set(
      family,
      get(url, 7 * 86400000).then(
        (b) => faces(b.toString("utf8")).map(({ italic, weight }) => ({ italic, weight })),
        () => null,
      ),
    );
  }
  return available.get(family);
}

// CSS font matching, simplified: the style first, then the nearest weight
// (heavier wins for bold requests, lighter for light ones).
function pick(list, weight, italic) {
  const same = list.filter((f) => f.italic === italic);
  const pool = same.length ? same : list;
  return pool.reduce((best, f) => {
    const d = Math.abs(f.weight - weight);
    const bd = Math.abs(best.weight - weight);
    if (d !== bd) return d < bd ? f : best;
    return (weight >= 500) === f.weight > best.weight ? f : best;
  });
}

// ---------- reading a TrueType file ----------
export function readFont(buf) {
  const tables = {};
  const n = buf.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    tables[buf.toString("latin1", o, o + 4)] = { offset: buf.readUInt32BE(o + 8), length: buf.readUInt32BE(o + 12) };
  }
  const names = {};
  if (tables.name) {
    const base = tables.name.offset;
    const count = buf.readUInt16BE(base + 2);
    const strings = base + buf.readUInt16BE(base + 4);
    for (let i = 0; i < count; i++) {
      const r = base + 6 + i * 12;
      const [platform, encoding, lang, id, len, off] = [0, 2, 4, 6, 8, 10].map((k) => buf.readUInt16BE(r + k));
      if (platform !== 3 || encoding !== 1 || (lang !== 0x409 && names[id])) continue;
      const be = buf.subarray(strings + off, strings + off + len);
      const le = Buffer.alloc(be.length);
      for (let j = 0; j + 1 < be.length; j += 2) le.writeUInt16LE(be.readUInt16BE(j), j);
      names[id] = le.toString("utf16le");
    }
  }
  const os2 = tables["OS/2"].offset;
  return {
    truetype: !!tables.glyf,
    names,
    family: names[1],
    style: names[2] || "Regular",
    weight: buf.readUInt16BE(os2 + 4),
    fsType: buf.readUInt16BE(os2 + 8),
    panose: buf.subarray(os2 + 32, os2 + 42),
    unicodeRange: [42, 46, 50, 54].map((k) => buf.readUInt32BE(os2 + k)),
    codePageRange: buf.readUInt16BE(os2) >= 1 ? [78, 82].map((k) => buf.readUInt32BE(os2 + k)) : [0, 0],
    fsSelection: buf.readUInt16BE(os2 + 62),
    checkSumAdjustment: buf.readUInt32BE(tables.head.offset + 8),
  };
}

// Embedded OpenType, version 0x00020002 (the one PowerPoint writes), uncompressed. Like
// PowerPoint, the family and style names end in a NUL.
export function toEot(buf, f = readFont(buf)) {
  const str = (s = "") => {
    const b = Buffer.from(s, "utf16le");
    const head = Buffer.alloc(4);
    head.writeUInt16LE(b.length, 2); // padding, then size
    return Buffer.concat([head, b]);
  };
  const fixed = Buffer.alloc(80);
  let o = 8;
  fixed.writeUInt32LE(buf.length, 4);
  fixed.writeUInt32LE(0x00020002, o);
  o += 4;
  fixed.writeUInt32LE(0, o); // flags: not compressed, not obfuscated
  o += 4;
  f.panose.copy(fixed, o);
  o += 10;
  fixed.writeUInt8(0, o++); // ANSI_CHARSET
  fixed.writeUInt8(f.fsSelection & 1 ? 1 : 0, o++);
  fixed.writeUInt32LE(f.weight, o);
  o += 4;
  fixed.writeUInt16LE(f.fsType, o);
  o += 2;
  fixed.writeUInt16LE(0x504c, o);
  o += 2;
  for (const v of [...f.unicodeRange, ...f.codePageRange]) {
    fixed.writeUInt32LE(v, o);
    o += 4;
  }
  fixed.writeUInt32LE(f.checkSumAdjustment, o);
  // 16 reserved bytes stay zero
  const names = Buffer.concat([str(f.names[1] + "\0"), str(f.names[2] + "\0"), str(f.names[5]), str(f.names[4]), str("")]);
  // RootStringCheckSum (of no root string), EUDCCodePage 1252, Padding6, SignatureSize 0,
  // EUDCFlags, EUDCFontSize 0
  const tail = Buffer.alloc(20);
  tail.writeUInt32LE(0x50475342, 0);
  tail.writeUInt32LE(1252, 4);
  const out = Buffer.concat([fixed, names, tail, buf]);
  out.writeUInt32LE(out.length, 0);
  return out;
}

// ---------- the deck's fonts ----------
// faceFor(family, weight, italic) -> { name, bold, italic } to write on a text run, after
// prepare() has fetched what the deck uses. files() lists what to embed.
export function createFonts({ log = () => {} } = {}) {
  const wanted = new Map(); // "family|weight|italic" -> { family, weight, italic }
  const chosen = new Map(); // same key -> { name, bold, italic, file }
  const fonts = new Map(); // legacy family name -> { regular, bold, italic, boldItalic }
  const skipped = new Set();
  const key = (family, weight, italic) => `${family}|${weight}|${italic ? 1 : 0}`;
  return {
    use(family, weight = 400, italic = false) {
      if (family) wanted.set(key(family, weight, italic), { family, weight, italic });
    },
    async prepare() {
      for (const [k, w] of wanted) {
        const list = await stylesOf(w.family);
        if (!list || !list.length) {
          skipped.add(w.family);
          continue;
        }
        const face = pick(list, w.weight, w.italic);
        try {
          const css = await get(
            `https://fonts.googleapis.com/css2?family=${encodeURIComponent(w.family).replace(/%20/g, "+")}:ital,wght@${face.italic ? 1 : 0},${face.weight}`,
            7 * 86400000,
          );
          const url = faces(css.toString("utf8"))[0]?.url;
          if (!url) throw new Error("no TrueType file");
          const buf = await get(url);
          const f = readFont(buf);
          if (!f.truetype || f.fsType & 0x0002) throw new Error("can't be embedded");
          const bold = /bold/i.test(f.style);
          const italic = /italic|oblique/i.test(f.style);
          const slot = bold ? (italic ? "boldItalic" : "bold") : italic ? "italic" : "regular";
          const entry = fonts.get(f.family) || {};
          entry[slot] ||= { data: toEot(buf, f), bytes: buf.length };
          fonts.set(f.family, entry);
          chosen.set(k, { name: f.family, bold, italic });
        } catch (e) {
          log(`Fonts: couldn't embed ${w.family} ${w.weight}${w.italic ? " italic" : ""} (${e.message})`);
          skipped.add(w.family);
        }
      }
    },
    faceFor(family, weight = 400, italic = false) {
      return chosen.get(key(family, weight, italic)) || null;
    },
    embedded: () => fonts,
    skipped: () => [...skipped],
  };
}

// Writes the fonts into the package: ppt/fonts/fontN.fntdata, their relationships, the
// content type and <p:embeddedFontLst> in presentation.xml (right after <p:notesSz>).
export async function embedFonts(zip, fonts) {
  if (!fonts.size) return 0;
  const relsPath = "ppt/_rels/presentation.xml.rels";
  let rels = await zip.file(relsPath).async("string");
  let pres = await zip.file("ppt/presentation.xml").async("string");
  let types = await zip.file("[Content_Types].xml").async("string");
  let n = 0;
  const list = [];
  for (const [name, slots] of fonts) {
    let entry = `<p:embeddedFont><p:font typeface="${name.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" charset="0"/>`;
    for (const slot of ["regular", "bold", "italic", "boldItalic"]) {
      if (!slots[slot]) continue;
      n++;
      zip.file(`ppt/fonts/font${n}.fntdata`, slots[slot].data);
      rels = rels.replace(
        "</Relationships>",
        `<Relationship Id="rIdFont${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font${n}.fntdata"/></Relationships>`,
      );
      entry += `<p:${slot} r:id="rIdFont${n}"/>`;
    }
    list.push(entry + "</p:embeddedFont>");
  }
  if (!/Extension="fntdata"/.test(types))
    types = types.replace(/(<Types[^>]*>)/, `$1<Default Extension="fntdata" ContentType="application/x-fontdata"/>`);
  pres = pres.replace(/<p:presentation\b/, (m) => `${m} embedTrueTypeFonts="1"`);
  const lst = `<p:embeddedFontLst>${list.join("")}</p:embeddedFontLst>`;
  if (/<p:notesSz[^>]*\/>/.test(pres)) pres = pres.replace(/(<p:notesSz[^>]*\/>)/, `$1${lst}`);
  else pres = pres.replace(/(<p:defaultTextStyle)/, `${lst}$1`);
  if (!/xmlns:r=/.test(pres))
    pres = pres.replace(/<p:presentation\b/, '<p:presentation xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
  zip.file(relsPath, rels);
  zip.file("ppt/presentation.xml", pres);
  zip.file("[Content_Types].xml", types);
  return n;
}
