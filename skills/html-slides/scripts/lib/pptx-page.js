// Runs inside the deck page (export-pptx.mjs injects it). Reads the current slide into a
// plan for PowerPoint: editable text boxes (runs, line breaks, alignment), pictures for
// builds and morphs, native charts, links, notes. Then switches the page into capture
// modes so export-pptx can screenshot the background and each picture without text.
(() => {
  const W = 1920;
  const H = 1080;
  const stage = document.querySelector(".deck");

  // Kept as pictures: graphics, app mockups (.screen), code-drawn widgets.
  const KEEP_AS_PICTURE =
    ".notes, .slide-chrome, svg, canvas, video, iframe, img, .screen, [data-chart], .chart, .deck-annot, script, style, template, [aria-hidden='true'], [data-pptx='picture'], .deck-mg, .deck-ink, .deck-laser";
  const ICON = "svg, img, [data-icon], i.icon, .icon";

  const css = (el) => getComputedStyle(el);
  let k = 1;
  const box = () => {
    const r = stage.getBoundingClientRect();
    k = r.width / W;
    return r;
  };
  let origin = { left: 0, top: 0 };
  const toCanvas = (r) => ({
    x: (r.left - origin.left) / k,
    y: (r.top - origin.top) / k,
    w: r.width / k,
    h: r.height / k,
  });

  // Any CSS color (rgb, hex, oklch, color-mix...) to { hex, alpha }, read from a painted pixel.
  const pixel = document.createElement("canvas");
  pixel.width = pixel.height = 1;
  const probe = pixel.getContext("2d", { willReadFrequently: true });
  function rgba(color) {
    if (!color || color === "transparent" || color === "none") return null;
    let r, g, b, a;
    const m = color.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      [r, g, b, a = 1] = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
    } else {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = "#000";
      probe.fillStyle = color;
      probe.fillRect(0, 0, 1, 1);
      const d = probe.getImageData(0, 0, 1, 1).data;
      [r, g, b, a] = [d[0], d[1], d[2], d[3] / 255];
    }
    const hex = [r, g, b]
      .map((n) => Math.round(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    return { hex, alpha: a };
  }

  const GENERIC =
    /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|-apple-system|blinkmacsystemfont)$/i;
  function firstFamily(list) {
    const names = list
      .split(",")
      .map((f) => f.trim().replace(/^["']|["']$/g, ""));
    return names.find((f) => f && !GENERIC.test(f)) || "";
  }
  // A translucent color as the solid color it shows over the slide background.
  // The solid hex a color looks like over bg, optionally at an extra opacity.
  function solidOver(color, bg, alpha = 1) {
    probe.clearRect(0, 0, 1, 1);
    probe.globalAlpha = 1;
    probe.fillStyle = bg || "#fff";
    probe.fillRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = color;
    probe.globalAlpha = alpha;
    probe.fillRect(0, 0, 1, 1);
    probe.globalAlpha = 1;
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  function genericFamily(list) {
    if (/monospace/.test(list)) return "mono";
    if (/(^|,)\s*serif/.test(list)) return "serif";
    return "sans";
  }

  function visible(el) {
    if (!el.getClientRects().length) return false;
    const cs = css(el);
    return cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.02;
  }
  function opacityOf(el, slide) {
    let o = 1;
    for (let e = el; e && e !== slide.parentElement; e = e.parentElement)
      o *= parseFloat(css(e).opacity);
    return o;
  }
  function angleOf(el, slide) {
    let deg = 0;
    for (let e = el; e && e !== slide; e = e.parentElement) {
      const cs = css(e);
      if (cs.transform && cs.transform !== "none") {
        const m = cs.transform.match(/matrix\(([^)]+)\)/);
        if (m) {
          const [a, b] = m[1].split(",").map(Number);
          deg += (Math.atan2(b, a) * 180) / Math.PI;
        }
      }
      if (cs.rotate && cs.rotate !== "none") deg += parseFloat(cs.rotate) || 0;
    }
    return Math.abs(deg) < 0.3 ? 0 : deg;
  }

  // Inline content that flows inside a text block.
  function phrasing(el) {
    if (el.matches("br")) return true;
    if (el.matches(ICON)) return true;
    const d = css(el).display;
    if (d === "none") return true;
    if (!/^(inline|inline-block|inline-flex|inline-grid|contents)$/.test(d))
      return false;
    return [...el.children].every(phrasing);
  }
  function hasText(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode;
      if (t.nodeValue.trim() && !t.parentElement.closest(KEEP_AS_PICTURE))
        return true;
    }
    return false;
  }
  function isTextBlock(el) {
    if (!hasText(el)) return false;
    const d = css(el).display;
    if (/^(inline|contents)$/.test(d)) return false;
    const kids = [...el.children].filter((c) => css(c).display !== "none");
    if (/flex|grid/.test(d)) {
      const direct = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.nodeValue.trim(),
      );
      return direct && kids.every((c) => c.matches(ICON + ", br, .deck-annot"));
    }
    return kids.every((c) => c.matches(".deck-annot") || phrasing(c));
  }
  function collect(el, out) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        if (n.nodeValue.trim()) out.push({ node: n, el: n.parentElement });
        continue;
      }
      if (n.nodeType !== 1 || n.matches(KEEP_AS_PICTURE) || !visible(n))
        continue;
      if (isTextBlock(n)) out.push({ el: n });
      else collect(n, out);
    }
  }

  // Text runs, split into the lines the browser drew.
  function textNodesOf(block) {
    if (block.node) return [block.node];
    const out = [];
    const w = document.createTreeWalker(block.el, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) =>
        t.parentElement.closest(KEEP_AS_PICTURE) || !visible(t.parentElement)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  function runStyle(p, slide) {
    const cs = css(p);
    let col = rgba(cs.webkitTextFillColor) || rgba(cs.color);
    if (!col || col.alpha === 0) {
      const m = cs.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
      col = (m && rgba(m[0])) || rgba(cs.color) || { hex: "000000", alpha: 1 };
    }
    const deco = cs.textDecorationLine || "";
    const link = p.closest("a[href]");
    const go = p.closest("[data-goto]");
    return {
      font: firstFamily(cs.fontFamily),
      family: cs.fontFamily,
      generic: genericFamily(cs.fontFamily),
      size: parseFloat(cs.fontSize),
      weight: parseInt(cs.fontWeight, 10) || 400,
      bold: parseInt(cs.fontWeight, 10) >= 600,
      italic: cs.fontStyle === "italic",
      underline: deco.includes("underline"),
      strike: deco.includes("line-through"),
      color: col.hex,
      alpha: col.alpha * opacityOf(p, slide),
      spacing: parseFloat(cs.letterSpacing) || 0,
      transform: cs.textTransform,
      valign: cs.verticalAlign,
      href: link ? link.href : undefined,
      goto: go ? go.getAttribute("data-goto") : undefined,
      pre: /^pre/.test(cs.whiteSpace),
    };
  }
  const caseOf = (text, t) =>
    t === "uppercase"
      ? text.toUpperCase()
      : t === "lowercase"
        ? text.toLowerCase()
        : t === "capitalize"
          ? text.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
          : text;

  // How far below the top of a text range's box its baseline sits, as a fraction of the
  // font size. Measured off-slide with a zero-height inline-block standing on the baseline,
  // because layout uses different font metrics than canvas does.
  const ascents = new Map();
  function ascentOf(st) {
    const key = [st.family, st.weight, st.italic].join("|");
    if (!ascents.has(key)) {
      const div = document.createElement("div");
      div.style.cssText = `position:absolute;left:-9999px;top:0;white-space:nowrap;line-height:normal;font-size:100px;font-weight:${st.weight};font-style:${st.italic ? "italic" : "normal"}`;
      div.style.fontFamily = st.family;
      const text = document.createTextNode("Hg");
      const mark = document.createElement("span");
      mark.style.cssText =
        "display:inline-block;width:0;height:0;vertical-align:baseline";
      div.append(text, mark);
      document.body.append(div);
      const range = document.createRange();
      range.selectNodeContents(text);
      const top = range.getClientRects()[0]?.top;
      const base = mark.getBoundingClientRect().top;
      div.remove();
      ascents.set(key, top === undefined ? 0.9 : (base - top) / 100);
    }
    return ascents.get(key) * st.size;
  }

  function readText(block, slide) {
    let baseline = null; // the first line's baseline, viewport px
    const lines = [[]];
    let lastTop = null;
    const rects = [];
    let lineH = Infinity;
    for (const t of textNodesOf(block)) {
      const st = runStyle(t.parentElement, slide);
      const lh = parseFloat(css(t.parentElement).lineHeight) || st.size * 1.2;
      lineH = Math.min(lineH, lh);
      const value = t.nodeValue;
      const re = st.pre ? /[^\n]+|\n/g : /\S+|\s+/g;
      let m;
      while ((m = re.exec(value))) {
        const tok = m[0];
        const line = lines[lines.length - 1];
        if (tok === "\n") {
          lines.push([]);
          lastTop = null;
          continue;
        }
        if (!st.pre && /^\s+$/.test(tok)) {
          if (line.length && !line[line.length - 1].text.endsWith(" "))
            line.push({ text: " ", st });
          continue;
        }
        const range = document.createRange();
        range.setStart(t, m.index);
        range.setEnd(t, m.index + tok.length);
        const rs = [...range.getClientRects()].filter((r) => r.width > 0);
        if (!rs.length) continue;
        for (const r of rs) rects.push(r);
        const top = rs[0].top;
        if (baseline === null) baseline = top + ascentOf(st) * k;
        if (lastTop !== null && top > lastTop + lh * 0.5 * k && line.length) {
          while (line.length && line[line.length - 1].text === " ") line.pop();
          lines.push([]);
        }
        lastTop =
          lastTop === null || top > lastTop + lh * 0.5 * k ? top : lastTop;
        lines[lines.length - 1].push({ text: caseOf(tok, st.transform), st });
      }
    }
    // Merge neighbouring tokens with the same style into runs.
    const out = lines
      .map((line) => {
        while (line.length && line[line.length - 1].text === " ") line.pop();
        const runs = [];
        for (const tok of line) {
          const last = runs[runs.length - 1];
          if (last && JSON.stringify(last.st) === JSON.stringify(tok.st))
            last.text += tok.text;
          else runs.push({ text: tok.text, st: tok.st });
        }
        for (const r of runs) r.kern = kernPerChar(r.text, r.st);
        return runs;
      })
      .filter((runs, i, all) => runs.length || (i > 0 && i < all.length - 1));
    return {
      lines: out,
      rects,
      lineH: lineH === Infinity ? 0 : lineH,
      baseline,
    };
  }

  // How much the browser's kerning tightens (or loosens) a run, per character, in CSS px.
  // PowerPoint only kerns with a legacy kern table, which web fonts rarely have, so the
  // exporter adds this to the run's character spacing to keep line widths the same.
  const measure = document.createElement("canvas").getContext("2d");
  function kernPerChar(text, st) {
    const chars = [...text].length;
    if (chars < 2 || !("fontKerning" in measure)) return 0;
    measure.font = `${st.italic ? "italic " : ""}${st.weight} ${st.size}px "${st.font}"`;
    measure.fontKerning = "normal";
    const kerned = measure.measureText(text).width;
    measure.fontKerning = "none";
    const plain = measure.measureText(text).width;
    return Math.round(((kerned - plain) / chars) * 1000) / 1000;
  }

  function union(rects) {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    for (const x of rects) {
      l = Math.min(l, x.left);
      t = Math.min(t, x.top);
      r = Math.max(r, x.right);
      b = Math.max(b, x.bottom);
    }
    return {
      left: l,
      top: t,
      width: r - l,
      height: b - t,
      right: r,
      bottom: b,
    };
  }

  // Does an element paint anything besides its text? (Else it needs no picture.)
  function paints(el) {
    const all = [el, ...el.querySelectorAll("*")];
    for (const e of all) {
      if (!visible(e)) continue;
      if (e.matches("svg, img, canvas, video, iframe, .screen")) return true;
      for (const pseudo of [null, "::before", "::after"]) {
        const cs = getComputedStyle(e, pseudo);
        if (pseudo && (cs.content === "none" || cs.content === "normal"))
          continue;
        const bg = rgba(cs.backgroundColor);
        if (bg && bg.alpha > 0.01) return true;
        if (
          cs.backgroundImage !== "none" &&
          !/text/.test(cs.backgroundClip || cs.webkitBackgroundClip || "")
        )
          return true;
        if (cs.boxShadow !== "none") return true;
        if (cs.maskImage && cs.maskImage !== "none") return true;
        for (const side of ["Top", "Right", "Bottom", "Left"]) {
          const bw = parseFloat(cs["border" + side + "Width"]);
          const bc = rgba(cs["border" + side + "Color"]);
          if (bw > 0 && bc && bc.alpha > 0.01) return true;
        }
        if (pseudo && cs.content.replace(/["']/g, "").trim()) return true;
      }
    }
    return false;
  }

  const parseList = (s, fallback) => {
    if (s === null || s === undefined || s.trim() === "") return fallback;
    try {
      return JSON.parse(s);
    } catch {
      return s.split(",").map((x) => x.trim());
    }
  };
  const toNum = (v) =>
    typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  function chartSpec(el) {
    const type = (el.getAttribute("data-chart") || "bar").trim();
    const labels = parseList(el.getAttribute("data-labels"), []).map(String);
    let series = parseList(el.getAttribute("data-series"), null);
    if (!Array.isArray(series))
      series = [
        {
          name: el.getAttribute("data-name") || "",
          values: parseList(el.getAttribute("data-values"), []),
        },
      ];
    const cs = css(el);
    const palette = [1, 2, 3, 4, 5, 6].map(
      (n) =>
        (rgba(cs.getPropertyValue(`--chart-${n}`).trim()) || {}).hex ||
        "888888",
    );
    const bgColor = cs.getPropertyValue("--bg").trim();
    let hi = el.getAttribute("data-highlight");
    if (hi !== null) hi = isNaN(+hi) ? labels.indexOf(hi) : +hi;
    const list = series.map((s, i) => ({
      name: s.name || "",
      values: (s.values || []).map(toNum).map((v) => (isNaN(v) ? 0 : v)),
      color: s.color ? (rgba(s.color) || {}).hex : palette[i % 6],
    }));
    return {
      type,
      labels,
      series: list,
      palette,
      highlight: hi !== null && hi >= 0 ? hi : null,
      // The other bars of a highlighted chart: the bar's own color at the 0.28 opacity
      // deck.css gives .chart .muted (not --line, which is near-black in some themes).
      muted: solidOver(
        "#" + (list[0] ? list[0].color : "888888"),
        bgColor,
        0.28,
      ),
      format: el.getAttribute("data-format") || "number",
      formatArg: el.getAttribute("data-format-arg"),
      showValues: el.getAttribute("data-show-values") !== "false",
      ink: (rgba(css(el).color) || {}).hex || "333333",
      ink2: solidOver(cs.getPropertyValue("--ink-2").trim(), bgColor),
      // Gridlines: the browser draws them thin and dashed; a solid PowerPoint line at full
      // --line strength reads much heavier, so it's lightened.
      line: solidOver(cs.getPropertyValue("--line").trim(), bgColor, 0.45),
      axis: solidOver(cs.getPropertyValue("--ink-3").trim(), bgColor),
      font: firstFamily(cs.fontFamily),
      fontSize: parseFloat(cs.fontSize),
    };
  }

  const MARK = "data-px";
  // Generated content (a decorative quote mark, a counter, a drawn bullet) stays in the
  // picture, in its own colors, while the element's text is hidden for the text box.
  // A list item's own bullet (::marker) can't be kept when its text is hidden (the marker's
  // fill follows the text's), so during capture it's drawn as a ::before in its place.
  const MARKERS = { disc: '"•"', circle: '"◦"', square: '"▪"' };
  function pinMarker(e) {
    if (e.tagName !== "LI") return;
    const cs = css(e);
    if (
      cs.display !== "list-item" ||
      cs.listStyleType === "none" ||
      cs.listStyleImage !== "none"
    )
      return;
    const before = getComputedStyle(e, "::before").content;
    if (before !== "none" && before !== "normal") return;
    const type = cs.listStyleType;
    const content = MARKERS[type] || `counter(list-item, ${type}) "."`;
    e.style.setProperty(
      "--pxm",
      getComputedStyle(e, "::marker").color || cs.color,
    );
    e.style.setProperty("--pxmc", content);
    e.setAttribute("data-px-li", "");
  }
  function pinPseudo(el) {
    for (const e of [el, ...el.querySelectorAll("*")]) {
      pinMarker(e);
      let pinned = false;
      for (const [p, v] of [
        ["::before", "--pxb"],
        ["::after", "--pxa"],
      ]) {
        const cs = getComputedStyle(e, p);
        if (cs.content === "none" || cs.content === "normal") continue;
        e.style.setProperty(v, cs.color);
        e.style.setProperty(v + "f", cs.webkitTextFillColor);
        pinned = true;
      }
      if (pinned) e.setAttribute("data-px-pseudo", "");
    }
  }

  function clearMarks() {
    for (const el of document.querySelectorAll(`[${MARK}]`))
      el.removeAttribute(MARK);
    for (const el of document.querySelectorAll("[data-px-pseudo]")) {
      el.removeAttribute("data-px-pseudo");
      for (const v of ["--pxb", "--pxbf", "--pxa", "--pxaf"])
        el.style.removeProperty(v);
    }
    for (const el of document.querySelectorAll("[data-px-layer]"))
      el.removeAttribute("data-px-layer");
    for (const el of document.querySelectorAll("[data-px-li]")) {
      el.removeAttribute("data-px-li");
      el.style.removeProperty("--pxm");
      el.style.removeProperty("--pxmc");
    }
    document.documentElement.removeAttribute("data-px-mode");
  }

  // Read the active slide. Builds are shown; exits and dimmed focus items are put back.
  // analyze({ text: false }) leaves the text in the pictures (--flatten).
  function analyze({ text = true } = {}) {
    clearMarks();
    const r = box();
    origin = { left: r.left, top: r.top };
    const slide = deck.slides[deck.index];
    for (const el of slide.querySelectorAll(".is-gone, .is-dim"))
      el.classList.remove("is-gone", "is-dim");

    // Pictures that must stand alone: builds, exits and morphs.
    const layerEls = [];
    for (const el of slide.querySelectorAll("*")) {
      if (el.closest(".notes") || !visible(el)) continue;
      const step = el.__n;
      const exit = el.__exit;
      const morph = el.getAttribute("data-morph");
      if (step !== undefined || exit !== undefined || morph) layerEls.push(el);
    }

    // Text
    const blocks = [];
    if (text) collect(slide, blocks);
    const texts = [];
    blocks.forEach((b, i) => {
      const el = b.el;
      const { lines, rects, lineH, baseline } = readText(b, slide);
      if (!lines.length || !rects.length) return;
      const tight = union(rects);
      const cs = css(el);
      let frame;
      if (b.node) {
        frame = {
          left: tight.left,
          top: tight.top - (lineH * k - tight.height) / 2,
          width: tight.width,
          height: Math.max(tight.height, lineH * k * lines.length),
        };
      } else {
        const er = el.getBoundingClientRect();
        const pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
        const pb =
          parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
        frame = {
          left: tight.left,
          top: er.top + pt * k,
          width: tight.width,
          height: Math.max(er.height - (pt + pb) * k, tight.height),
        };
      }
      const angle = angleOf(el, slide);
      pinPseudo(el);
      if (!b.node) el.setAttribute(MARK, String(i));
      else el.setAttribute(MARK, (el.getAttribute(MARK) || "") + " n" + i);
      const layer = layerEls.find((L) => L === el || L.contains(el));
      texts.push({
        id: i,
        frame: toCanvas(frame),
        lines,
        align:
          cs.textAlign === "start"
            ? "left"
            : cs.textAlign === "end"
              ? "right"
              : cs.textAlign,
        lineHeight: lineH,
        baseline:
          baseline === null || angle
            ? null
            : Math.round(((baseline - origin.top) / k) * 10) / 10,
        angle,
        layer: layer ? layerEls.indexOf(layer) : -1,
        morph: el.getAttribute("data-morph") || undefined,
        heading: /^H[1-3]$/.test(el.tagName),
      });
    });

    const NATIVE = ["bar", "hbar", "line", "area", "pie", "donut"];
    const charts = [...slide.querySelectorAll("[data-chart]")]
      .filter(
        (el) =>
          visible(el) &&
          NATIVE.includes((el.getAttribute("data-chart") || "bar").trim()),
      )
      .map((el) => {
        el.setAttribute("data-px-chart", "");
        const layer = layerEls.find((L) => L === el || L.contains(el));
        return {
          frame: toCanvas(el.getBoundingClientRect()),
          spec: chartSpec(el),
          layer: layer ? layerEls.indexOf(layer) : -1,
        };
      });

    const layers = layerEls.map((el, i) => {
      el.setAttribute("data-px-layer", String(i));
      const outer = layerEls.find((L) => L !== el && L.contains(el));
      return {
        id: i,
        frame: toCanvas(el.getBoundingClientRect()),
        step: el.__n,
        exit: el.__exit,
        morph: el.getAttribute("data-morph") || undefined,
        parent: outer ? layerEls.indexOf(outer) : -1,
        paints: paints(el),
        angle: angleOf(el, slide),
      };
    });

    // Links to other slides (data-goto): PowerPoint gets a clickable area over each, so the
    // whole card or row works and its text isn't underlined like a web link.
    const links = [...slide.querySelectorAll("[data-goto]")]
      .filter((el) => visible(el) && !el.closest(".notes"))
      .map((el) => {
        const layer = layerEls.find((L) => L === el || L.contains(el));
        return {
          frame: toCanvas(el.getBoundingClientRect()),
          goto: el.getAttribute("data-goto"),
          label: el.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
          layer: layer ? layerEls.indexOf(layer) : -1,
        };
      });

    const notesEl = slide.querySelector(".notes");
    const notes = notesEl
      ? [...notesEl.querySelectorAll("p, li")].length
        ? [...notesEl.querySelectorAll("p, li")]
            .map((p) => p.textContent.trim().replace(/\s+/g, " "))
            .join("\n\n")
        : notesEl.textContent.trim().replace(/\s+/g, " ")
      : "";
    const title = slide.querySelector("h1, h2, h3");
    return {
      index: deck.index,
      id: slide.id || "",
      hidden: slide.hasAttribute("data-hidden"),
      layout: [...slide.classList].find((c) => c.startsWith("layout-")) || "",
      title: title ? title.textContent.trim().replace(/\s+/g, " ") : "",
      notes,
      texts,
      charts,
      layers,
      links,
    };
  }

  // Everything an element paints: its box, its children, and positioned ::before/::after.
  function extent(el) {
    const rs = [el.getBoundingClientRect()];
    const all = [el, ...el.querySelectorAll("*")];
    for (const e of all) {
      if (e !== el && visible(e)) rs.push(e.getBoundingClientRect());
      for (const p of ["::before", "::after"]) {
        const cs = getComputedStyle(e, p);
        if (cs.content === "none" || cs.content === "normal") continue;
        if (cs.position !== "absolute" && cs.position !== "fixed") continue;
        const r = e.getBoundingClientRect();
        const px = (v) => parseFloat(v) || 0;
        const border = cs.boxSizing === "border-box";
        const w =
          px(cs.width) +
          (border
            ? 0
            : px(cs.borderLeftWidth) +
              px(cs.borderRightWidth) +
              px(cs.paddingLeft) +
              px(cs.paddingRight));
        const h =
          px(cs.height) +
          (border
            ? 0
            : px(cs.borderTopWidth) +
              px(cs.borderBottomWidth) +
              px(cs.paddingTop) +
              px(cs.paddingBottom));
        const left =
          cs.left !== "auto"
            ? r.left + px(cs.left) * k
            : cs.right !== "auto"
              ? r.right - (px(cs.right) + w) * k
              : r.left;
        const top =
          cs.top !== "auto"
            ? r.top + px(cs.top) * k
            : cs.bottom !== "auto"
              ? r.bottom - (px(cs.bottom) + h) * k
              : r.top;
        rs.push({ left, top, right: left + w * k, bottom: top + h * k });
      }
    }
    return union(rs);
  }

  // Capture modes. "background": everything but text, builds and charts. "layer": one
  // build or morph element alone on a transparent page (its text and inner builds hidden).
  function mode(name, layer) {
    const root = document.documentElement;
    for (const el of document.querySelectorAll("[data-px-current]"))
      el.removeAttribute("data-px-current");
    if (!name) return root.removeAttribute("data-px-mode");
    root.setAttribute("data-px-mode", name);
    if (name === "layer") {
      const el = document.querySelector(`[data-px-layer="${layer}"]`);
      el.setAttribute("data-px-current", "");
      const r = extent(el);
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return null;
  }

  // Inline icons keep their color when the text around them is hidden.
  function pinIconColors() {
    for (const el of document.querySelectorAll(
      `[${MARK}] svg, [${MARK}] .deck-annot, [${MARK}] [data-icon]`,
    ))
      el.style.setProperty("color", css(el).color, "important");
    for (const el of document.querySelectorAll(`[${MARK}], [${MARK}] *`)) {
      const cs = css(el);
      if (/text/.test(cs.backgroundClip || cs.webkitBackgroundClip || ""))
        el.style.setProperty("background-image", "none", "important");
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    html[data-px-mode] [${MARK}], html[data-px-mode] [${MARK}] *:not(svg, svg *, .deck-annot, .deck-annot *) {
      color: transparent !important; -webkit-text-fill-color: transparent !important;
      text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important;
    }
    html[data-px-mode] [data-px-pseudo]::before { color: var(--pxb) !important; -webkit-text-fill-color: var(--pxbf) !important; }
    html[data-px-mode] li[data-px-li] { list-style-type: none !important; }
    html[data-px-mode] li[data-px-li]::before {
      content: var(--pxmc) "\\00a0"; position: absolute; translate: -100% 0; white-space: pre;
      color: var(--pxm) !important; -webkit-text-fill-color: var(--pxm) !important;
    }
    html[data-px-mode] [data-px-pseudo]::after { color: var(--pxa) !important; -webkit-text-fill-color: var(--pxaf) !important; }
    html[data-px-mode] [data-px-chart] { visibility: hidden !important; }
    html[data-px-mode="background"] [data-px-layer] { visibility: hidden !important; }
    html[data-px-mode="layer"], html[data-px-mode="layer"] body, html[data-px-mode="layer"] .deck { background: transparent !important; }
    html[data-px-mode="layer"] .slide.is-active { visibility: hidden !important; background: transparent !important; }
    html[data-px-mode="layer"] .slide.is-active::before, html[data-px-mode="layer"] .slide.is-active::after { visibility: hidden !important; }
    html[data-px-mode="layer"] [data-px-current] { visibility: visible !important; }
    html[data-px-mode="layer"] [data-px-current] [data-px-layer] { visibility: hidden !important; }
    html[data-px-mode] .deck-ui, html[data-px-mode] .deck-controls, html[data-px-mode] .deck-toast,
    html[data-px-mode] .deck-cursor { display: none !important; }
  `;
  document.head.append(style);

  window.__pptx = { analyze, mode, pinIconColors, clearMarks };
})();
