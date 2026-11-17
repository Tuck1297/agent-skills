/*!
 * html-slides engine: turns <main class="deck"> and its <section class="slide"> children into a
 * presentation. No dependencies. Full reference: references/engine.md in the html-slides skill.
 */
(() => {
  "use strict";

  const W = 1920;
  const H = 1080;
  const doc = document;
  const root = doc.documentElement;
  const stage = doc.querySelector(".deck");
  if (!stage) {
    console.warn('[deck] no <main class="deck"> on this page');
    return;
  }

  // The page as written, before the engine changes anything. The data editor's
  // "Download deck" writes new values into this copy.
  const PRISTINE = "<!doctype html>\n" + root.outerHTML;
  const params = new URLSearchParams(location.search);

  // Theme id -> Google Fonts query. scripts/new-deck.mjs reads this object: keep it plain JSON.
  const THEME_FONTS = {
    corporate:
      "family=Plus+Jakarta+Sans:wght@500;700;800&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400",
    minimal: "family=Archivo:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400",
    keynote:
      "family=Sora:wght@400;600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400",
    pitch:
      "family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400",
    editorial:
      "family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500",
    academic:
      "family=Libre+Franklin:wght@400;600;700;800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400",
    playful:
      "family=Fredoka:wght@400..700&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400",
    elegant:
      "family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500",
  };
  const THEME_NAMES = {
    corporate: "Corporate",
    minimal: "Minimal",
    keynote: "Bold keynote",
    pitch: "Startup pitch",
    editorial: "Editorial",
    academic: "Academic",
    playful: "Playful",
    elegant: "Elegant",
  };
  const THEMES = Object.keys(THEME_FONTS);
  const MOTIONS = ["none", "subtle", "moderate", "heavy"];
  const ICONS = window.DECK_ICONS || {};

  const issues = [];
  const missing = new Set();
  const slideNo = (el) => {
    const s = el && el.closest && el.closest(".slide");
    return s ? Number(s.dataset.n) || undefined : undefined;
  };
  const warn = (kind, message, slide) => {
    issues.push({ kind, message, slide });
    console.warn(`[deck] ${message}`);
  };
  addEventListener("error", (e) => {
    if (e.message) warn("js", e.message);
  });

  // ---------------------------------------------------------------------------
  // Data list: <script type="application/json" id="deck-data"> fills {{path}} tokens.
  // ---------------------------------------------------------------------------

  const dataEl = doc.getElementById("deck-data");
  const DATA_SRC = dataEl ? dataEl.textContent : "";
  const STORE_KEY = "deck-data:" + location.pathname;
  const hash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  };
  const store = {
    get() {
      try {
        return JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      } catch {
        return null;
      }
    },
    set(value) {
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        sessionStorage.removeItem(STORE_KEY);
      } catch {
        /* storage blocked: nothing to clear */
      }
    },
  };

  let data = {};
  try {
    data = DATA_SRC.trim() ? JSON.parse(DATA_SRC) : {};
  } catch (e) {
    warn("data", "deck-data is not valid JSON: " + e.message);
  }
  // Values applied from the data editor (E) last until the file's own list changes.
  const edited = store.get();
  const usingEdits = !!(edited && edited.src === hash(DATA_SRC) && edited.data);
  if (usingEdits) data = edited.data;

  const locale = () => data.locale || navigator.language || "en-US";
  const toNum = (v) => {
    if (typeof v === "number") return v;
    if (typeof v !== "string") return NaN;
    const s = v.replace(/[,\s$€£¥%]/g, "");
    return s === "" ? NaN : Number(s);
  };
  const fixed = (d) =>
    d === undefined || d === "" || isNaN(+d) ? undefined : +d;
  function fmtNumber(v, digits) {
    const n = toNum(v);
    if (isNaN(n)) return v;
    const d = fixed(digits);
    return new Intl.NumberFormat(
      locale(),
      d === undefined
        ? { maximumFractionDigits: 2 }
        : { minimumFractionDigits: d, maximumFractionDigits: d },
    ).format(n);
  }
  // money:EUR picks a currency, money:0 sets the decimals, money:EUR:0 both.
  function fmtMoney(v, arg) {
    const n = toNum(v);
    if (isNaN(n)) return v;
    let currency = data.currency || "USD";
    let cents = Number.isInteger(n) ? 0 : 2;
    for (const part of String(arg || "").split(/[:,\s]+/)) {
      if (/^[A-Za-z]{3}$/.test(part)) currency = part.toUpperCase();
      else if (/^\d$/.test(part)) cents = Number(part);
    }
    try {
      return new Intl.NumberFormat(locale(), {
        style: "currency",
        currency,
        minimumFractionDigits: cents,
        maximumFractionDigits: cents,
      }).format(n);
    } catch {
      warn("data", `"${currency}" is not a currency code; showing USD`);
      return new Intl.NumberFormat(locale(), {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: cents,
      }).format(n);
    }
  }
  function fmtCompact(v) {
    const n = toNum(v);
    return isNaN(n)
      ? v
      : new Intl.NumberFormat(locale(), {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(n);
  }
  function toDate(v) {
    if (v instanceof Date) return v;
    const s = String(v).trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (s === "today") return today;
    let m = s.match(/^([+-]\d+)\s*([dwmy])$/i);
    if (m) {
      const n = Number(m[1]);
      const d = new Date(today);
      const unit = m[2].toLowerCase();
      if (unit === "d") d.setDate(d.getDate() + n);
      else if (unit === "w") d.setDate(d.getDate() + 7 * n);
      else if (unit === "m") d.setMonth(d.getMonth() + n);
      else d.setFullYear(d.getFullYear() + n);
      return d;
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const DATE_STYLES = {
    long: { dateStyle: "long" },
    medium: { dateStyle: "medium" },
    short: { month: "short", day: "numeric" },
    numeric: { dateStyle: "short" },
    month: { month: "long", year: "numeric" },
    weekday: { weekday: "long", month: "long", day: "numeric" },
    year: { year: "numeric" },
  };
  function fmtDate(v, style) {
    const d = toDate(v);
    return d
      ? new Intl.DateTimeFormat(
          locale(),
          DATE_STYLES[style] || DATE_STYLES.long,
        ).format(d)
      : v;
  }
  function format(v, kind, arg) {
    if (kind === "money") return fmtMoney(v, arg);
    if (kind === "percent")
      return isNaN(toNum(v)) ? v : fmtNumber(v, arg) + "%";
    if (kind === "compact") return fmtCompact(v);
    if (kind === "date") return fmtDate(v, arg);
    if (kind === "number") return fmtNumber(v, arg);
    return v;
  }

  const FILTERS = {
    money: fmtMoney,
    number: fmtNumber,
    compact: fmtCompact,
    date: fmtDate,
    percent: (v, d) => format(v, "percent", d),
    upper: (v) => String(v).toUpperCase(),
    lower: (v) => String(v).toLowerCase(),
    count: (v) =>
      Array.isArray(v)
        ? v.length
        : v && typeof v === "object"
          ? Object.keys(v).length
          : 0,
    sum: (v, key) =>
      Array.isArray(v)
        ? v.reduce((total, x) => total + (toNum(key ? x && x[key] : x) || 0), 0)
        : v,
    join: (v, sep) =>
      Array.isArray(v) ? v.join(sep === undefined ? ", " : sep) : v,
    first: (v) => (Array.isArray(v) ? v[0] : v),
    last: (v) => (Array.isArray(v) ? v[v.length - 1] : v),
    initials: (v) =>
      String(v)
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    default: (v, d) => (v === undefined || v === null || v === "" ? d : v),
  };

  const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;
  function lookup(scope, path) {
    let v = scope;
    for (const key of path.split(".")) {
      if (v === undefined || v === null) return undefined;
      v = v[key];
    }
    return v;
  }
  function evaluate(expr, scope) {
    const parts = expr.match(/(?:[^|"']+|"[^"]*"|'[^']*')+/g) || [""];
    const path = parts[0].trim();
    let v;
    if (/^-?\d+(\.\d+)?$/.test(path)) v = Number(path);
    else if (/^(["']).*\1$/.test(path)) v = path.slice(1, -1);
    else v = lookup(scope, path);
    for (const pipe of parts.slice(1)) {
      const i = pipe.indexOf(":");
      const name = (i < 0 ? pipe : pipe.slice(0, i)).trim();
      let arg = i < 0 ? undefined : pipe.slice(i + 1).trim();
      if (arg && /^(["']).*\1$/.test(arg)) arg = arg.slice(1, -1);
      const f = FILTERS[name];
      if (!f) {
        warn("data", `unknown filter "${name}" in {{${expr}}}`);
        continue;
      }
      if (v === undefined && name !== "default") continue;
      v = f(v, arg);
    }
    return v;
  }
  function fill(text, scope) {
    return text.replace(TOKEN, (whole, expr) => {
      const v = evaluate(expr, scope);
      if (v === undefined) {
        missing.add(expr.split("|")[0].trim());
        return whole;
      }
      if (v === null) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }

  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "TEMPLATE"]);
  function renderTree(node, scope) {
    if (node.nodeType === 3) {
      if (node.nodeValue.includes("{{"))
        node.nodeValue = fill(node.nodeValue, scope);
      return;
    }
    if (
      node.nodeType !== 1 ||
      SKIP.has(node.tagName) ||
      node.hasAttribute("data-raw")
    )
      return;
    for (const a of [...node.attributes]) {
      if (a.name !== "data-each" && a.value.includes("{{"))
        a.value = fill(a.value, scope);
    }
    if (node.hasAttribute("data-each")) return expandEach(node, scope);
    // data-src="{{photo}}": the browser fetches a plain src="{{photo}}" as the page loads,
    // before it's filled in, so a value from the data list goes in data-src (or
    // data-srcset, data-poster) and becomes the real attribute here.
    for (const name of ["src", "srcset", "poster"]) {
      const v = node.getAttribute("data-" + name);
      if (v !== null && !v.includes("{{")) {
        node.setAttribute(name, v);
        node.removeAttribute("data-" + name);
      }
    }
    for (const child of [...node.childNodes]) {
      // <template data-each="..."> repeats its content in its own place, so a list in the
      // data can make whole slides (a template straight inside .deck).
      if (
        child.nodeType === 1 &&
        child.tagName === "TEMPLATE" &&
        child.hasAttribute("data-each")
      ) {
        // Built in the template's inert document, so nothing loads (an <img> with
        // src="{{x}}") until its values are filled in.
        const holder = child.content.ownerDocument.createElement("div");
        holder.setAttribute("data-each", child.getAttribute("data-each"));
        if (child.hasAttribute("data-limit"))
          holder.setAttribute("data-limit", child.getAttribute("data-limit"));
        holder.append(child.content.cloneNode(true));
        expandEach(holder, scope);
        child.replaceWith(...holder.childNodes);
      } else renderTree(child, scope);
    }
  }
  function expandEach(el, scope) {
    const spec = el.getAttribute("data-each").trim();
    const m = spec.match(/^([A-Za-z_$][\w$]*)\s+in\s+(.+)$/);
    const alias = m ? m[1] : "item";
    const path = (m ? m[2] : spec).trim();
    let list = evaluate(path, scope);
    if (list === undefined) {
      missing.add(path);
      list = [];
    }
    if (list && !Array.isArray(list) && typeof list === "object") {
      list = Object.entries(list).map(([key, value]) => ({ key, value }));
    }
    if (!Array.isArray(list)) list = [list];
    const limit = parseInt(el.getAttribute("data-limit"), 10);
    if (limit >= 0) list = list.slice(0, limit);
    const tpl = doc.createElement("template");
    tpl.innerHTML = el.innerHTML;
    el.textContent = "";
    list.forEach((item, index) => {
      const s = Object.create(scope);
      Object.assign(s, { [alias]: item, index, n: index + 1 });
      const frag = tpl.content.cloneNode(true);
      for (const child of [...frag.childNodes]) renderTree(child, s);
      el.append(frag);
    });
  }

  // ---------------------------------------------------------------------------
  // Slides: setup of steps, animations, icons, morph names and charts.
  // ---------------------------------------------------------------------------

  let slides = [];
  let cur = -1;
  let motion = "moderate";
  const isStatic = () =>
    root.classList.contains("is-static") || motion === "none";

  function moveAnimToChildren(box) {
    const anim = box.getAttribute("data-anim");
    if (anim !== null) {
      box.setAttribute("data-anim-children", anim);
      box.removeAttribute("data-anim");
    }
    return box.getAttribute("data-anim-children");
  }

  function splitText(el) {
    const mode = el.getAttribute("data-split") || "words";
    const anim = moveAnimToChildren(el) || "rise";
    let k = 0;
    const tag = (span) => {
      span.style.setProperty("--i", k++);
      span.setAttribute("data-anim", anim);
    };
    const walk = (node) => {
      for (const c of [...node.childNodes]) {
        if (c.nodeType === 1) {
          walk(c);
          continue;
        }
        if (c.nodeType !== 3 || !c.nodeValue.trim()) continue;
        const frag = doc.createDocumentFragment();
        for (const part of c.nodeValue.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(part);
            continue;
          }
          const word = doc.createElement("span");
          word.className = "w";
          if (mode === "chars") {
            for (const ch of part) {
              const span = doc.createElement("span");
              span.className = "ch";
              span.textContent = ch;
              tag(span);
              word.append(span);
            }
          } else {
            word.textContent = part;
            tag(word);
          }
          frag.append(word);
        }
        c.replaceWith(frag);
      }
    };
    walk(el);
    const ms = parseFloat(el.getAttribute("data-stagger"));
    el.style.setProperty(
      "--stagger",
      (isNaN(ms) ? (mode === "chars" ? 30 : 75) : ms) + "ms",
    );
  }

  // data-enter="cascade" (deck or slide): the slide's blocks flow in one after another
  // when it appears. Elements with their own data-anim, builds or steps are left alone.
  const CASCADE_UNIT =
    ".kicker, h1, h2, h3, h4, p, .lead, .card, .stat, li, figure, img, svg, video, table, blockquote, .quote, .chart, .pill, .callout, .definition, .meter, .device-phone, .device-browser, .device-laptop, .icon, .avatar, .code, pre, .btn, .button";
  const CASCADE_SKIP =
    ".notes, .slide-chrome, .blob, .bleed, [data-bleed], [data-decor], [data-when], [data-anim], [data-steps], [data-step], [data-stagger], [data-split], .deck-annot, script, style, template";
  const CASCADE_BUSY =
    "[data-anim], [data-steps], [data-step], [data-stagger], [data-split]";
  function cascade(s) {
    let n = 0;
    const walk = (box) => {
      for (const el of box.children) {
        if (el.matches(CASCADE_SKIP)) continue;
        const unit =
          el.matches(CASCADE_UNIT) ||
          (!el.children.length && el.textContent.trim());
        if (unit && !el.querySelector(CASCADE_BUSY)) {
          el.setAttribute("data-cascade", "");
          el.style.setProperty("--ci", String(Math.min(n++, 14)));
        } else if (el.children.length) walk(el);
      }
    };
    walk(s);
  }

  function setupSlide(s, i) {
    s.dataset.n = String(i + 1);

    for (const el of s.querySelectorAll("[data-split]")) splitText(el);

    // data-steps: each child is a click step. data-stagger: children enter one after another.
    for (const box of s.querySelectorAll(
      "[data-steps], [data-stagger]:not([data-split])",
    )) {
      const childAnim = moveAnimToChildren(box);
      const kids = [...box.children].filter(
        (c) => !c.classList.contains("notes"),
      );
      kids.forEach((c, k) => {
        if (childAnim && !c.hasAttribute("data-anim"))
          c.setAttribute("data-anim", childAnim);
        if (box.hasAttribute("data-steps") && !c.hasAttribute("data-step"))
          c.setAttribute("data-step", "");
        if (box.hasAttribute("data-stagger")) c.style.setProperty("--i", k);
      });
      const ms = parseFloat(box.getAttribute("data-stagger"));
      if (!isNaN(ms)) box.style.setProperty("--stagger", ms + "ms");
    }

    for (const el of s.querySelectorAll("[data-delay]")) {
      const ms = parseFloat(el.getAttribute("data-delay"));
      if (!isNaN(ms)) el.style.setProperty("--delay", ms + "ms");
    }
    for (const el of s.querySelectorAll("[data-duration]")) {
      const ms = parseFloat(el.getAttribute("data-duration"));
      if (!isNaN(ms) && !el.hasAttribute("data-count"))
        el.style.setProperty("--dur", ms + "ms");
    }
    for (const el of s.querySelectorAll("[data-depth]")) {
      el.style.setProperty(
        "--depth",
        parseFloat(el.getAttribute("data-depth")) || 0.5,
      );
    }

    // Shapes inside data-anim="draw" are stroked on, one after another if data-draw-stagger is set.
    for (const el of s.querySelectorAll('[data-anim="draw"]')) {
      const shapes = el.matches(
        "path, line, polyline, polygon, circle, ellipse, rect",
      )
        ? [el]
        : el.querySelectorAll(
            "path, line, polyline, polygon, circle, ellipse, rect",
          );
      const gap = parseFloat(el.getAttribute("data-draw-stagger")) || 0;
      shapes.forEach((p, k) => {
        p.setAttribute("pathLength", "1");
        p.classList.add("draw");
        p.style.setProperty("--draw-delay", k * gap + "ms");
      });
    }

    // Morph: elements with the same data-morph on two slides glide between them.
    const names = new Set();
    for (const el of s.querySelectorAll("[data-morph]")) {
      const raw = el.getAttribute("data-morph").trim();
      const name = "m-" + raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
      if (names.has(name) && !el.closest("[data-when]"))
        warn(
          "morph",
          `two elements on one slide share data-morph="${raw}"`,
          i + 1,
        );
      names.add(name);
      el.style.viewTransitionName = name;
    }

    // Steps: data-step="" takes the next number; data-step="3" joins step 3; data-exit="n" leaves at step n.
    // data-step="0" is shown from the start (handy in a data-each list: data-step="{{index}}").
    const steps = [];
    const exits = [...s.querySelectorAll("[data-exit]")];
    let auto = 0;
    const order = new Set();
    for (const el of s.querySelectorAll("[data-step]")) {
      if (el.closest(".notes")) continue;
      const v = el.getAttribute("data-step").trim();
      let n = v === "" ? NaN : Number(v);
      if (n === 0) {
        el.classList.add("is-shown");
        continue;
      }
      if (isNaN(n)) n = ++auto;
      else auto = Math.max(auto, n);
      el.__n = n;
      order.add(n);
      steps.push(el);
    }
    for (const el of exits) {
      const n = Number(el.getAttribute("data-exit"));
      if (!isNaN(n)) {
        el.__exit = n;
        order.add(n);
      }
    }
    s.__order = [...order].sort((a, b) => a - b);
    s.__steps = steps;
    s.__exits = exits;
    s.__step = 0;
    const enterMode =
      s.getAttribute("data-enter") || stage.getAttribute("data-enter");
    if (enterMode === "cascade") cascade(s);

    // Footer line and slide number, if the theme shows them (.deck data-footer="..."), and
    // the deck's logo (data-logo="...") at the start of that row in every theme.
    // data-logo-invert is the version for dark slides (.invert, .on-accent).
    const footer = stage.getAttribute("data-footer");
    if (!s.querySelector(":scope > .slide-chrome")) {
      const chrome = doc.createElement("footer");
      chrome.className = "slide-chrome";
      chrome.setAttribute("aria-hidden", "true");
      chrome.innerHTML = `<span class="slide-footer"></span><span class="slide-num"></span>`;
      chrome.firstChild.textContent = footer || "";
      chrome.lastChild.textContent = String(i + 1);
      const dark = s.matches(".invert, .on-accent");
      const logo =
        (dark && stage.getAttribute("data-logo-invert")) ||
        stage.getAttribute("data-logo");
      if (logo && !s.classList.contains("no-logo")) {
        const img = doc.createElement("img");
        img.className = "slide-logo";
        img.alt = "";
        img.src = logo;
        chrome.prepend(img);
        chrome.classList.add("has-logo");
      }
      s.append(chrome);
    }
  }

  // Icons are react-icons names (FaRocket, MdOutlineSavings, LuChartLine...). scripts/icons.mjs
  // renders the ones a deck uses into engine/icons.js as SVG markup.
  function setupIcons() {
    for (const el of stage.querySelectorAll("[data-icon]")) {
      const name = el.getAttribute("data-icon").trim();
      const svg = ICONS[name];
      if (!svg) {
        warn(
          "icon",
          `icon "${name}" is not in engine/icons.js: run scripts/icons.mjs on this deck, or check the react-icons name`,
          slideNo(el),
        );
        continue;
      }
      el.innerHTML = svg;
    }
  }

  // ---------------------------------------------------------------------------
  // Charts: <div data-chart="bar|hbar|line|area|donut|pie" data-labels='[...]' data-values='[...]'>
  // ---------------------------------------------------------------------------

  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const r1 = (n) => Math.round(n * 10) / 10;
  const parseList = (s, fallback) => {
    if (s === null || s === undefined || s.trim() === "") return fallback;
    try {
      return JSON.parse(s);
    } catch {
      return s.split(",").map((x) => x.trim());
    }
  };
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10])
      if (m * p >= v * 1.04) return m * p;
    return 10 * p;
  }
  function topBar(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    return `M${r1(x)},${r1(y + h)}V${r1(y + r)}Q${r1(x)},${r1(y)} ${r1(x + r)},${r1(y)}H${r1(x + w - r)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + r)}V${r1(y + h)}Z`;
  }
  function rightBar(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, h / 2, w));
    return `M${r1(x)},${r1(y)}H${r1(x + w - r)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + r)}V${r1(y + h - r)}Q${r1(x + w)},${r1(y + h)} ${r1(x + w - r)},${r1(y + h)}H${r1(x)}Z`;
  }
  function smoothPath(pts) {
    if (pts.length < 3)
      return pts
        .map((p, i) => (i ? "L" : "M") + r1(p[0]) + "," + r1(p[1]))
        .join("");
    let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
    }
    return d;
  }

  function drawChart(el) {
    const type = (el.getAttribute("data-chart") || "bar").trim();
    const labels = parseList(el.getAttribute("data-labels"), []);
    let series = parseList(el.getAttribute("data-series"), null);
    if (!Array.isArray(series)) {
      series = [
        {
          name: el.getAttribute("data-name") || "",
          values: parseList(el.getAttribute("data-values"), []),
        },
      ];
    }
    series = series.map((s, k) => ({
      name: s.name === undefined ? "" : s.name,
      values: (s.values || []).map(toNum),
      color: s.color,
      cls: "c" + ((k % 6) + 1),
    }));
    const kind = el.getAttribute("data-format") || "number";
    const arg = el.getAttribute("data-format-arg");
    const fmt = (v) => format(v, kind, arg === null ? undefined : arg);
    let hi = el.getAttribute("data-highlight");
    if (hi !== null) hi = isNaN(+hi) ? labels.indexOf(hi) : +hi;
    const showValues = el.getAttribute("data-show-values") !== "false";
    const w = Math.max(240, Math.round(el.clientWidth) || 960);
    const h = Math.max(160, Math.round(el.clientHeight) || 520);
    el.__size = w + "x" + h;
    el.classList.add("chart", "chart-" + type);
    const n = Math.max(labels.length, ...series.map((s) => s.values.length));
    const all = series.flatMap((s) => s.values).filter((v) => !isNaN(v));
    const muted = (i) => (hi !== null && hi >= 0 && i !== hi ? " muted" : "");
    const style = (k, s) =>
      `--i:${k}${s.color ? ";fill:" + s.color + ";stroke:" + s.color : ""}`;
    let svg = "";
    let legend = "";

    if (type === "donut" || type === "pie") {
      const s = series[0];
      const vals = s.values.map((v) => (isNaN(v) ? 0 : Math.max(0, v)));
      const total = vals.reduce((a, b) => a + b, 0) || 1;
      const size = Math.min(h, w * 0.6);
      const R = size / 2 - 6;
      const thick = type === "pie" ? R : Math.max(28, R * 0.3);
      const rc = R - thick / 2;
      const c = size / 2;
      let acc = 0;
      svg = `<svg viewBox="0 0 ${r1(size)} ${r1(size)}" width="${r1(size)}" height="${r1(size)}" role="img">`;
      vals.forEach((v, i) => {
        const pct = (v / total) * 100;
        const color = series[i] && series[i].color;
        svg += `<circle class="slice c${(i % 6) + 1}${muted(i)}" cx="${r1(c)}" cy="${r1(c)}" r="${r1(rc)}" pathLength="100" stroke-width="${r1(thick)}" transform="rotate(-90 ${r1(c)} ${r1(c)})" style="--i:${i};stroke-dasharray:${r1(pct)} ${r1(100 - pct)};stroke-dashoffset:${r1(-acc)}${color ? ";stroke:" + color : ""}"/>`;
        acc += pct;
      });
      if (type === "donut") {
        const center = el.getAttribute("data-center");
        const sub = el.getAttribute("data-center-label");
        svg += `<text class="donut-value" x="${r1(c)}" y="${r1(c + (sub ? 6 : 16))}" text-anchor="middle" style="font-size:${r1(rc * 0.42)}px">${esc(center === null ? fmt(total) : center)}</text>`;
        if (sub)
          svg += `<text class="donut-label" x="${r1(c)}" y="${r1(c + rc * 0.34)}" text-anchor="middle">${esc(sub)}</text>`;
      }
      svg += "</svg>";
      legend = `<ul class="chart-legend">${vals
        .map(
          (v, i) =>
            `<li class="c${(i % 6) + 1}${muted(i)}" style="--i:${i}"><i></i><span class="lg-label">${esc(labels[i] === undefined ? "" : labels[i])}</span><span class="lg-value">${esc(fmt(v))}</span><span class="lg-pct">${Math.round((v / total) * 100)}%</span></li>`,
        )
        .join("")}</ul>`;
    } else if (type === "hbar") {
      const max =
        toNum(el.getAttribute("data-max")) || niceMax(Math.max(0, ...all));
      const labelW = Math.min(w * 0.32, 420);
      const valueW = showValues ? 140 : 12;
      const pw = w - labelW - valueW;
      const band = h / n;
      const inner = band * 0.62;
      const bh = inner / series.length;
      svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">`;
      for (let i = 0; i < n; i++) {
        const y0 = band * i + (band - inner) / 2;
        svg += `<text class="cat${muted(i)}" x="${r1(labelW - 24)}" y="${r1(band * i + band / 2 + 8)}" text-anchor="end">${esc(labels[i] === undefined ? "" : labels[i])}</text>`;
        series.forEach((s, k) => {
          const v = s.values[i];
          if (isNaN(v)) return;
          const bw = Math.max(2, (pw * Math.max(0, v)) / max);
          const y = y0 + bh * k;
          const idx = i * series.length + k;
          svg += `<path class="bar ${s.cls}${muted(i)}" d="${rightBar(labelW, y + 2, bw, bh - 4, 8)}" style="${style(idx, s)}"/>`;
          if (showValues)
            svg += `<text class="val${muted(i)}" x="${r1(labelW + bw + 16)}" y="${r1(y + bh / 2 + 8)}" style="--i:${idx}">${esc(fmt(v))}</text>`;
        });
      }
      svg += `<line class="axis" x1="${r1(labelW)}" x2="${r1(labelW)}" y1="0" y2="${h}"/></svg>`;
    } else if (type === "line" || type === "area") {
      const lo = Math.min(...all);
      let max = toNum(el.getAttribute("data-max"));
      if (isNaN(max)) max = niceMax(Math.max(...all));
      let min = toNum(el.getAttribute("data-min"));
      if (isNaN(min)) min = lo >= 0 ? 0 : -niceMax(-lo);
      const top = 36;
      const bottom = 60;
      const left = 96;
      const right = showValues ? 120 : 32;
      const pw = w - left - right;
      const ph = h - top - bottom;
      const x = (i) => left + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
      const y = (v) => top + ph * (1 - (v - min) / (max - min || 1));
      svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">`;
      for (let t = 0; t <= 4; t++) {
        const v = min + ((max - min) * t) / 4;
        svg += `<line class="grid" x1="${left}" x2="${r1(w - right)}" y1="${r1(y(v))}" y2="${r1(y(v))}"/><text class="tick" x="${left - 18}" y="${r1(y(v) + 8)}" text-anchor="end">${esc(fmt(v))}</text>`;
      }
      const smooth = el.hasAttribute("data-smooth");
      series.forEach((s, k) => {
        const pts = s.values.map((v, i) => [x(i), y(isNaN(v) ? min : v)]);
        if (!pts.length) return;
        const d = smooth
          ? smoothPath(pts)
          : pts
              .map((p, i) => (i ? "L" : "M") + r1(p[0]) + "," + r1(p[1]))
              .join("");
        if (type === "area") {
          svg += `<path class="area ${s.cls}" d="${d}L${r1(pts[pts.length - 1][0])},${r1(y(min))}L${r1(pts[0][0])},${r1(y(min))}Z" style="${style(k, s)}"/>`;
        }
        svg += `<path class="line ${s.cls}" d="${d}" pathLength="1" style="${style(k, s)}"/>`;
        pts.forEach((p, i) => {
          svg += `<circle class="dot ${s.cls}${muted(i)}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="7" style="${style(i, s)}"/>`;
        });
        if (showValues) {
          const last = pts[pts.length - 1];
          svg += `<text class="val end ${s.cls}" x="${r1(last[0] + 18)}" y="${r1(last[1] + 8)}" style="--i:${n}">${esc(fmt(s.values[s.values.length - 1]))}</text>`;
        }
      });
      for (let i = 0; i < n; i++) {
        svg += `<text class="cat${muted(i)}" x="${r1(x(i))}" y="${h - 16}" text-anchor="middle">${esc(labels[i] === undefined ? "" : labels[i])}</text>`;
      }
      svg += "</svg>";
    } else {
      const lo = Math.min(0, ...all);
      const max =
        toNum(el.getAttribute("data-max")) || niceMax(Math.max(0, ...all));
      const min = lo < 0 ? -niceMax(-lo) : 0;
      const top = showValues ? 52 : 16;
      const bottom = 60;
      const ph = h - top - bottom;
      const y = (v) => top + ph * (1 - (v - min) / (max - min || 1));
      const band = w / n;
      const inner = band * (series.length > 1 ? 0.74 : 0.6);
      const bw = inner / series.length;
      svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">`;
      for (let i = 0; i < n; i++) {
        const x0 = band * i + (band - inner) / 2;
        series.forEach((s, k) => {
          const v = s.values[i];
          if (isNaN(v)) return;
          const x = x0 + bw * k;
          const idx = i * series.length + k;
          const gap = series.length > 1 ? 4 : 0;
          if (v >= 0) {
            svg += `<path class="bar ${s.cls}${muted(i)}" d="${topBar(x + gap, y(v), bw - gap * 2, y(0) - y(v), Math.min(10, bw / 5))}" style="${style(idx, s)}"/>`;
          } else {
            svg += `<rect class="bar neg ${s.cls}${muted(i)}" x="${r1(x + gap)}" y="${r1(y(0))}" width="${r1(bw - gap * 2)}" height="${r1(y(v) - y(0))}" style="${style(idx, s)}"/>`;
          }
          if (showValues) {
            svg += `<text class="val${muted(i)}" x="${r1(x + bw / 2)}" y="${r1(v >= 0 ? y(v) - 16 : y(v) + 34)}" text-anchor="middle" style="--i:${idx}">${esc(fmt(v))}</text>`;
          }
        });
        svg += `<text class="cat${muted(i)}" x="${r1(band * i + band / 2)}" y="${h - 16}" text-anchor="middle">${esc(labels[i] === undefined ? "" : labels[i])}</text>`;
      }
      svg += `<line class="axis" x1="0" x2="${w}" y1="${r1(y(0))}" y2="${r1(y(0))}"/></svg>`;
    }

    if (!legend && series.length > 1) {
      legend = `<ul class="chart-legend">${series
        .map(
          (s, k) =>
            `<li class="${s.cls}"${s.color ? ` style="--swatch:${s.color}"` : ""}><i></i>${esc(s.name)}</li>`,
        )
        .join("")}</ul>`;
    }
    el.innerHTML = svg + legend;
  }

  function renderCharts(onlyIfResized) {
    const charts = [...stage.querySelectorAll("[data-chart]")];
    const measuring = root.classList.contains("is-measuring");
    root.classList.add("is-measuring");
    for (const el of charts) {
      if (onlyIfResized && el.__size) {
        // Sizes are taken with the chart empty, as on the first pass.
        const saved = el.innerHTML;
        el.innerHTML = "";
        const size =
          Math.max(240, Math.round(el.clientWidth) || 960) +
          "x" +
          Math.max(160, Math.round(el.clientHeight) || 520);
        el.innerHTML = saved;
        if (size === el.__size) continue;
        el.innerHTML = "";
      }
      try {
        drawChart(el);
      } catch (e) {
        warn("chart", "chart failed: " + e.message, slideNo(el));
      }
    }
    fitText();
    drawAnnotations();
    if (!measuring) root.classList.remove("is-measuring");
  }

  // .stat-value and [data-fit] shrink to fit their width (with their final counter value);
  // the numbers in one .stats row share one size.
  function fitText() {
    const groups = new Map();
    for (const el of stage.querySelectorAll(".stat-value, [data-fit]")) {
      el.style.fontSize = "";
      const box = el.closest(".stats") || el;
      if (!groups.has(box)) groups.set(box, []);
      groups.get(box).push(el);
    }
    for (const els of groups.values()) {
      let k = 1;
      for (const el of els) {
        const counter = el.hasAttribute("data-count");
        const saved = counter ? el.innerHTML : null;
        if (counter) {
          const v = toNum(el.getAttribute("data-count"));
          if (!isNaN(v)) el.textContent = counterText(el, v);
        }
        const w = el.clientWidth;
        const sw = el.scrollWidth;
        if (counter) el.innerHTML = saved;
        if (w > 0 && sw > w + 1) k = Math.min(k, w / sw);
      }
      if (k < 1)
        for (const el of els) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          el.style.fontSize = Math.floor(size * k * 0.97) + "px";
        }
    }
  }

  // data-annotate="circle|underline|box|highlight|strike": a hand-drawn mark that draws
  // itself on when the element appears. Measured in layout pixels, so it stays put at any
  // window size. Color: data-annotate-color or --annot-color; data-annotate-delay (ms).
  function seeded(text) {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  function smooth(pts) {
    let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)},${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)},${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])},${r1(p2[1])}`;
    }
    return d;
  }
  function annotationPath(type, w, h, rnd) {
    const j = (n) => (rnd() - 0.5) * 2 * n;
    const wob = Math.max(2, h * 0.06);
    if (type === "circle") {
      const rx = w / 2 + Math.max(14, h * 0.32);
      const ry = h / 2 + Math.max(10, h * 0.24);
      const start = -2.2 + j(0.3);
      const pts = [];
      for (let k = 0; k <= 26; k++) {
        const a = start + (k / 26) * Math.PI * 2 * 1.07;
        const f = 1 + j(0.035);
        pts.push([w / 2 + Math.cos(a) * rx * f, h / 2 + Math.sin(a) * ry * f]);
      }
      return smooth(pts);
    }
    if (type === "box") {
      const p = Math.max(8, h * 0.16);
      const c = [
        [-p + j(wob), -p + j(wob)],
        [w + p + j(wob), -p + j(wob)],
        [w + p + j(wob), h + p + j(wob)],
        [-p + j(wob), h + p + j(wob)],
      ];
      const end = [
        [c[0][0] + j(wob), c[0][1] + j(wob)],
        [c[0][0] + (c[1][0] - c[0][0]) * 0.12, c[0][1] + j(wob)],
      ];
      return (
        `M${r1(c[0][0])},${r1(c[0][1])}` +
        c
          .slice(1)
          .concat(end)
          .map(([x, y]) => `L${r1(x)},${r1(y)}`)
          .join("")
      );
    }
    const y =
      type === "strike"
        ? h * 0.55
        : type === "highlight"
          ? h * 0.56
          : h + Math.max(5, h * 0.06);
    const pts = [];
    for (let k = 0; k <= 4; k++)
      pts.push([
        -4 + ((w + 8) * k) / 4,
        y + j(type === "highlight" ? wob / 2 : wob),
      ]);
    return smooth(pts);
  }
  function drawAnnotations() {
    for (const el of stage.querySelectorAll("[data-annotate]")) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) continue;
      const type = (el.getAttribute("data-annotate") || "underline").trim();
      const key = `${type} ${w}x${h}`;
      if (el.__annot === key) continue;
      el.__annot = key;
      const old = el.querySelector(":scope > .deck-annot");
      if (old) old.remove();
      const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "deck-annot is-" + type);
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const color = el.getAttribute("data-annotate-color");
      if (color) svg.style.color = color;
      const delay = parseFloat(el.getAttribute("data-annotate-delay"));
      if (!isNaN(delay)) svg.style.setProperty("--annot-delay", delay + "ms");
      if (type === "highlight")
        svg.style.setProperty("--annot-h", r1(h * 0.78) + "px");
      const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        annotationPath(type, w, h, seeded(el.textContent + type)),
      );
      path.setAttribute("pathLength", "1");
      svg.append(path);
      el.append(svg);
    }
  }

  // ---------------------------------------------------------------------------
  // Counters (data-count) and typing (data-anim="type").
  // ---------------------------------------------------------------------------

  function counterText(el, value) {
    const raw = el.getAttribute("data-count");
    const decimals = (String(raw).split(".")[1] || "").replace(
      /\D/g,
      "",
    ).length;
    const v = Number(value.toFixed(decimals));
    const kind = el.getAttribute("data-format");
    const arg = el.getAttribute("data-format-arg");
    let text;
    if (kind === "money") text = fmtMoney(v, arg || undefined);
    else if (kind === "percent") text = fmtNumber(v, decimals) + "%";
    else if (kind === "compact") text = fmtCompact(v);
    else if (kind === "plain") text = v.toFixed(decimals);
    else text = fmtNumber(v, decimals);
    return (
      (el.getAttribute("data-prefix") || "") +
      text +
      (el.getAttribute("data-suffix") || "")
    );
  }
  function startCounter(el) {
    cancelAnimationFrame(el.__raf);
    const to = toNum(el.getAttribute("data-count"));
    if (isNaN(to)) {
      warn(
        "count",
        `data-count="${el.getAttribute("data-count")}" is not a number`,
        slideNo(el),
      );
      return;
    }
    const from = toNum(el.getAttribute("data-from") || "0") || 0;
    if (isStatic()) {
      el.textContent = counterText(el, to);
      return;
    }
    const dur = parseFloat(el.getAttribute("data-duration")) || 1600;
    const delay = parseFloat(el.getAttribute("data-delay")) || 0;
    el.textContent = counterText(el, from);
    const t0 = performance.now() + delay;
    const tick = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = counterText(el, from + (to - from) * e);
      if (p < 1) el.__raf = requestAnimationFrame(tick);
    };
    el.__raf = requestAnimationFrame(tick);
  }
  function startTyping(el) {
    clearTimeout(el.__tt);
    if (el.__full === undefined) el.__full = el.textContent;
    const full = el.__full;
    if (isStatic()) {
      el.textContent = full;
      el.classList.remove("is-typing");
      return;
    }
    const speed = parseFloat(el.getAttribute("data-speed")) || 38;
    const delay = parseFloat(el.getAttribute("data-delay")) || 0;
    el.textContent = "";
    el.classList.add("is-typing");
    let k = 0;
    const step = () => {
      el.textContent = full.slice(0, ++k);
      if (k < full.length) el.__tt = setTimeout(step, speed);
      else el.__tt = setTimeout(() => el.classList.remove("is-typing"), 1200);
    };
    el.__tt = setTimeout(step, delay);
  }
  const playable = (el) => {
    for (let n = el; n && n !== stage; n = n.parentElement) {
      if (n.hasAttribute("data-step") && !n.classList.contains("is-shown"))
        return false;
      if (n.classList.contains("is-off")) return false;
    }
    return true;
  };
  function playWithin(box) {
    const all = (sel) =>
      (box.matches(sel) ? [box] : []).concat([...box.querySelectorAll(sel)]);
    for (const el of all("[data-count]")) if (playable(el)) startCounter(el);
    for (const el of all('[data-anim="type"]'))
      if (playable(el)) startTyping(el);
    for (const el of all("[data-tour]")) if (playable(el)) startTour(el);
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function applySteps(s, reveal) {
    const max = s.__step ? s.__order[s.__step - 1] : -Infinity;
    for (const el of s.__steps) {
      const on = el.__n <= max;
      if (on !== el.classList.contains("is-shown")) {
        el.classList.toggle("is-shown", on);
        if (on && reveal) playWithin(el);
      }
    }
    for (const el of s.__exits)
      el.classList.toggle("is-gone", el.__exit <= max);
    for (const box of s.querySelectorAll('[data-steps="focus"]')) {
      const shown = [...box.children].filter(
        (c) =>
          c.classList.contains("is-shown") && !c.classList.contains("is-gone"),
      );
      shown.forEach((c, k) =>
        c.classList.toggle("is-dim", k < shown.length - 1),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Library widgets. deck.mount(selector, init, {eager}) runs init(el, ctx) once
  // for each matching element, the first time its slide is shown (every slide
  // when printing, in the contact sheet, or with eager: true), after fonts and
  // images are ready. init may return (or resolve to) hooks:
  //   { enter(), leave(), theme(ctx) }  called on later visits and theme changes.
  // ctx: { slide, data, static, animate, motion, color(name), solid(name), colors(),
  //        css(name), font }. color() and solid() take a theme variable ("--accent") or
  //        any CSS color and return rgb()/rgba(); solid() is opaque (over the background).
  // ---------------------------------------------------------------------------

  const mounts = [];
  const pendingMounts = new Set();
  let probe = null;
  function resolveColor(el, value, over) {
    if (!value) return "";
    try {
      if (!probe) {
        probe = doc.createElement("canvas");
        probe.width = probe.height = 1;
      }
      const span = doc.createElement("span");
      span.style.color = value;
      span.style.display = "none";
      el.append(span);
      const css = getComputedStyle(span).color;
      span.remove();
      const g = probe.getContext("2d", { willReadFrequently: true });
      g.clearRect(0, 0, 1, 1);
      if (over) {
        g.fillStyle = resolveColor(el, over) || "#fff";
        g.fillRect(0, 0, 1, 1);
      }
      g.fillStyle = "#000";
      g.fillStyle = css;
      g.fillRect(0, 0, 1, 1);
      const [r, gg, b, a] = g.getImageData(0, 0, 1, 1).data;
      return a === 255
        ? `rgb(${r}, ${gg}, ${b})`
        : `rgba(${r}, ${gg}, ${b}, ${+(a / 255).toFixed(3)})`;
    } catch {
      return value;
    }
  }
  function mountCtx(el) {
    const quiet = isStatic() || /is-(print|sheet)/.test(root.className);
    const css = (name) => getComputedStyle(el).getPropertyValue(name).trim();
    return {
      slide: el.closest(".slide"),
      data,
      static: quiet,
      animate: !quiet && motion !== "none",
      motion,
      css,
      color: (name) =>
        resolveColor(el, name.startsWith("--") ? `var(${name})` : name),
      solid: (name) =>
        resolveColor(
          el,
          name.startsWith("--") ? `var(${name})` : name,
          "var(--bg)",
        ),
      colors: () =>
        [1, 2, 3, 4, 5, 6].map((n) => resolveColor(el, `var(--chart-${n})`)),
      font: css("--font-body"),
      // Resolves when the slide can be seen (after a sweep or reveal); start entrance
      // effects (confetti, a typed command) after it.
      get shown() {
        const s = el.closest(".slide");
        return (s && s.__shown) || Promise.resolve();
      },
    };
  }
  function mountEl(el, m) {
    if (!el.__mounts) el.__mounts = new Map();
    if (el.__mounts.has(m)) return;
    el.__mounts.set(m, {});
    el.setAttribute("data-mounted", "");
    const p = Promise.resolve(ready)
      .then(() => m.init(el, mountCtx(el)))
      .then((hooks) => {
        if (hooks && typeof hooks === "object") el.__mounts.set(m, hooks);
      })
      .catch((err) => console.error(`deck.mount("${m.selector}") failed:`, err))
      .finally(() => pendingMounts.delete(p));
    pendingMounts.add(p);
  }
  function mountWithin(scope) {
    for (const m of mounts) {
      if (scope.matches && scope.matches(m.selector)) mountEl(scope, m);
      for (const el of scope.querySelectorAll(m.selector)) mountEl(el, m);
    }
  }
  function mountAll() {
    for (const s of slides) mountWithin(s);
  }
  function mountHooks(scope, name, arg) {
    const els = scope.querySelectorAll("[data-mounted]");
    for (const el of els) {
      for (const hooks of el.__mounts.values()) {
        if (typeof hooks[name] !== "function") continue;
        try {
          hooks[name](arg === undefined ? mountCtx(el) : arg);
        } catch (err) {
          console.error(`deck.mount ${name}() failed:`, err);
        }
      }
    }
  }
  function mount(selector, init, opts = {}) {
    const m = { selector, init };
    mounts.push(m);
    if (opts.eager || /is-(print|sheet)/.test(root.className)) mountAll();
    else if (slides[cur]) mountWithin(slides[cur]);
  }
  async function settled() {
    await ready;
    while (pendingMounts.size) await Promise.all([...pendingMounts]);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    return true;
  }

  // Entering a slide happens in two parts: getting it ready (state resets, first mounts)
  // the moment it becomes active, and showing it (enter hooks, deck:enter, videos,
  // counters) once it can be seen. A sweep transition calls enter(s, true) under its
  // cover and runs the returned show() as the slide is revealed.
  function enter(s, later) {
    const visited = s.__visited;
    s.__visited = true;
    let shown;
    s.__shown = new Promise((r) => (shown = r));
    for (const box of s.querySelectorAll("[data-interactive][data-reset]")) {
      resetState(box);
    }
    mountWithin(s);
    const show = () => {
      if (visited) mountHooks(s, "enter");
      s.dispatchEvent(
        new CustomEvent("deck:enter", {
          bubbles: true,
          detail: { slide: s, index: slides.indexOf(s) },
        }),
      );
      for (const v of s.querySelectorAll("video[data-autoplay]")) {
        try {
          v.currentTime = 0;
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } catch {
          /* video not ready */
        }
      }
      playWithin(s);
      shown();
    };
    if (later) return show;
    show();
    return null;
  }
  function leave(s) {
    mountHooks(s, "leave");
    s.dispatchEvent(
      new CustomEvent("deck:leave", {
        bubbles: true,
        detail: { slide: s, index: slides.indexOf(s) },
      }),
    );
    s.classList.remove("is-frozen");
    for (const box of s.querySelectorAll("[data-tour]")) stopTour(box);
    for (const v of s.querySelectorAll("video")) v.pause();
    for (const el of s.querySelectorAll("[data-count]"))
      cancelAnimationFrame(el.__raf);
    for (const el of s.querySelectorAll('[data-anim="type"]'))
      clearTimeout(el.__tt);
  }

  // ---------------------------------------------------------------------------
  // Slide transitions. data-transition on a slide (how it is entered) or on the deck:
  //   basic:    fade, slide, zoom, wipe, rise, morph, none
  //   reveals:  iris, diagonal, split, blinds, cube (the new slide is revealed through a shape)
  //   sweeps:   panels, stripes, shutter, circle, tiles, wave (motion-graphic color shapes
  //             cover the screen, the slide changes underneath, and they sweep off)
  //   auto:     the theme's signature sweep on title, section and closing slides, its reveal
  //             on statements and quotes, and its content transition elsewhere
  //             (--mg-signature, --mg-reveal, --mg-content)
  // Sweep colors: --mg-1, --mg-2, --mg-3. data-transition-duration (ms) and
  // data-transition-origin ("left", "80% 20%", ...) on the slide or deck. Going back uses
  // the transition of the slide you leave, reversed.
  const REVEALS = ["iris", "diagonal", "split", "blinds", "cube"];
  const SWEEPS = ["panels", "stripes", "shutter", "circle", "tiles", "wave"];
  const VTS = ["fade", "slide", "zoom", "wipe", "rise", "morph", ...REVEALS];
  const TRANSITIONS = ["none", ...VTS, ...SWEEPS];
  // [duration ms, fully covered, slide shows] as fractions of the duration
  const SWEEP_TIME = {
    panels: [1250, 0.5, 0.78],
    stripes: [1400, 0.5, 0.6],
    shutter: [1300, 0.51, 0.6],
    circle: [1400, 0.5, 0.68],
    tiles: [1350, 0.48, 0.58],
    wave: [1500, 0.5, 0.68],
  };
  const REVEAL_MS = {
    iris: 900,
    diagonal: 900,
    split: 800,
    blinds: 900,
    cube: 1000,
  };
  const MG_EASE = "cubic-bezier(0.77, 0, 0.18, 1)";
  const LAYOUT_BIG = /\blayout-(title|section|closing)\b/;
  const LAYOUT_MOMENT = /\blayout-(statement|quote)\b/;
  const warnedKinds = new Set();

  const cssVar = (el, name) =>
    getComputedStyle(el).getPropertyValue(name).trim();

  function transitionFor(to, from, dir) {
    const owner = dir < 0 ? from : to;
    let kind = (
      owner.getAttribute("data-transition") ||
      stage.getAttribute("data-transition") ||
      "fade"
    ).trim();
    if (kind === "auto") {
      const c = owner.className;
      kind = LAYOUT_BIG.test(c)
        ? cssVar(owner, "--mg-signature") || "panels"
        : LAYOUT_MOMENT.test(c)
          ? cssVar(owner, "--mg-reveal") || "iris"
          : cssVar(owner, "--mg-content") || "slide";
    }
    if (!TRANSITIONS.includes(kind)) {
      if (!warnedKinds.has(kind)) {
        warnedKinds.add(kind);
        warn(
          "transition",
          `unknown transition "${kind}" (use ${TRANSITIONS.join(", ")} or auto)`,
          slideNo(owner),
        );
      }
      kind = "fade";
    }
    return kind;
  }

  function transitionMs(owner, fallback) {
    const v = parseFloat(
      owner.getAttribute("data-transition-duration") ||
        stage.getAttribute("data-transition-duration"),
    );
    return v > 0 ? v : fallback;
  }

  // Where circles and tiles start: data-transition-origin, else the click that moved on,
  // else the side the next slide comes from.
  let press = null;
  const ORIGIN_WORDS = {
    center: [50, 50],
    left: [0, 50],
    right: [100, 50],
    top: [50, 0],
    bottom: [50, 100],
  };
  function originFor(owner, dir) {
    const attr = (
      owner.getAttribute("data-transition-origin") ||
      stage.getAttribute("data-transition-origin") ||
      ""
    ).trim();
    if (attr) {
      const w = ORIGIN_WORDS[attr];
      const p = w || attr.split(/\s+/).map((v) => parseFloat(v));
      if (p.length === 2 && !p.some(isNaN))
        return { x: (p[0] / 100) * W, y: (p[1] / 100) * H };
    }
    if (press && performance.now() - press.t < 800) return press;
    return { x: dir < 0 ? W * 0.06 : W * 0.94, y: H / 2 };
  }
  function notePress(e) {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    press = {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
      t: performance.now(),
    };
  }

  // Keyframes for a shape that waits, moves in over [a, b], holds, then moves out over [c, d].
  function inOut(prop, from, mid, to, a, b, c, d) {
    const k = (v, offset, easing = "linear") => ({ [prop]: v, offset, easing });
    return [
      k(from, 0),
      k(from, a, MG_EASE),
      k(mid, b),
      k(mid, c, MG_EASE),
      k(to, d),
      k(to, 1),
    ];
  }
  function mgDiv(parent, cls, css) {
    const el = doc.createElement("div");
    el.className = cls;
    for (const [k, v] of Object.entries(css || {})) el.style.setProperty(k, v);
    parent.append(el);
    return el;
  }
  function waveSvg(cls, phase) {
    const w = 2100;
    const h = 1500;
    const edge = (y0, ph) => {
      const pts = [];
      for (let x = 0; x <= w; x += 150)
        pts.push([x, y0 + 55 * Math.sin((x / w) * Math.PI * 3 + ph)]);
      return pts;
    };
    const top = smooth(edge(70, phase));
    const bottom = smooth(edge(h - 70, phase + 1).reverse()).replace(/^M/, "L");
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", cls);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", top + bottom + "Z");
    svg.append(path);
    return svg;
  }
  const shift = (axis, v) => `translate${axis}(${v})`;
  // Each builder returns [element, keyframes] pairs on one shared timeline (0..1).
  const SWEEP_BUILD = {
    panels(layer, s) {
      const out = [];
      for (let k = 0; k < 3; k++) {
        const el = mgDiv(layer, "mg-fill c" + (k + 1));
        const back = 2 - k;
        out.push([
          el,
          inOut(
            "transform",
            shift("X", 100 * s + "%"),
            shift("X", "0%"),
            shift("X", -100 * s + "%"),
            k * 0.07,
            0.36 + k * 0.07,
            0.56 + back * 0.07,
            0.86 + back * 0.07,
          ),
        ]);
      }
      return out;
    },
    stripes(layer, s) {
      const tilt = mgDiv(layer, "mg-tilt", {
        transform: `rotate(${-24 * s}deg)`,
      });
      const n = 7;
      const out = [];
      for (let k = 0; k < n; k++) {
        const el = mgDiv(tilt, "mg-bar c" + (1 + (k % 2)), {
          top: (k * 100) / n + "%",
          height: 100 / n + 0.3 + "%",
        });
        out.push([
          el,
          inOut(
            "transform",
            shift("X", 100 * s + "%"),
            shift("X", "0%"),
            shift("X", -100 * s + "%"),
            k * 0.03,
            0.32 + k * 0.03,
            0.52 + k * 0.03,
            0.8 + k * 0.03,
          ),
        ]);
      }
      return out;
    },
    shutter(layer, s) {
      const n = 8;
      const out = [];
      for (let k = 0; k < n; k++) {
        const j = s > 0 ? n - 1 - k : k;
        const el = mgDiv(layer, "mg-col c" + (k % 2 ? 2 : 1), {
          left: (k * 100) / n + "%",
          width: 100 / n + 0.3 + "%",
        });
        out.push([
          el,
          inOut(
            "transform",
            shift("Y", "-100%"),
            shift("Y", "0%"),
            shift("Y", "100%"),
            j * 0.03,
            0.3 + j * 0.03,
            0.53 + j * 0.03,
            0.77 + j * 0.03,
          ),
        ]);
      }
      return out;
    },
    circle(layer, s, o) {
      const R =
        Math.ceil(
          Math.max(
            Math.hypot(o.x, o.y),
            Math.hypot(W - o.x, o.y),
            Math.hypot(o.x, H - o.y),
            Math.hypot(W - o.x, H - o.y),
          ),
        ) + 6;
      const at = `at ${r1(o.x)}px ${r1(o.y)}px`;
      const out = [];
      for (const [cls, a, b, c, d] of [
        ["c1", 0, 0.42, 0.6, 0.94],
        ["c2", 0.08, 0.5, 0.54, 0.86],
      ]) {
        const el = mgDiv(layer, "mg-fill mg-holed " + cls, {
          "--ox": r1(o.x) + "px",
          "--oy": r1(o.y) + "px",
        });
        out.push([
          el,
          inOut(
            "clipPath",
            `circle(0px ${at})`,
            `circle(${R}px ${at})`,
            `circle(${R}px ${at})`,
            a,
            b,
            c,
            d,
          ),
        ]);
        out.push([el, inOut("--mg-r", "-2px", "-2px", R + "px", a, b, c, d)]);
      }
      return out;
    },
    tiles(layer, s, o) {
      const cols = 8;
      const rows = 5;
      const w = W / cols;
      const h = H / rows;
      const far = Math.max(
        Math.hypot(o.x, o.y),
        Math.hypot(W - o.x, o.y),
        Math.hypot(o.x, H - o.y),
        Math.hypot(W - o.x, H - o.y),
      );
      const out = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const d = Math.hypot((c + 0.5) * w - o.x, (r + 0.5) * h - o.y) / far;
          const el = mgDiv(layer, "mg-tile c" + (1 + ((r + c) % 2)), {
            left: c * w - 1 + "px",
            top: r * h - 1 + "px",
            width: w + 2 + "px",
            height: h + 2 + "px",
          });
          const t = [
            d * 0.22,
            0.26 + d * 0.22,
            0.52 + d * 0.22,
            0.78 + d * 0.22,
          ];
          out.push([
            el,
            inOut("transform", "scale(0)", "scale(1)", "scale(0)", ...t),
          ]);
          out.push([el, inOut("borderRadius", "50%", "0%", "50%", ...t)]);
        }
      return out;
    },
    wave(layer, s) {
      const out = [];
      for (const [cls, a, b, c, d, phase] of [
        ["c2", 0, 0.44, 0.6, 0.98, 1.3],
        ["c1", 0.06, 0.5, 0.52, 0.9, 0],
      ]) {
        const svg = waveSvg(cls, phase);
        layer.append(svg);
        const below = shift("Y", "1080px");
        const above = shift("Y", "-1500px");
        out.push([
          svg,
          inOut(
            "transform",
            s > 0 ? below : above,
            shift("Y", "-210px"),
            s > 0 ? above : below,
            a,
            b,
            c,
            d,
          ),
        ]);
      }
      return out;
    },
  };

  // The transition in progress: { kind, end(), seek(fraction) }. A new one ends it first.
  let pending = null;
  let vtToken = 0;
  function settleTransition() {
    const p = pending;
    pending = null;
    if (p) p.end();
  }
  // While a sweep covers the screen (and early in a reveal), the new slide's entrance
  // animations wait, so they play as it appears.
  const hold = (on) =>
    on
      ? root.setAttribute("data-mg-hold", "")
      : root.removeAttribute("data-mg-hold");

  function runSweep(kind, dir, swap, owner) {
    const [base, cover, reveal] = SWEEP_TIME[kind];
    const dur = transitionMs(owner, base);
    const layer = doc.createElement("div");
    layer.className = "deck-mg is-" + kind;
    layer.setAttribute("aria-hidden", "true");
    const cs = getComputedStyle(owner);
    for (const n of [1, 2, 3])
      layer.style.setProperty(`--mg-${n}`, cs.getPropertyValue(`--mg-${n}`));
    stage.append(layer);
    const s = dir < 0 ? -1 : 1;
    const shapes = SWEEP_BUILD[kind](layer, s, originFor(owner, dir));
    const anims = shapes.map(([el, frames]) =>
      el.animate(frames, { duration: dur, fill: "both" }),
    );
    let swapped = false;
    let held = false;
    let show = null;
    let raf = 0;
    const at = (f) => {
      if (f >= cover && !swapped) {
        swapped = true;
        held = true;
        hold(true);
        show = swap(true);
      }
      if (f >= reveal && held) {
        held = false;
        hold(false);
        if (show) show();
      }
    };
    const p = {
      kind,
      end() {
        cancelAnimationFrame(raf);
        at(1);
        for (const a of anims) a.cancel();
        layer.remove();
        if (pending === p) pending = null;
      },
      seek(f) {
        cancelAnimationFrame(raf);
        for (const a of anims) {
          a.pause();
          a.currentTime = f * dur;
        }
        at(f);
      },
    };
    const tick = () => {
      const f = (anims[0].currentTime || 0) / dur;
      at(f);
      if (f >= 1) return p.end();
      raf = requestAnimationFrame(tick);
    };
    anims[0].finished.then(
      () => pending === p && p.end(),
      () => {},
    );
    raf = requestAnimationFrame(tick);
    return p;
  }

  function runViewTransition(kind, dir, swap, owner) {
    const token = ++vtToken;
    const reveal = REVEALS.includes(kind);
    const dur = transitionMs(owner, reveal ? REVEAL_MS[kind] : 0);
    root.setAttribute("data-vt", kind);
    root.setAttribute("data-vt-dir", dir < 0 ? "back" : "forward");
    if (dur) root.style.setProperty("--vt-dur", dur + "ms");
    else root.style.removeProperty("--vt-dur");
    if (kind === "iris") {
      const o = originFor(owner, dir);
      root.style.setProperty("--vt-x", r1((o.x / W) * 100) + "%");
      root.style.setProperty("--vt-y", r1((o.y / H) * 100) + "%");
    }
    let swapped = false;
    let timer = 0;
    let show = null;
    const once = () => {
      if (swapped) return;
      swapped = true;
      if (reveal) hold(true);
      show = swap(reveal);
    };
    const release = () => {
      clearTimeout(timer);
      if (reveal) hold(false);
      const f = show;
      show = null;
      if (f) f();
    };
    const t = doc.startViewTransition(once);
    t.ready
      .then(() => {
        if (reveal) timer = setTimeout(release, dur * 0.35);
      })
      .catch(() => {});
    const p = {
      kind,
      end() {
        once();
        release();
        try {
          t.skipTransition();
        } catch (e) {}
        if (pending === p) pending = null;
      },
      async seek(f) {
        await t.ready.catch(() => {});
        clearTimeout(timer);
        for (const a of doc.getAnimations()) {
          const pe = a.effect && a.effect.pseudoElement;
          if (!pe || !pe.startsWith("::view-transition")) continue;
          a.pause();
          a.currentTime = f * a.effect.getComputedTiming().endTime;
        }
        if (f >= 0.35) release();
      },
    };
    t.finished.finally(() => {
      release();
      if (token === vtToken) {
        root.removeAttribute("data-vt");
        root.removeAttribute("data-vt-dir");
      }
      if (pending === p) pending = null;
    });
    return p;
  }

  // For check.mjs --transitions: freeze the running transition at a fraction (0..1).
  async function seekTransition(f) {
    const p = pending;
    if (!p) return null;
    await p.seek(Math.max(0, Math.min(1, f)));
    return p.kind;
  }

  function go(i, opts = {}) {
    if (!slides.length) return;
    i = Math.round(Number(i));
    if (!Number.isFinite(i)) return; // a bad index must never leave the deck without a slide
    settleTransition();
    i = Math.max(0, Math.min(slides.length - 1, i));
    const from = slides[cur];
    const to = slides[i];
    if (from === to && !opts.force) return;
    const dir = opts.dir || (cur < 0 || i > cur ? 1 : -1);
    const atEnd = !!opts.atEnd || isStatic();
    const swap = (later) => {
      if (from && from !== to) {
        from.classList.remove("is-active");
        leave(from);
      }
      to.classList.add("is-active");
      to.classList.toggle("is-frozen", atEnd && !isStatic() && !!from);
      cur = i;
      to.__step = atEnd ? to.__order.length : 0;
      applySteps(to, false);
      const show = enter(to, later);
      sync();
      return show;
    };
    let kind =
      opts.instant || !from || from === to
        ? "none"
        : transitionFor(to, from, dir);
    if (motion === "none" || doc.hidden || overlay) kind = "none";
    else if (motion === "subtle" && kind !== "none") kind = "fade";
    const owner = dir < 0 && from ? from : to;
    if (SWEEPS.includes(kind)) {
      pending = runSweep(kind, dir, swap, owner);
    } else if (kind !== "none" && doc.startViewTransition) {
      pending = runViewTransition(kind, dir, swap, owner);
    } else {
      swap();
      if (kind !== "none") {
        to.classList.remove("vt-fallback");
        void to.offsetWidth;
        to.classList.add("vt-fallback");
      }
    }
  }

  const isVisible = (i) => !slides[i].hasAttribute("data-hidden");
  function nextIndex(i) {
    for (let k = i + 1; k < slides.length; k++) if (isVisible(k)) return k;
    return -1;
  }
  function prevIndex(i) {
    for (let k = i - 1; k >= 0; k--) if (isVisible(k)) return k;
    return -1;
  }
  function next() {
    const s = slides[cur];
    if (s.__step < s.__order.length) {
      s.__step++;
      applySteps(s, true);
      sync();
      return;
    }
    const k = nextIndex(cur);
    if (k >= 0) go(k, { dir: 1 });
  }
  // The current slide at build step n: 0 = none played, the step count = all played.
  function goStep(n) {
    const s = slides[cur];
    if (!s) return;
    n = Math.max(0, Math.min(s.__order.length, Math.round(Number(n)) || 0));
    if (n === s.__step) return;
    const forward = n > s.__step;
    s.__step = n;
    applySteps(s, forward);
    sync();
  }
  function prev() {
    const s = slides[cur];
    if (s.__step > 0) {
      s.__step--;
      applySteps(s, false);
      sync();
      return;
    }
    if (s.hasAttribute("data-hidden") && s.__from !== undefined)
      return go(s.__from, { dir: -1, atEnd: true });
    const k = prevIndex(cur);
    if (k >= 0) go(k, { dir: -1, atEnd: true });
  }
  function resolve(target) {
    const t = String(target).trim();
    if (t === "next") return nextIndex(cur);
    if (t === "prev") return prevIndex(cur);
    if (/^\d+$/.test(t)) return Number(t) - 1;
    return slides.findIndex((s) => s.id === t);
  }
  function jump(i) {
    if (i < 0 || i >= slides.length || i === cur) return;
    if (slides[i].hasAttribute("data-hidden")) slides[i].__from = cur;
    go(i, { dir: i > cur ? 1 : -1 });
  }
  const indexFromHash = () => {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    return h ? resolve(h) : -1;
  };

  // ---------------------------------------------------------------------------
  // Clickable mockups: data-set / data-toggle change a [data-interactive] box's
  // data-state; [data-when] parts show for matching states.
  // ---------------------------------------------------------------------------

  const ownerBox = (el) =>
    (el.hasAttribute("data-interactive") ? el.parentElement : el).closest(
      "[data-interactive], .slide",
    );
  function readState(box) {
    const m = new Map();
    for (const pair of (box.getAttribute("data-state") || "")
      .trim()
      .split(/\s+/)) {
      if (!pair) continue;
      const [k, v] = pair.split(":");
      m.set(k, v === undefined ? "on" : v);
    }
    return m;
  }
  function writeState(box, m) {
    box.setAttribute(
      "data-state",
      [...m].map(([k, v]) => k + ":" + v).join(" "),
    );
    for (const [k, v] of m) box.setAttribute("data-s-" + k, v);
  }
  const holds = (cond, m) =>
    cond.split(",").some((alt) =>
      alt
        .trim()
        .split(/\s+/)
        .every((term) => {
          if (!term) return true;
          const neg = term[0] === "!";
          const [k, v] = (neg ? term.slice(1) : term).split(":");
          const ok = (m.get(k) || "off") === (v === undefined ? "on" : v);
          return neg ? !ok : ok;
        }),
    );
  // A box with data-transition="push|fade|rise|zoom" animates its [data-when] panels
  // (screens) in and out, like an app. data-back on the clicked element reverses a push.
  function animatePanel(el, phase, kind, back) {
    clearTimeout(el.__pt);
    el.classList.remove("pt-enter", "pt-leave");
    el.setAttribute("data-pt", kind);
    el.style.setProperty("--pt-dir", back ? "-1" : "1");
    void el.offsetWidth;
    el.classList.add("pt-" + phase);
    el.__pt = setTimeout(() => {
      el.classList.remove("pt-" + phase);
      if (phase === "leave") el.classList.add("is-off");
    }, 480);
  }
  function applyState(box, opts = {}) {
    const m = readState(box);
    const kind =
      !opts.instant && !isStatic() && box.getAttribute("data-transition");
    const shown = [];
    for (const el of box.querySelectorAll("[data-when]")) {
      if (ownerBox(el) !== box) continue;
      const off = !holds(el.getAttribute("data-when"), m);
      const leaving = el.classList.contains("pt-leave");
      const wasOff = el.classList.contains("is-off") || leaving;
      if (off === wasOff) continue;
      if (!off) {
        clearTimeout(el.__pt);
        el.classList.remove("is-off", "pt-leave");
        shown.push(el);
        if (kind) animatePanel(el, "enter", kind, opts.back);
      } else if (kind) animatePanel(el, "leave", kind, opts.back);
      else el.classList.add("is-off");
    }
    for (const el of box.querySelectorAll("[data-set], [data-toggle]")) {
      if (ownerBox(el) !== box) continue;
      const on = el.hasAttribute("data-set")
        ? holds(el.getAttribute("data-set").trim().split(/\s+/).join(" "), m)
        : el
            .getAttribute("data-toggle")
            .trim()
            .split(/\s+/)
            .every((k) => m.get(k) === "on");
      el.classList.toggle("is-current", on);
      el.setAttribute("aria-pressed", String(on));
    }
    return shown;
  }
  function commitState(box, m, trigger, instant) {
    const back = !!(trigger && trigger.hasAttribute("data-back"));
    const run = () => {
      writeState(box, m);
      for (const el of applyState(box, { instant, back })) playWithin(el);
    };
    const useVT =
      !instant &&
      !isStatic() &&
      !box.hasAttribute("data-transition") &&
      doc.startViewTransition &&
      motion !== "none";
    if (useVT) {
      root.setAttribute("data-vt", "state");
      doc
        .startViewTransition(run)
        .finished.finally(() => root.removeAttribute("data-vt"));
    } else run();
  }
  function setState(box, change, trigger, instant) {
    const m = readState(box);
    for (const pair of change.trim().split(/\s+/)) {
      if (!pair) continue;
      const [k, v] = pair.split(":");
      m.set(k, v === undefined ? "on" : v);
    }
    commitState(box, m, trigger, instant);
  }
  function resetState(box) {
    if (box.__initial === undefined) return;
    box.setAttribute("data-state", box.__initial);
    for (const a of [...box.attributes]) {
      if (a.name.startsWith("data-s-")) box.removeAttribute(a.name);
    }
    writeState(box, readState(box));
    applyState(box, { instant: true });
    // A fresh demo has empty fields too.
    for (const input of box.querySelectorAll("[data-input]")) {
      input.value = "";
      for (const el of box.querySelectorAll(
        `[data-text="${input.getAttribute("data-input")}"]`,
      ))
        el.textContent = el.getAttribute("data-empty") || "";
    }
  }
  function onStateClick(e) {
    const t = e.target.closest && e.target.closest("[data-set], [data-toggle]");
    if (!t || !stage.contains(t)) return;
    e.preventDefault();
    const box = ownerBox(t);
    if (e.isTrusted) stopTour(box);
    if (t.hasAttribute("data-set")) {
      setState(box, t.getAttribute("data-set"), t);
      return;
    }
    const m = readState(box);
    for (const k of t.getAttribute("data-toggle").trim().split(/\s+/)) {
      m.set(k, m.get(k) === "on" ? "off" : "on");
    }
    commitState(box, m, t);
  }

  // Typing into <input data-input="name"> fills [data-text="name"] in the same box.
  function onStateInput(e) {
    const t = e.target;
    if (!t.matches || !t.matches("[data-input]") || !stage.contains(t)) return;
    const box = ownerBox(t);
    const key = t.getAttribute("data-input");
    for (const el of box.querySelectorAll(`[data-text="${key}"]`)) {
      el.textContent = t.value || el.getAttribute("data-empty") || "";
    }
  }
  // Enter in a typed field presses the box's [data-submit] button, like a real form.
  function onStateEnter(e) {
    const t = e.target;
    if (
      e.key !== "Enter" ||
      !t.matches ||
      !t.matches("input[data-input]") ||
      !stage.contains(t)
    )
      return;
    const submit = ownerBox(t).querySelector("[data-submit]");
    if (!submit) return;
    e.preventDefault();
    submit.click();
  }

  // Guided demo: data-tour="screen:list, screen:detail, tab:stats" clicks through
  // those states with a visible cursor when the slide (or its build step) appears.
  const CURSOR_SVG =
    '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="M5 2.5v17.2l4.6-4.4 3 6.6 3.1-1.4-3-6.5 6.3-.3z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const norm = (s) => s.trim().split(/\s+/).sort().join(" ");
  function stopTour(box) {
    for (const t of box.__tour || []) clearTimeout(t);
    box.__tour = [];
    if (box.__cursor) box.__cursor.classList.remove("is-on", "is-click");
  }
  function moveCursor(box, cursor, target) {
    const br = box.getBoundingClientRect();
    const k = br.width / (box.offsetWidth || br.width || 1) || 1;
    const tr = target.getBoundingClientRect();
    const x = (tr.left + tr.width / 2 - br.left) / k;
    const y = (tr.top + tr.height / 2 - br.top) / k;
    cursor.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
  }
  function startTour(box) {
    stopTour(box);
    const steps = (box.getAttribute("data-tour") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!steps.length) return;
    resetState(box);
    if (isStatic()) {
      for (const st of steps) setState(box, st, null, true);
      return;
    }
    if (getComputedStyle(box).position === "static") {
      box.style.position = "relative";
    }
    let cursor = box.__cursor;
    if (!cursor) {
      cursor = doc.createElement("span");
      cursor.className = "deck-cursor";
      cursor.setAttribute("aria-hidden", "true");
      cursor.innerHTML = CURSOR_SVG + "<i></i>";
      box.append(cursor);
      box.__cursor = cursor;
    }
    cursor.style.translate = `${Math.round(box.offsetWidth * 0.62)}px ${Math.round(box.offsetHeight * 0.86)}px`;
    const gap = parseFloat(box.getAttribute("data-tour-interval")) || 1700;
    let t = parseFloat(box.getAttribute("data-tour-delay")) || 900;
    box.__tour.push(setTimeout(() => cursor.classList.add("is-on"), t - 400));
    for (const st of steps) {
      box.__tour.push(
        setTimeout(() => {
          const target = [...box.querySelectorAll("[data-set]")].find(
            (el) =>
              ownerBox(el) === box &&
              !el.closest(".is-off, .pt-leave") &&
              norm(el.getAttribute("data-set")) === norm(st),
          );
          if (target) moveCursor(box, cursor, target);
          box.__tour.push(
            setTimeout(
              () => {
                cursor.classList.add("is-click");
                box.__tour.push(
                  setTimeout(() => cursor.classList.remove("is-click"), 320),
                );
                setState(box, st, target);
              },
              target ? 700 : 0,
            ),
          );
        }, t),
      );
      t += gap;
    }
    box.__tour.push(
      setTimeout(() => {
        cursor.classList.remove("is-on");
        if (box.hasAttribute("data-tour-loop")) {
          box.__tour.push(setTimeout(() => startTour(box), 1200));
        }
      }, t + 200),
    );
  }

  // ---------------------------------------------------------------------------
  // Screen furniture: progress bar, counter, toast, overlays.
  // ---------------------------------------------------------------------------

  const ui = doc.createElement("div");
  ui.className = "deck-ui";
  ui.innerHTML = '<div class="deck-progress" aria-hidden="true"><i></i></div>';

  // On-screen controls (shown while the pointer moves, or when focused).
  const SVG = (body) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  const CTL_ICONS = {
    prev: SVG('<path d="M15 5l-7 7 7 7"/>'),
    next: SVG('<path d="M9 5l7 7-7 7"/>'),
    overview: SVG(
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    ),
    present: SVG(
      '<rect x="2.5" y="4" width="13" height="9.5" rx="1.5"/><path d="M9 13.5V18M5.5 18h7"/><rect x="17.5" y="7" width="4" height="11" rx="1"/>',
    ),
    laser: SVG(
      '<circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="7.5"/>',
    ),
    pen: SVG(
      '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19 4 20z"/><path d="M13.5 7l3.5 3.5"/>',
    ),
    fullscreen: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    help: SVG(
      '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/>',
    ),
  };
  const controls = doc.createElement("nav");
  controls.className = "deck-controls";
  controls.setAttribute("aria-label", "Slide controls");
  const ctl = (name, label, extra = "") =>
    `<button type="button" data-ctl="${name}" title="${label}" aria-label="${label}"${extra}>${CTL_ICONS[name]}</button>`;
  controls.innerHTML =
    ctl("prev", "Back (←)") +
    '<button type="button" data-ctl="overview" class="deck-pos" title="All slides (O)" aria-label="All slides (O)"></button>' +
    ctl("next", "Next (→ or Space)") +
    '<span class="deck-sep" aria-hidden="true"></span>' +
    ctl("overview", "All slides (O)") +
    ctl("present", "Present with notes, on two screens if you have them (P)") +
    ctl("laser", "Laser pointer (L)", ' aria-pressed="false"') +
    ctl(
      "pen",
      "Pen: draw on the slide (D, C clears)",
      ' aria-pressed="false"',
    ) +
    ctl("fullscreen", "Full screen (F)") +
    ctl("help", "Shortcuts and options (?)");
  controls.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ctl]");
    if (!b) return;
    const act = b.getAttribute("data-ctl");
    if (act === "prev") prev();
    else if (act === "next") next();
    else if (act === "overview") openOverview();
    else if (act === "present") present();
    else if (act === "laser") setTool(tool === "laser" ? null : "laser");
    else if (act === "pen") setTool(tool === "pen" ? null : "pen");
    else if (act === "fullscreen") toggleFullscreen();
    else if (act === "help") openHelp();
    // A mouse click leaves focus on the button; drop it so Space keeps advancing.
    if (e.detail > 0) b.blur();
  });
  const srEl = doc.createElement("div");
  srEl.className = "deck-sr";
  srEl.setAttribute("aria-live", "polite");
  let announced = -1;
  const slideTitle = (s) => {
    const h = s && s.querySelector("h1, h2, h3");
    return h ? h.textContent.trim().replace(/\s+/g, " ") : "";
  };

  // Kiosk: data-auto="8" on the deck or a slide (or ?auto=8) advances every 8 seconds;
  // data-auto-loop on the deck (or ?loop) starts over at the end.
  let autoTimer = 0;
  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (isStatic() || /is-(print|sheet)/.test(root.className)) return;
    const s = slides[cur];
    const sec = parseFloat(
      s.getAttribute("data-auto") ||
        params.get("auto") ||
        stage.getAttribute("data-auto") ||
        "",
    );
    if (!(sec > 0)) return;
    autoTimer = setTimeout(() => {
      if (overlay || tool === "pen") return scheduleAuto();
      if (s.__step < s.__order.length || nextIndex(cur) >= 0) return next();
      if (params.has("loop") || stage.hasAttribute("data-auto-loop"))
        go(
          slides.findIndex((x) => !x.hasAttribute("data-hidden")),
          { dir: 1 },
        );
    }, sec * 1000);
  }
  const toastEl = doc.createElement("div");
  toastEl.className = "deck-toast";
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  let toastTimer;
  function toast(msg, ms = 1800) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), ms);
  }

  function sync() {
    const s = slides[cur];
    const visible = slides.filter((x) => !x.hasAttribute("data-hidden"));
    const pos = visible.indexOf(s);
    const p =
      pos < 0 ? null : visible.length > 1 ? pos / (visible.length - 1) : 1;
    if (p !== null)
      ui.querySelector(".deck-progress > i").style.width =
        (p * 100).toFixed(2) + "%";
    controls.querySelector(".deck-pos").textContent =
      pos < 0 ? `↳ ${cur + 1}` : `${pos + 1} / ${visible.length}`;
    controls.querySelector('[data-ctl="prev"]').disabled =
      s.__step === 0 && prevIndex(cur) < 0 && s.__from === undefined;
    controls.querySelector('[data-ctl="next"]').disabled =
      s.__step >= s.__order.length && nextIndex(cur) < 0;
    if (announced !== cur) {
      announced = cur;
      const title = slideTitle(s);
      srEl.textContent =
        `Slide ${cur + 1} of ${slides.length}` + (title ? `: ${title}` : "");
    }
    showInk();
    scheduleAuto();
    const id = s.id || String(cur + 1);
    if (decodeURIComponent(location.hash.replace(/^#\/?/, "")) !== id) {
      try {
        history.replaceState(null, "", "#/" + encodeURIComponent(id));
      } catch {
        /* sandboxed: ignore */
      }
    }
    updatePresenter();
  }

  let overlay = null;
  function closeOverlay() {
    if (!overlay) return false;
    overlay.remove();
    overlay = null;
    return true;
  }

  function cloneSlide(s, allSteps) {
    const c = s.cloneNode(true);
    c.classList.add("is-active");
    c.classList.remove("vt-fallback");
    c.removeAttribute("id");
    for (const el of [c, ...c.querySelectorAll("*")]) {
      if (el.id) el.removeAttribute("id");
      if (el.style && el.style.viewTransitionName)
        el.style.viewTransitionName = "none";
    }
    for (const v of c.querySelectorAll("video")) {
      v.removeAttribute("autoplay");
      v.muted = true;
    }
    if (allSteps) {
      for (const el of c.querySelectorAll("[data-step]"))
        el.classList.add("is-shown");
      for (const el of c.querySelectorAll("[data-exit]"))
        el.classList.add("is-gone");
      for (const el of c.querySelectorAll(".is-dim"))
        el.classList.remove("is-dim");
    }
    for (const el of c.querySelectorAll("[data-count]")) {
      const v = toNum(el.getAttribute("data-count"));
      if (!isNaN(v)) el.textContent = counterText(el, v);
    }
    const typed = s.querySelectorAll('[data-anim="type"]');
    c.querySelectorAll('[data-anim="type"]').forEach((el, k) => {
      if (typed[k] && typed[k].__full !== undefined)
        el.textContent = typed[k].__full;
      el.classList.remove("is-typing");
    });
    // Library widgets: canvases clone blank, so copy their pixels; keep Alpine
    // and similar libraries from starting a second copy of the clone.
    const canvases = s.querySelectorAll("canvas");
    c.querySelectorAll("canvas").forEach((cv, k) => {
      try {
        cv.getContext("2d").drawImage(canvases[k], 0, 0);
      } catch {
        /* tainted or WebGL canvas */
      }
    });
    c.setAttribute("x-ignore", "");
    c.removeAttribute("data-mounted");
    return c;
  }

  function openOverview() {
    settleTransition();
    if (closeOverlay()) return;
    const wrap = doc.createElement("div");
    wrap.className = "deck-overview";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "All slides");
    const grid = doc.createElement("div");
    grid.className = "deck-overview-grid";
    slides.forEach((s, i) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className =
        "deck-thumb" +
        (i === cur ? " is-current" : "") +
        (s.hasAttribute("data-hidden") ? " is-hidden" : "");
      const frame = doc.createElement("div");
      frame.className = "deck-thumb-frame is-static";
      frame.append(cloneSlide(s, true));
      const label = doc.createElement("span");
      label.className = "deck-thumb-label";
      const title = s.querySelector("h1, h2, h3");
      label.textContent = `${i + 1}  ${title ? title.textContent.trim().replace(/\s+/g, " ") : ""}`;
      b.append(frame, label);
      b.addEventListener("click", () => {
        closeOverlay();
        jump(i);
      });
      grid.append(b);
    });
    wrap.append(grid);
    doc.body.append(wrap);
    overlay = wrap;
    const first = grid.querySelector(".deck-thumb-frame");
    const z = String((first && first.clientWidth / W) || 0.16);
    for (const f of grid.querySelectorAll(".deck-thumb-frame > .slide")) {
      f.style.zoom = z;
    }
    const current = grid.children[cur];
    if (current) {
      current.focus();
      current.scrollIntoView({ block: "center" });
    }
  }
  function overviewKey(e) {
    const items = [...overlay.querySelectorAll(".deck-thumb")];
    let k = items.indexOf(doc.activeElement);
    if (k < 0) k = cur;
    const cols = getComputedStyle(
      overlay.querySelector(".deck-overview-grid"),
    ).gridTemplateColumns.split(" ").length;
    const moves = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: cols,
      ArrowUp: -cols,
    };
    if (e.key in moves) {
      const t =
        items[Math.max(0, Math.min(items.length - 1, k + moves[e.key]))];
      t.focus();
      t.scrollIntoView({ block: "nearest" });
      e.preventDefault();
    } else if (e.key === "Escape" || e.key === "o" || e.key === "O") {
      closeOverlay();
      e.preventDefault();
    }
  }

  function openHelp() {
    if (closeOverlay()) return;
    const wrap = doc.createElement("div");
    wrap.className = "deck-help";
    wrap.setAttribute("role", "dialog");
    const keys = [
      ["→  Space  Click", "Next (builds first)"],
      ["←  Backspace", "Back"],
      ["Home / End", "First / last slide"],
      ["number + Enter", "Go to that slide"],
      ["O  or  Esc", "All slides"],
      ["F", "Full screen"],
      [
        "P",
        "Present: notes, next slide and timer in a second window; slides full screen on the other screen when there are two",
      ],
      ["L", "Laser pointer"],
      ["D  /  C", "Pen: draw on the slide / clear it"],
      ["E", "Edit the data list"],
      ["T  /  Shift+T", "Next / previous theme"],
      ["M", "Motion: " + motion],
      ["B  /  W", "Black / white screen"],
      ["?", "This help"],
    ];
    wrap.innerHTML = `<div class="deck-help-card"><h2></h2><dl>${keys
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join(
        "",
      )}</dl><p>Theme: ${esc(THEME_NAMES[root.getAttribute("data-theme")] || root.getAttribute("data-theme") || "custom")}${
      usingEdits ? " · showing edited data (E to reset)" : ""
    }</p></div>`;
    wrap.querySelector("h2").textContent = doc.title || "Keyboard";
    wrap.addEventListener("click", closeOverlay);
    doc.body.append(wrap);
    overlay = wrap;
  }

  function blackout(color) {
    if (closeOverlay()) return;
    const wrap = doc.createElement("div");
    wrap.className = "deck-black" + (color === "white" ? " is-white" : "");
    wrap.addEventListener("click", closeOverlay);
    doc.body.append(wrap);
    overlay = wrap;
  }

  function openEditor() {
    if (!dataEl) return toast("This deck has no data list (#deck-data)");
    if (closeOverlay()) return;
    const panel = doc.createElement("aside");
    panel.className = "deck-editor";
    panel.innerHTML = `<header><strong>Deck data</strong><button type="button" data-ed="close" aria-label="Close">✕</button></header>
      <p>Every {{value}} on the slides comes from this list. <b>Apply</b> shows the deck with these values (in this tab). <b>Download</b> saves a copy of the deck that keeps them.</p>
      <textarea spellcheck="false" aria-label="Deck data (JSON)"></textarea>
      <p class="deck-editor-error" role="alert"></p>
      <footer><button type="button" data-ed="apply">Apply</button><button type="button" data-ed="download">Download deck</button><button type="button" data-ed="reset">Reset</button></footer>`;
    const area = panel.querySelector("textarea");
    const err = panel.querySelector(".deck-editor-error");
    area.value = JSON.stringify(data, null, 2);
    const read = () => {
      try {
        err.textContent = "";
        return JSON.parse(area.value);
      } catch (e) {
        err.textContent = "Not valid JSON: " + e.message;
        return null;
      }
    };
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ed]");
      if (!b) return;
      const act = b.getAttribute("data-ed");
      if (act === "close") return closeOverlay();
      if (act === "reset") {
        store.clear();
        return location.reload();
      }
      const value = read();
      if (!value) return;
      if (act === "apply") {
        if (store.set({ src: hash(DATA_SRC), data: value })) location.reload();
        else
          err.textContent =
            "This browser blocked storage here; use Download instead.";
      }
      if (act === "download") {
        const json = JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
        const html = PRISTINE.replace(
          /(<script[^>]*id=["']deck-data["'][^>]*>)[\s\S]*?(<\/script>)/,
          (m, open, close) => open + "\n" + json + "\n" + close,
        );
        const a = doc.createElement("a");
        a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        const name =
          (doc.title || "deck")
            .replace(/[^\w-]+/g, "-")
            .replace(/^-|-$/g, "") || "deck";
        a.download = name + ".html";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        if (doc.querySelector('script[src*="deck.js"]'))
          toast(
            "Saved. Keep it next to this deck: it uses the engine folder.",
            4000,
          );
      }
    });
    doc.body.append(panel);
    overlay = panel;
    area.focus();
  }

  function setTheme(id) {
    root.setAttribute("data-theme", id);
    const q = THEME_FONTS[id];
    if (q && !doc.querySelector(`[data-theme-fonts~="${id}"]`)) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?" + q + "&display=swap";
      link.setAttribute("data-theme-fonts", id);
      doc.head.append(link);
      link.addEventListener("load", () => {
        renderCharts(true);
        mountHooks(stage, "theme");
      });
    }
    renderCharts(true);
    mountHooks(stage, "theme");
    doc.dispatchEvent(new CustomEvent("deck:theme", { detail: { theme: id } }));
    if (presenter && !presenter.closed)
      presenter.document.documentElement.setAttribute("data-theme", id);
  }
  function cycleTheme(step) {
    const now = THEMES.indexOf(root.getAttribute("data-theme"));
    const id = THEMES[(now + step + THEMES.length) % THEMES.length];
    setTheme(id);
    toast("Theme: " + THEME_NAMES[id]);
  }
  function setMotion(m) {
    motion = MOTIONS.includes(m) ? m : "moderate";
    root.setAttribute("data-motion", motion);
  }
  function cycleMotion() {
    setMotion(MOTIONS[(MOTIONS.indexOf(motion) + 1) % MOTIONS.length]);
    toast("Motion: " + motion);
  }

  // ---------------------------------------------------------------------------
  // Laser pointer (L) and pen (D; C clears). Ink is kept per slide. Both work
  // from the presenter window too, and show on the audience screen.
  // ---------------------------------------------------------------------------

  let tool = null;
  const laser = doc.createElement("div");
  laser.className = "deck-laser";
  laser.setAttribute("aria-hidden", "true");
  const ink = doc.createElement("canvas");
  ink.className = "deck-ink";
  ink.width = W;
  ink.height = H;
  ink.setAttribute("aria-hidden", "true");
  const inkLines = new Map();
  let inkLine = null;
  let pvInk = null;
  const INK = { color: "#ff2d55", width: 7 };
  function inkTargets() {
    const t = [ink.getContext("2d")];
    if (pvInk && presenter && !presenter.closed) t.push(pvInk.getContext("2d"));
    return t;
  }
  function strokeSeg(g, a, b) {
    g.strokeStyle = INK.color;
    g.lineWidth = INK.width;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }
  function showInk() {
    const lines = inkLines.get(slides[cur]) || [];
    for (const g of inkTargets()) {
      g.clearRect(0, 0, W, H);
      for (const line of lines)
        for (let k = 1; k < line.length; k++)
          strokeSeg(g, line[k - 1], line[k]);
    }
  }
  function inkDown(x, y) {
    inkLine = [[x, y]];
    const s = slides[cur];
    if (!inkLines.has(s)) inkLines.set(s, []);
    inkLines.get(s).push(inkLine);
    for (const g of inkTargets()) strokeSeg(g, [x, y], [x + 0.1, y]);
  }
  function inkMove(x, y) {
    if (!inkLine) return;
    const last = inkLine[inkLine.length - 1];
    if (Math.hypot(x - last[0], y - last[1]) < 1.5) return;
    inkLine.push([x, y]);
    for (const g of inkTargets()) strokeSeg(g, last, [x, y]);
  }
  const inkUp = () => (inkLine = null);
  function clearInk() {
    inkLines.delete(slides[cur]);
    showInk();
  }
  function laserAt(x, y) {
    if (x === null) return laser.classList.remove("is-on");
    laser.style.translate = `${x}px ${y}px`;
    laser.classList.add("is-on");
  }
  function setTool(t) {
    tool = t;
    for (const d of [
      doc,
      presenter && !presenter.closed && presenter.document,
    ]) {
      if (!d) continue;
      d.body.classList.toggle("is-laser", t === "laser");
      d.body.classList.toggle("is-pen", t === "pen");
      for (const b of d.querySelectorAll(
        "[data-ctl='laser'], [data-pv='laser']",
      ))
        b.setAttribute("aria-pressed", String(t === "laser"));
      for (const b of d.querySelectorAll("[data-ctl='pen'], [data-pv='pen']"))
        b.setAttribute("aria-pressed", String(t === "pen"));
    }
    if (t !== "laser") laserAt(null);
    if (t)
      toast(
        t === "laser"
          ? "Laser pointer on (L)"
          : "Pen on: draw on the slide (D, C clears)",
      );
  }
  // Client point -> canvas point, for the stage or any box showing a slide.
  function toCanvas(box, cx, cy) {
    const r = box.getBoundingClientRect();
    return [((cx - r.left) / r.width) * W, ((cy - r.top) / r.height) * H];
  }
  ink.addEventListener("pointerdown", (e) => {
    if (tool !== "pen" || e.button !== 0) return;
    ink.setPointerCapture(e.pointerId);
    inkDown(...toCanvas(stage, e.clientX, e.clientY));
    e.preventDefault();
  });
  ink.addEventListener("pointermove", (e) => {
    if (tool === "pen" && inkLine)
      inkMove(...toCanvas(stage, e.clientX, e.clientY));
  });
  ink.addEventListener("pointerup", inkUp);
  ink.addEventListener("pointercancel", inkUp);
  stage.addEventListener("pointermove", (e) => {
    if (tool === "laser") laserAt(...toCanvas(stage, e.clientX, e.clientY));
  });
  stage.addEventListener("pointerleave", () => laserAt(null));

  function toggleFullscreen() {
    if (doc.fullscreenElement) doc.exitFullscreen().catch(() => {});
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Presenting (P), like PowerPoint's presenter view. With two screens (and a
  // browser that has the Window Management API: Chrome, Edge) the slides go full
  // screen on the other screen and the presenter view opens on this one. Without,
  // the presenter view opens in a window and the slides stay here (drag this
  // window to the projector and press F).
  // ---------------------------------------------------------------------------

  async function present() {
    if (presenter && !presenter.closed) return presenter.focus();
    let details = null;
    if ("getScreenDetails" in window && screen.isExtended !== false) {
      try {
        details = await window.getScreenDetails();
      } catch {
        details = null;
      }
    }
    const screens = details ? details.screens : [];
    if (screens.length < 2) {
      openPresenter(null);
      if (presenter && !presenter.closed && screen.isExtended)
        toast("Drag the slides window to the projector, then press F", 4000);
      return;
    }
    const here = details.currentScreen;
    const audience =
      screens.find((s) => s !== here && !s.isInternal) ||
      screens.find((s) => s !== here);
    try {
      await root.requestFullscreen({ screen: audience });
    } catch {
      toast("Screens allowed. Press P again to present on two screens", 4000);
      return;
    }
    openPresenter(here);
  }

  let presenter = null;
  let startedAt = 0;
  let pausedAt = 0;
  let presenterTimer = 0;
  let notesSize = 22;
  try {
    notesSize = Number(localStorage.getItem("deck-notes-size")) || 22;
  } catch {
    /* storage blocked */
  }
  function openPresenter(where) {
    if (presenter && !presenter.closed) return presenter.focus();
    const place = where
      ? `,left=${where.availLeft},top=${where.availTop},width=${where.availWidth},height=${where.availHeight}`
      : ",width=1280,height=800";
    const w = open("", "deck-presenter", "popup" + place);
    if (!w)
      return toast(
        "Allow pop-ups for this page to open the presenter view",
        3200,
      );
    presenter = w;
    startedAt = Date.now();
    pausedAt = 0;
    const styles = [...doc.querySelectorAll('link[rel="stylesheet"], style')]
      .map((n) =>
        n.tagName === "LINK"
          ? `<link rel="stylesheet" href="${esc(n.href)}">`
          : `<style>${n.textContent}</style>`,
      )
      .join("");
    const pvIcon = (name, label, extra = "") =>
      `<button type="button" data-pv="${name}" title="${label}" aria-label="${label}"${extra}>${CTL_ICONS[name] || ""}</button>`;
    w.document.open();
    w.document
      .write(`<!doctype html><html data-theme="${esc(root.getAttribute("data-theme") || "")}" data-motion="none"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Presenter · ${esc(doc.title)}</title>${styles}</head>
      <body class="deck-presenter">
        <section class="pv-now"><div class="pv-label">Now <span class="pv-count"></span></div><div class="pv-screen" data-pv-screen="now"></div>
          <div class="pv-tools">
            <button type="button" data-pv="prev" class="pv-big">◀ Back</button>
            <button type="button" data-pv="next" class="pv-big">Next ▶</button>
            ${pvIcon("laser", "Laser pointer (L): point on this slide and it shows on the screen", ' aria-pressed="false"')}
            ${pvIcon("pen", "Pen (D): draw on this slide; it shows on the screen", ' aria-pressed="false"')}
            <button type="button" data-pv="clear" title="Clear the drawing (C)">Clear ink</button>
            <button type="button" data-pv="black" title="Black screen for the audience (B)">Black</button>
            <select class="pv-jump" aria-label="Go to slide"></select>
          </div>
        </section>
        <aside class="pv-side">
          <div class="pv-label">Next</div><div class="pv-screen" data-pv-screen="next"></div>
          <div class="pv-meta"><button type="button" class="pv-timer" title="Click to pause, double-click to restart">00:00</button><span class="pv-clock"></span></div>
          <div class="pv-label pv-notes-head">Notes <span><button type="button" data-pv="smaller" title="Smaller notes">A−</button><button type="button" data-pv="bigger" title="Bigger notes">A+</button></span></div>
          <div class="pv-notes"></div>
        </aside>
      </body></html>`);
    w.document.close();
    const d = w.document;
    d.documentElement.style.setProperty("--pv-notes-size", notesSize + "px");
    d.addEventListener("keydown", onKey);
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pv]");
      if (b) {
        const act = b.getAttribute("data-pv");
        if (act === "next") next();
        else if (act === "prev") prev();
        else if (act === "laser") setTool(tool === "laser" ? null : "laser");
        else if (act === "pen") setTool(tool === "pen" ? null : "pen");
        else if (act === "clear") clearInk();
        else if (act === "black") blackout("black");
        else if (act === "smaller" || act === "bigger") {
          notesSize = Math.max(
            14,
            Math.min(48, notesSize + (act === "bigger" ? 2 : -2)),
          );
          d.documentElement.style.setProperty(
            "--pv-notes-size",
            notesSize + "px",
          );
          try {
            localStorage.setItem("deck-notes-size", String(notesSize));
          } catch {
            /* storage blocked */
          }
        }
        if (e.detail > 0) b.blur();
      }
      if (e.target.closest(".pv-timer")) {
        if (pausedAt) {
          startedAt += Date.now() - pausedAt;
          pausedAt = 0;
        } else pausedAt = Date.now();
        tickPresenter();
      }
    });
    d.querySelector(".pv-timer").addEventListener("dblclick", () => {
      startedAt = Date.now();
      pausedAt = 0;
      tickPresenter();
    });
    d.querySelector(".pv-jump").addEventListener("change", (e) => {
      jump(Number(e.target.value));
      e.target.blur();
    });
    // Point or draw on "Now" and it shows on the audience screen.
    const nowBox = d.querySelector('[data-pv-screen="now"]');
    nowBox.addEventListener("pointermove", (e) => {
      if (tool === "laser") laserAt(...toCanvas(nowBox, e.clientX, e.clientY));
      else if (tool === "pen" && inkLine)
        inkMove(...toCanvas(nowBox, e.clientX, e.clientY));
    });
    nowBox.addEventListener("pointerdown", (e) => {
      if (tool !== "pen" || e.button !== 0) return;
      nowBox.setPointerCapture(e.pointerId);
      inkDown(...toCanvas(nowBox, e.clientX, e.clientY));
      e.preventDefault();
    });
    nowBox.addEventListener("pointerup", inkUp);
    nowBox.addEventListener(
      "pointerleave",
      () => tool === "laser" && laserAt(null),
    );
    w.addEventListener("resize", () => updatePresenter());
    w.addEventListener("pagehide", () => {
      laserAt(null);
      pvInk = null;
    });
    clearInterval(presenterTimer);
    presenterTimer = setInterval(tickPresenter, 1000);
    setTool(tool);
    updatePresenter();
  }
  function tickPresenter() {
    if (!presenter || presenter.closed) return clearInterval(presenterTimer);
    const sec = Math.floor(((pausedAt || Date.now()) - startedAt) / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    const d = presenter.document;
    const timer = d.querySelector(".pv-timer");
    timer.textContent =
      (sec >= 3600 ? Math.floor(sec / 3600) + ":" : "") +
      pad(Math.floor(sec / 60) % 60) +
      ":" +
      pad(sec % 60);
    timer.classList.toggle("is-paused", !!pausedAt);
    d.querySelector(".pv-clock").textContent = new Date().toLocaleTimeString(
      [],
      { hour: "numeric", minute: "2-digit" },
    );
  }
  function updatePresenter() {
    if (!presenter || presenter.closed) return;
    const d = presenter.document;
    const s = slides[cur];
    const fill = (name, slide, all) => {
      const box = d.querySelector(`[data-pv-screen="${name}"]`);
      box.textContent = "";
      if (!slide) {
        box.innerHTML = '<p class="pv-end">End of deck</p>';
        return null;
      }
      const frame = d.createElement("div");
      frame.className = "pv-frame is-frozen";
      frame.style.zoom = String(box.clientWidth / W || 0.3);
      frame.append(d.importNode(cloneSlide(slide, all), true));
      box.append(frame);
      return box;
    };
    const nowBox = fill("now", s, false);
    if (nowBox) {
      pvInk = d.createElement("canvas");
      pvInk.className = "pv-ink";
      pvInk.width = W;
      pvInk.height = H;
      nowBox.append(pvInk);
    }
    const k = s.__step < s.__order.length ? cur : nextIndex(cur);
    fill("next", k === cur ? s : slides[k], true);
    const notes = s.querySelector(".notes");
    d.querySelector(".pv-notes").innerHTML =
      notes && notes.innerHTML.trim()
        ? notes.innerHTML
        : '<p class="pv-none">No notes for this slide.</p>';
    d.querySelector(".pv-count").textContent =
      `${cur + 1} of ${slides.length}` +
      (s.__order.length ? ` · build ${s.__step}/${s.__order.length}` : "") +
      (s.hasAttribute("data-hidden") ? " · hidden slide" : "");
    const jumpEl = d.querySelector(".pv-jump");
    if (jumpEl.options.length !== slides.length) {
      jumpEl.innerHTML = slides
        .map(
          (x, i) =>
            `<option value="${i}">${i + 1}. ${esc(slideTitle(x) || x.id || "Slide")}${x.hasAttribute("data-hidden") ? " (hidden)" : ""}</option>`,
        )
        .join("");
    }
    jumpEl.value = String(cur);
    showInk();
    tickPresenter();
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  let digits = "";
  let digitTimer = 0;
  const typingIn = (t) =>
    t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const activates = (t) =>
    t &&
    t.closest &&
    t.closest(
      "button, a[href], summary, [role='button'], [data-set], [data-toggle], [data-goto]",
    );

  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (typingIn(t)) {
      if (e.key === "Escape") closeOverlay();
      return;
    }
    const k = e.key;
    if (overlay && overlay.classList.contains("deck-overview"))
      return overviewKey(e);
    if (overlay && !overlay.classList.contains("deck-editor")) {
      closeOverlay();
      e.preventDefault();
      return;
    }
    if ((k === " " || k === "Enter") && !digits && activates(t)) return;
    if (/^[0-9]$/.test(k)) {
      digits += k;
      clearTimeout(digitTimer);
      digitTimer = setTimeout(() => (digits = ""), 2000);
      toast(`Go to slide ${digits}…`, 2000);
      e.preventDefault();
      return;
    }
    let handled = true;
    switch (k) {
      case "Enter":
        if (digits) {
          jump(resolve(digits));
          digits = "";
        } else next();
        break;
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
        next();
        break;
      case " ":
        if (e.shiftKey) prev();
        else next();
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
      case "Backspace":
        prev();
        break;
      case "Home":
        jump(slides.findIndex((s) => !s.hasAttribute("data-hidden")));
        break;
      case "End":
        jump(prevIndex(slides.length));
        break;
      case "Escape":
        if (tool) setTool(null);
        else if (!closeOverlay()) openOverview();
        break;
      case "o":
      case "O":
        if (!closeOverlay()) openOverview();
        break;
      case "f":
      case "F":
        toggleFullscreen();
        break;
      case "p":
      case "P":
        present();
        break;
      case "l":
      case "L":
        setTool(tool === "laser" ? null : "laser");
        break;
      case "d":
      case "D":
        setTool(tool === "pen" ? null : "pen");
        break;
      case "c":
      case "C":
        clearInk();
        break;
      case "e":
      case "E":
        openEditor();
        break;
      case "t":
        cycleTheme(1);
        break;
      case "T":
        cycleTheme(-1);
        break;
      case "m":
      case "M":
        cycleMotion();
        break;
      case "b":
      case "B":
      case ".":
        blackout("black");
        break;
      case "w":
      case "W":
        blackout("white");
        break;
      case "?":
      case "h":
      case "H":
        openHelp();
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onStageClick(e) {
    if (overlay || e.button !== 0 || tool === "pen") return;
    const t = e.target;
    const go = t.closest && t.closest("[data-goto]");
    if (go) {
      jump(resolve(go.getAttribute("data-goto")));
      return;
    }
    // data-goto-step="n": this slide at build step n (a phone's button, a list of steps).
    const gs = t.closest && t.closest("[data-goto-step]");
    if (gs) {
      goStep(gs.getAttribute("data-goto-step"));
      return;
    }
    if (
      t.closest(
        "a, button, input, select, textarea, label, summary, video, audio, iframe, [contenteditable], [data-interactive], [data-set], [data-toggle], .no-advance",
      )
    )
      return;
    const sel = getSelection && getSelection();
    if (sel && String(sel).trim()) return;
    // On touch screens, a tap on the left third goes back.
    if (e.pointerType === "touch") {
      const r = stage.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 3) return prev();
    }
    next();
  }

  let touchX = null;
  let touchY = 0;
  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (
      Math.abs(dx) > 50 &&
      Math.abs(dx) > Math.abs(dy) * 1.5 &&
      !e.target.closest("[data-interactive]")
    ) {
      if (dx < 0) next();
      else prev();
    }
  }

  let idleTimer = 0;
  function onPointerMove(e) {
    doc.body.classList.add("is-pointer");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => doc.body.classList.remove("is-pointer"), 2200);
    if (motion === "heavy" && slides[cur]) {
      const r = stage.getBoundingClientRect();
      slides[cur].style.setProperty(
        "--px",
        (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3),
      );
      slides[cur].style.setProperty(
        "--py",
        (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3),
      );
    }
  }

  function fit() {
    const k = Math.min(innerWidth / W, innerHeight / H);
    stage.style.setProperty("--scale", String(k > 0 ? k : 1));
  }

  // Shows every slide in its final state (all builds shown, counters at their end values).
  function finishAll() {
    for (const s of slides) {
      s.__step = s.__order.length;
      applySteps(s, false);
      for (const el of s.querySelectorAll("[data-count]")) {
        const v = toNum(el.getAttribute("data-count"));
        if (!isNaN(v)) el.textContent = counterText(el, v);
      }
      for (const el of s.querySelectorAll('[data-anim="type"]')) {
        if (el.__full !== undefined) el.textContent = el.__full;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Audit (used by scripts/check.mjs): layout problems per slide.
  // ---------------------------------------------------------------------------

  function describe(el) {
    let d = el.tagName.toLowerCase();
    if (el.classList.length)
      d +=
        "." +
        [...el.classList]
          .filter((c) => !c.startsWith("is-"))
          .slice(0, 3)
          .join(".");
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    return text
      ? `${d} "${text.slice(0, 48)}${text.length > 48 ? "…" : ""}"`
      : d;
  }
  function visibleRect(el, slide) {
    let r = el.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let p = el.parentElement; p && p !== slide; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
        const pr = p.getBoundingClientRect();
        box = {
          l: Math.max(box.l, pr.left),
          t: Math.max(box.t, pr.top),
          r: Math.min(box.r, pr.right),
          b: Math.min(box.b, pr.bottom),
        };
      }
    }
    return box;
  }
  // Words a viewer reads: not notes, SVG text, styles, scripts, code or app mockups.
  function slideWords(s) {
    const walker = doc.createTreeWalker(s, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement.closest(
          ".notes, .slide-chrome, svg, style, script, template, .screen, .is-off, .code, pre",
        )
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let text = "";
    while (walker.nextNode()) text += " " + walker.currentNode.nodeValue;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  const ownText = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());

  function audit() {
    const wasStatic = root.classList.contains("is-static");
    root.classList.add("is-measuring", "is-static");
    const saved = slides.map((s) => s.__step);
    finishAll();
    const report = {
      title: doc.title,
      theme: root.getAttribute("data-theme"),
      motion,
      slideCount: slides.length,
      hiddenCount: slides.filter((s) => s.hasAttribute("data-hidden")).length,
      missingData: [...missing],
      issues: issues.slice(),
      slides: [],
    };
    slides.forEach((s, i) => {
      const sr = s.getBoundingClientRect();
      const k = sr.width / W || 1;
      const problems = [];
      const flagged = [];
      const add = (el, type, detail) => {
        if (flagged.some((f) => f.contains(el))) return;
        flagged.push(el);
        if (problems.length < 8)
          problems.push({ type, element: describe(el), detail });
      };
      for (const el of s.querySelectorAll("*")) {
        if (
          el.closest(
            ".notes, .slide-chrome, [data-bleed], .bleed, [aria-hidden='true'], .is-off, .is-gone, .blob, [data-decor], .deck-annot",
          )
        )
          continue;
        if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.display === "contents") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) continue;
        const v = visibleRect(el, s);
        const out =
          Math.max(
            sr.left - v.l,
            v.r - sr.right,
            sr.top - v.t,
            v.b - sr.bottom,
          ) / k;
        if (out > 4 && v.r > v.l && v.b > v.t)
          add(el, "off-slide", `${Math.round(out)}px outside the slide`);
        else if (cs.display !== "inline" && el.clientHeight > 0) {
          // Big type with tight line height overhangs its line box a little; allow for it.
          const fs = parseFloat(cs.fontSize) || 16;
          const over = el.scrollHeight - el.clientHeight - fs * 0.3;
          const overX = el.scrollWidth - el.clientWidth - fs * 0.12;
          if (
            (over > 6 || overX > 6) &&
            el.tagName !== "svg" &&
            !el.matches(".chart, .chart *")
          ) {
            const clipped = /(hidden|clip)/.test(cs.overflowY + cs.overflowX);
            add(
              el,
              clipped ? "cut-off" : "overflow",
              `content is ${Math.round(Math.max(over, overX))}px bigger than its box`,
            );
          }
        }
        // App mockups use app-sized text; elsewhere text under 20px is hard to read.
        const minSize = el.closest(
          ".screen, .device-browser > .bar, [data-small-ok]",
        )
          ? 13
          : 20;
        if (
          ownText(el) &&
          parseFloat(cs.fontSize) < minSize &&
          !el.closest(".chart")
        ) {
          add(
            el,
            "small-text",
            `${Math.round(parseFloat(cs.fontSize))}px text (aim for 22px or more on a 1920px slide)`,
          );
        }
      }
      for (const img of s.querySelectorAll("img")) {
        if (img.complete && img.naturalWidth === 0)
          problems.push({
            type: "image",
            element: describe(img),
            detail: "image did not load: " + img.getAttribute("src"),
          });
      }
      const words = slideWords(s);
      if (words > 110)
        problems.push({
          type: "dense",
          element: "slide",
          detail: `${words} words; aim for under 70`,
        });
      for (const list of s.querySelectorAll("ul, ol")) {
        if (
          list.children.length > 7 &&
          !list.closest(".is-off, .notes, .screen")
        )
          problems.push({
            type: "long-list",
            element: describe(list),
            detail: `${list.children.length} items; split it or group them`,
          });
      }
      if (!words && !s.querySelector("img, svg, video, canvas, iframe, .chart"))
        problems.push({
          type: "empty",
          element: "slide",
          detail: "nothing on this slide",
        });
      const title = s.querySelector("h1, h2, h3");
      report.slides.push({
        n: i + 1,
        id: s.id || undefined,
        title: title ? title.textContent.trim().replace(/\s+/g, " ") : "",
        layout:
          [...s.classList].filter((c) => c.startsWith("layout-")).join(" ") ||
          undefined,
        hidden: s.hasAttribute("data-hidden") || undefined,
        builds: s.__order.length,
        transition:
          i > 0
            ? transitionFor(s, slides[Math.max(0, prevIndex(i))], 1)
            : undefined,
        words,
        notes: !!(
          s.querySelector(".notes") &&
          s.querySelector(".notes").textContent.trim()
        ),
        problems,
      });
    });
    slides.forEach((s, i) => {
      s.__step = saved[i];
      applySteps(s, false);
    });
    root.classList.remove("is-measuring");
    if (!wasStatic) root.classList.remove("is-static");
    return report;
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  const titleEl = doc.querySelector("head > title");
  if (titleEl) renderTree(titleEl, data);
  renderTree(stage, data);
  setupIcons();
  slides = [...stage.children].filter((el) => el.matches("section.slide"));
  if (!slides.length) {
    console.warn('[deck] no <section class="slide"> inside .deck');
    return;
  }
  slides.forEach(setupSlide);
  for (const box of [
    ...slides,
    ...stage.querySelectorAll("[data-interactive]"),
  ]) {
    box.__initial = box.getAttribute("data-state") || "";
    box.__tour = [];
    if (box.hasAttribute("data-state")) writeState(box, readState(box));
    applyState(box, { instant: true });
  }

  setMotion(
    params.get("motion") || root.getAttribute("data-motion") || "moderate",
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (
    reduced &&
    !params.get("motion") &&
    (motion === "moderate" || motion === "heavy")
  )
    setMotion("subtle");
  if (params.get("theme")) setTheme(params.get("theme"));
  if (params.has("static") || params.has("sheet"))
    root.classList.add("is-static");
  if (params.has("print")) root.classList.add("is-print");
  if (params.has("sheet")) root.classList.add("is-sheet");

  stage.append(ink, laser);
  stage.addEventListener("pointerdown", notePress, true);
  doc.body.append(ui, controls, toastEl, srEl);
  fit();
  renderCharts(false);

  let start = Number(params.get("slide")) - 1;
  if (!(start >= 0)) start = indexFromHash();
  if (!(start >= 0))
    start = Math.max(
      0,
      slides.findIndex((s) => !s.hasAttribute("data-hidden")),
    );
  go(start, { instant: true, force: true });
  if (
    root.classList.contains("is-print") ||
    root.classList.contains("is-sheet")
  )
    finishAll();
  if (root.classList.contains("is-sheet")) {
    slides.forEach((s, i) => {
      const n = doc.createElement("span");
      n.className = "deck-sheet-n";
      n.textContent = String(i + 1);
      s.append(n);
    });
  }

  addEventListener("resize", fit);
  addEventListener("hashchange", () => {
    const i = indexFromHash();
    if (i >= 0 && i !== cur) jump(i);
  });
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("click", onStateClick);
  doc.addEventListener("input", onStateInput);
  doc.addEventListener("keydown", onStateEnter);
  stage.addEventListener("click", onStageClick);
  stage.addEventListener("touchstart", onTouchStart, { passive: true });
  stage.addEventListener("touchend", onTouchEnd);
  addEventListener("pointermove", onPointerMove, { passive: true });
  addEventListener("pointerdown", onPointerMove, { passive: true });
  let printStep = 0;
  addEventListener("beforeprint", () => {
    printStep = slides[cur].__step;
    root.classList.add("is-print");
    finishAll();
    mountAll();
  });
  addEventListener("afterprint", () => {
    if (!params.has("print")) root.classList.remove("is-print");
    slides[cur].__step = printStep;
    applySteps(slides[cur], false);
  });
  addEventListener("beforeunload", () => {
    if (presenter && !presenter.closed) presenter.close();
  });

  const quiet = /is-(static|print|sheet)/.test(root.className);
  if (usingEdits && !quiet)
    toast("Showing edited data · press E to change or reset", 3000);
  else if (!quiet) {
    let seen = false;
    try {
      seen = sessionStorage.getItem("deck-hint") === "1";
      sessionStorage.setItem("deck-hint", "1");
    } catch {
      /* storage blocked */
    }
    if (!seen)
      setTimeout(() => toast("Press ? for keyboard shortcuts", 2600), 700);
  }

  const ready = (async () => {
    try {
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
    } catch {
      /* fonts API unavailable */
    }
    await Promise.all(
      [...stage.querySelectorAll("img")].map((img) =>
        img.complete
          ? null
          : new Promise((done) => {
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              setTimeout(done, 8000);
            }),
      ),
    );
    renderCharts(true);
    return true;
  })();

  window.deck = {
    ready,
    // go(3) is a slide index; go("pricing") is a slide id, like goTo
    go: (i, opts) =>
      typeof i === "string" && !/^\s*\d+\s*$/.test(i)
        ? jump(resolve(i))
        : go(i, Object.assign({ force: true }, opts)),
    next,
    prev,
    goTo: (target) => jump(resolve(target)),
    goStep,
    get index() {
      return cur;
    },
    get step() {
      return slides[cur] ? slides[cur].__step : 0;
    },
    get slides() {
      return slides;
    },
    get data() {
      return data;
    },
    audit,
    setTheme,
    setMotion,
    themes: THEMES,
    toast,
    mount,
    mountAll,
    settled,
    seekTransition,
    endTransition: settleTransition,
    transitions: TRANSITIONS,
    get static() {
      return isStatic() || /is-(print|sheet)/.test(root.className);
    },
  };
})();
