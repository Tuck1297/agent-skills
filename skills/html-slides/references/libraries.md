# Libraries in a deck

A deck can pull in vetted browser libraries for things the engine doesn't draw itself: radar charts, diagrams written as text, code highlighting, maps, working forms. scripts/add-lib.mjs adds them from the catalog in assets/libraries.json, pinned to exact versions. The deck's own script starts each widget with `deck.mount`, so it starts when its slide is first shown, at its real size.

## Contents

1. [Library or hand-built?](#1-library-or-hand-built)
2. [The catalog](#2-the-catalog)
3. [Adding a library: add-lib.mjs](#3-adding-a-library-add-libmjs)
4. [Starting widgets: deck.mount](#4-starting-widgets-deckmount)
5. [Waiting for the reveal: ctx.shown](#5-waiting-for-the-reveal-ctxshown)
6. [Theme colors for libraries: ctx.color, ctx.solid, ctx.colors](#6-theme-colors-for-libraries-ctxcolor-ctxsolid-ctxcolors)
7. [Redrawing when the theme changes](#7-redrawing-when-the-theme-changes)
8. [Measuring inside the scaled slide](#8-measuring-inside-the-scaled-slide)
9. [Worked example: Chart.js](#9-worked-example-chartjs)
10. [Worked example: Mermaid](#10-worked-example-mermaid)
11. [More recipes](#11-more-recipes)
12. [Widgets in other outputs](#12-widgets-in-other-outputs)

---

## 1. Library or hand-built?

Use what the engine already does when it covers the need. Built-in features follow the theme, animate with the deck, cost nothing to load, and come out better in the PowerPoint export.

| You want                                                       | Use                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Bar, horizontal bar, line, area, donut or pie chart on a slide | `data-chart` (engine.md). Themed, animated, and a native editable chart in PowerPoint. |
| A big number that counts up                                    | `data-count`                                                                           |
| A click-through app or website demo                            | `data-interactive` and `data-set` (interactive.md)                                     |
| Entrances, builds, emphasis                                    | `data-anim`, `data-step`, `data-annotate`                                              |
| A simple diagram you can draw                                  | Inline SVG with `data-anim="draw"`                                                     |

Reach for a library when the thing must really work, or is a kind of graphic the engine can't draw:

| You want                                                                                           | Library id  |
| -------------------------------------------------------------------------------------------------- | ----------- |
| A mockup with real logic: forms that validate, lists you can add to and filter, totals that update | `alpine`    |
| Drag to reorder (kanban, sortable lists)                                                           | `sortable`  |
| Radar, scatter, bubble or mixed charts, or charts with hover tooltips and clickable legends        | `chartjs`   |
| Gauges, sankey, treemap, heatmap, funnel, candlestick, network graphs                              | `echarts`   |
| A custom visualization no chart library draws                                                      | `d3`        |
| Flowcharts, sequence, state, ER, gantt or mind-map diagrams written as text                        | `mermaid`   |
| Colored code                                                                                       | `highlight` |
| Math formulas                                                                                      | `katex`     |
| Date picker or calendar                                                                            | `flatpickr` |
| Searchable dropdowns, tag inputs                                                                   | `tomselect` |
| A table that searches, sorts and pages                                                             | `gridjs`    |
| A swipeable carousel                                                                               | `swiper`    |
| A pan-and-zoom map                                                                                 | `leaflet`   |
| A terminal for CLI demos                                                                           | `xterm`     |
| A Lottie animation file the user supplied                                                          | `lottie`    |
| Choreographed motion beyond `data-anim`                                                            | `gsap`      |
| A confetti burst                                                                                   | `confetti`  |
| A scannable QR code                                                                                | `qrcode`    |
| Good-looking native form controls inside a mockup                                                  | `pico`      |

What a library costs:

- **Weight.** ECharts, Mermaid and KaTeX are marked large.
- **Network.** The tags load from jsDelivr until the deck is bundled. bundle.mjs inlines them, so a bundled deck works offline (Leaflet's map tiles still need the internet).
- **PowerPoint.** A library's output becomes a picture in the export: it can't be edited, and an interactive widget is frozen.

---

## 2. The catalog

`node scripts/add-lib.mjs --list` prints this with the same notes. Every entry is a no-build browser file, pinned to an exact version on jsDelivr.

| id          | Library                 | Global          | For                                                                                                                             | Notes                                                                                                                                                 |
| ----------- | ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alpine`    | Alpine.js 3.17.5        | `Alpine`        | Mockups that really work (`x-data`, `x-model`, `x-for`, `x-show`).                                                              | Its script goes at the end of `<body>`, after the deck's own script, and starts itself; no `deck.mount` needed. See [Alpine](#alpine-a-working-form). |
| `sortable`  | SortableJS 1.15.7       | `Sortable`      | Drag to reorder, move cards between columns, touch-friendly.                                                                    | Put `data-interactive` on the mockup frame so clicks on cards don't change slides.                                                                    |
| `chartjs`   | Chart.js 4.6.1          | `Chart`         | Charts in app screens that respond to hover and taps, and types `data-chart` lacks: radar, scatter, bubble, mixed bar and line. | [Worked example](#9-worked-example-chartjs).                                                                                                          |
| `echarts`   | Apache ECharts 6.1.0    | `echarts`       | Dense dashboards and specialist charts.                                                                                         | Large.                                                                                                                                                |
| `d3`        | D3 7.9.0                | `d3`            | One-off custom visualizations: force layouts, custom maps, animated explainers.                                                 |                                                                                                                                                       |
| `flatpickr` | flatpickr 4.6.13        | `flatpickr`     | Date or range picker, inline calendar.                                                                                          | Adds a stylesheet.                                                                                                                                    |
| `tomselect` | Tom Select 2.6.2        | `TomSelect`     | Searchable dropdowns, tag and multi-select inputs, autocomplete.                                                                | Adds a stylesheet.                                                                                                                                    |
| `gridjs`    | Grid.js 6.2.0           | `gridjs`        | A data table that searches, sorts and pages.                                                                                    | Adds Grid.js's own theme stylesheet, which happens to be named `mermaid.min.css`; it has nothing to do with the Mermaid library.                      |
| `swiper`    | Swiper 14.4.0           | `Swiper`        | Swipeable carousels: onboarding, galleries, card stacks.                                                                        | Adds a stylesheet. Put `data-interactive` on the frame so swipes move the carousel, not the deck.                                                     |
| `leaflet`   | Leaflet 1.9.4           | `L`             | A real map with pins, routes and areas.                                                                                         | Adds a stylesheet. Map tiles load from the internet; offline the map is blank behind its markers.                                                     |
| `mermaid`   | Mermaid 12.2.0          | `mermaid`       | Diagrams written as text.                                                                                                       | Large. Use `class="diagram"`, never `class="mermaid"`. [Worked example](#10-worked-example-mermaid).                                                  |
| `highlight` | highlight.js 11.12.0    | `hljs`          | Syntax highlighting for code slides and IDE or terminal mockups.                                                                | Adds the `github-dark` stylesheet.                                                                                                                    |
| `katex`     | KaTeX 0.19.1            | `katex`         | Typeset math.                                                                                                                   | Large. Adds a stylesheet. Put `data-raw` on math that contains `{{`.                                                                                  |
| `xterm`     | xterm.js 6.0.0          | `Terminal`      | A real terminal: colored output, typed commands, progress bars.                                                                 | Adds a stylesheet. Deck keys are ignored while the terminal has focus.                                                                                |
| `lottie`    | Lottie 5.13.0           | `lottie`        | Plays a Lottie `.json` animation the user supplies.                                                                             |                                                                                                                                                       |
| `gsap`      | GSAP 3.15.0             | `gsap`          | Timelines, layout morphs inside a mockup, scrubbed sequences.                                                                   | Also loads the Flip and SplitText plugins. Check `ctx.animate` before playing.                                                                        |
| `confetti`  | canvas-confetti 1.9.4   | `confetti`      | A confetti burst for a launch, a milestone or a success screen.                                                                 | [Recipe](#confetti-when-a-slide-appears).                                                                                                             |
| `qrcode`    | qrcode-generator 2.0.4  | `qrcode`        | A scannable QR code, crisp at any size.                                                                                         | [Recipe](#qr-code).                                                                                                                                   |
| `pico`      | Pico CSS 2.1.1 (scoped) | none (CSS only) | Good-looking native form controls, tables, switches, sliders, accordions and dialogs inside a web-app mockup.                   | Add `class="pico"` to the mockup's `.screen`. It styles nothing outside `.pico`.                                                                      |

---

## 3. Adding a library: add-lib.mjs

```sh
node scripts/add-lib.mjs --list                                   # the catalog, with notes
node scripts/add-lib.mjs <deck folder or deck.html> chartjs mermaid
node scripts/add-lib.mjs <deck> --remove chartjs
```

For each library, add-lib.mjs writes a comment and pinned tags, each marked `data-lib="<id>"`:

```html
<!-- lib:chartjs chart.js@4.6.1 (MIT) -->
<script
  src="https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js"
  data-lib="chartjs"
></script>
```

- Stylesheets go just before the `engine/deck.css` link, so the deck's styles win over the library's.
- Scripts go just before `<script src="engine/icons.js">`, so the library's global exists when the engine and your script run. Alpine is the exception: it goes just before `</body>`, after your script, so it starts after the engine has filled the `{{values}}`.
- Running it again with the same id changes nothing. The npm package name works as well as the id (`chart.js` or `chartjs`).
- It prints the global to use, plus any warning from the catalog ("Watch out: …", "Note: needs internet").
- `--remove` deletes the lines carrying `data-lib="<id>"` and the `lib:` comment. It doesn't touch your `deck.mount` code.

Don't hand-write CDN tags for catalog libraries. add-lib pins the version the catalog was tested with, puts the tags where the engine needs them, and can remove them again. (bundle.mjs inlines any `<script src>` or stylesheet link, so hand-written tags would still be bundled, but their order and versions are then up to you.)

---

## 4. Starting widgets: deck.mount

```js
deck.mount(selector, init, { eager: false });
// init(el, ctx) may return nothing, hooks, or a promise of hooks:
//   { enter(ctx), leave(ctx), theme(ctx) }
```

Call it from the deck's own `<script>`, after engine/deck.js. `selector` is a CSS selector matched inside slides; `init` runs once for each matching element.

### When init runs

- **The first time the element's slide becomes the current slide**, after `deck.ready` (fonts and images loaded). If the slide is current when you call `deck.mount`, init runs right away, once `ready` resolves.
- **Under a sweep transition**, init runs while the slide is still covered. The slide is already laid out at full size, so the widget can measure itself, but it can't be seen yet. See [ctx.shown](#5-waiting-for-the-reveal-ctxshown).
- **For every slide at once** with `{ eager: true }`, in `?print` and `?sheet`, and when the browser starts printing.
- **Never twice** for the same element and the same `deck.mount` call: not on later visits, and not on theme changes.
- Each time a slide is entered, matching elements that haven't started yet are started. An element your script adds to a slide later is picked up on that slide's next visit.

check.mjs visits every slide in `?static`, so every widget starts there with `ctx.static` set to true.

### Lifecycle on each visit

| Moment                                                                      | What happens                                                                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The slide becomes current (under a sweep's cover, if there is one)          | `data-reset` boxes reset; elements not yet started run `init`.                                                                            |
| The slide is shown (after a sweep or reveal uncovers it; otherwise at once) | `enter(ctx)` on visits after the first; the `deck:enter` event; `data-autoplay` videos; counters, typing and tours; `ctx.shown` resolves. |
| The slide is left                                                           | `leave(ctx)` (every time, including after the first visit); `deck:leave`; tours stop; videos pause.                                       |
| The theme changes (T, `?theme=`, `deck.setTheme`)                           | `theme(ctx)` for every started element on every slide, on screen or not.                                                                  |

### Hooks

| Hook         | Called                                                                                | Use it to                                                          |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `enter(ctx)` | On later visits, when the slide is shown. Not on the first visit: `init` covers that. | Replay an entrance, restart a loop or timer.                       |
| `leave(ctx)` | Every time the slide is left.                                                         | Stop timers, animation loops, audio.                               |
| `theme(ctx)` | After every theme change, and once more when the new theme's fonts finish loading.    | Re-read colors and fonts and redraw. It must be safe to run twice. |

Each hook receives a fresh `ctx`. Use that one, not the `ctx` that `init` received: `ctx.font`, `ctx.static`, `ctx.animate` and `ctx.motion` are fixed when a ctx is made.

**No cleanup hook.** There is no unmount or destroy. A widget lives as long as the page. Do in `leave` what would otherwise go in a cleanup.

**Async init.** If `init` is `async` or returns a promise, `deck.settled()` waits for it. check.mjs screenshots, the PDF and the PowerPoint export all call `deck.settled()`. So `await` the rendering inside `init`, and the outputs show the finished widget.

**Errors.** An exception in `init` is caught and logged as `deck.mount(".selector") failed: …`. The deck keeps working, and check.mjs reports it as an error.

### Two traps

- **Don't mount on the slide element itself** (a selector such as `#closing` that matches the `section.slide`). `init` and `theme` run, but `enter` and `leave` are never called for it. Mount on an element inside the slide, such as its heading.
- **`eager` starts more than you asked for, and skips the first `enter`.** Registering an eager mount starts every mount registered before it, on every slide. A widget started early gets no `enter` on its slide's first visit, and its `ctx.shown` resolves at once while the slide is hidden. Use `eager` only for widgets without entrance effects, and register eager mounts before the others.

### The ctx object

| Member          | What it is for                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.slide`     | The slide element the widget is on.                                                                                                                                 |
| `ctx.data`      | The deck's data list, the same object as `deck.data`. Feed widgets the numbers that `{{values}}` use.                                                               |
| `ctx.static`    | `true` when output should be still: `?static` (check.mjs, PowerPoint export), `?print`, `?sheet`, `none` motion.                                                    |
| `ctx.animate`   | `true` when the widget may animate: not static, and motion isn't `none`. Turn library animations off when it is false.                                              |
| `ctx.motion`    | `none`, `subtle`, `moderate` or `heavy`.                                                                                                                            |
| `ctx.font`      | The theme's body font stack, for libraries that take a font family.                                                                                                 |
| `ctx.css(name)` | Raw value of a CSS variable on the element, as text: `ctx.css("--radius")` → `"14px"`.                                                                              |
| `ctx.color(c)`  | Resolves a theme variable (`"--accent"`) or any CSS color (`"color-mix(in srgb, var(--chart-1) 25%, transparent)"`) to `rgb(…)` or `rgba(…)`. Transparency is kept. |
| `ctx.solid(c)`  | The same, blended onto the slide background, so always an opaque `rgb(…)`.                                                                                          |
| `ctx.colors()`  | The theme's six chart colors, `--chart-1` to `--chart-6`, as an array of color strings.                                                                             |
| `ctx.shown`     | Promise that resolves when the slide can be seen.                                                                                                                   |

---

## 5. Waiting for the reveal: ctx.shown

Sweep transitions (`panels`, `stripes`, `shutter`, `circle`, `tiles`, `wave`) cover the screen with color, swap the slide underneath, then sweep off. Reveal transitions (`iris`, `diagonal`, `split`, `blinds`, `cube`) uncover the new slide through a growing shape. In both cases the slide becomes current, and your `init` runs, before anyone can see it. The engine pauses the slide's CSS entrance animations until it is uncovered, but it can't pause your JavaScript.

`ctx.shown` resolves when the slide is visible:

- with a sweep, when the shapes start to uncover it;
- with a reveal, about a third of the way through;
- at once with `fade`, `slide`, `zoom`, `wipe`, `rise`, `morph`, no transition, and in `?static`, `?print` and `?sheet`.

Start anything the audience should see begin (confetti, a typed command, a chart's grow-in) after it. For later visits, `enter` is already called at the visible moment, so it needs no waiting.

### Confetti when a slide appears

```js
deck.mount(".js-celebrate", (el, ctx) => {
  const burst = (c) =>
    c.animate &&
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.65 } });
  ctx.shown.then(() => burst(ctx)); // first visit, once the slide is uncovered
  return { enter: (c) => burst(c) }; // every later visit
});
```

```html
<section class="slide layout-closing" id="thanks" data-transition="circle">
  <h2 class="js-celebrate">Thank you</h2>
</section>
```

The mount is on the heading, not on `#thanks`, because a mount on the slide element never gets `enter`. Checking `c.animate` keeps check.mjs screenshots, the PDF and `none` motion free of confetti.

---

## 6. Theme colors for libraries: ctx.color, ctx.solid, ctx.colors

Canvas libraries, SVG generators and Mermaid can't read CSS variables. Theme colors are also often `color-mix()` values or partly transparent (`--accent-soft`, `--line`). The ctx turns them into plain color strings a library accepts, resolved on the widget's own element. That means a widget on an `.invert` or `.on-accent` slide gets that slide's colors.

| Call                                                               | Returns                    | Use for                                                                                                                                                   |
| ------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.color("--accent")`                                            | `rgb(255, 77, 46)`         | Lines, strokes, dataset colors.                                                                                                                           |
| `ctx.color("--accent-soft")`                                       | `rgba(255, 78, 42, 0.141)` | Translucent fills where transparency is wanted.                                                                                                           |
| `ctx.solid("--accent-soft")`                                       | `rgb(255, 225, 214)`       | The same color as it looks on the slide, opaque: for libraries that need opaque colors or compute shades from them (Mermaid), and for text and gridlines. |
| `ctx.color("color-mix(in srgb, var(--chart-1) 25%, transparent)")` | an `rgba(…)`               | A translucent version of any theme color. Any CSS color expression works.                                                                                 |
| `ctx.colors()`                                                     | `["rgb(…)", …]`, six items | A dataset palette that matches `data-chart`.                                                                                                              |

(Values shown for the pitch theme.)

---

## 7. Redrawing when the theme changes

The presenter can switch themes with T, and `?theme=` or `deck.setTheme()` switch them too. On a theme change the engine itself:

- switches `data-theme` and loads the theme's Google Fonts if needed;
- redraws `data-chart` charts whose box changed size (their colors come from CSS, so they recolor anyway), and re-fits `.stat-value` and `[data-fit]` text;
- calls `theme(ctx)` on every started widget, then again once the new fonts have loaded;
- fires `deck:theme` on `document`, with `detail.theme`.

Anything a library has drawn with colors or fonts baked in stays in the old theme until your `theme` hook redraws it. Every widget that uses theme colors should return a `theme` hook. A widget that hasn't started yet needs nothing: its `init` reads the theme in effect when it runs.

For one handler instead of per-widget hooks, listen for the event. It fires once per switch, not again when fonts load:

```js
document.addEventListener("deck:theme", (e) =>
  console.log("now", e.detail.theme),
);
```

---

## 8. Measuring inside the scaled slide

The deck is laid out at 1920×1080 and scaled with a CSS transform to fit the window. Inside a slide:

- `el.clientWidth` and `el.offsetWidth` return canvas pixels, the size the widget is laid out at. Size from these.
- `el.getBoundingClientRect()` returns screen pixels, which differ by the current scale. To turn them into canvas pixels, divide by `rect.width / el.offsetWidth`. The engine does this for the tour cursor.
- Resizing the window only changes the scale, never the layout size, so widgets need no resize handling.

---

## 9. Worked example: Chart.js

A radar chart, a type `data-chart` doesn't draw. It uses the theme's chart colors and font, grows in once the slide is visible, and recolors when the theme changes. This example has been run through check.mjs.

```sh
node scripts/add-lib.mjs <deck> chartjs
```

```html
<section class="slide" id="skills" data-transition="panels">
  <div class="slide-head">
    <p class="kicker">Team skills</p>
    <h2>Where we are strong</h2>
  </div>
  <div class="js-radar grow" style="position: relative; min-height: 0">
    <canvas aria-label="Team skills radar chart"></canvas>
  </div>
</section>
```

```js
deck.mount(".js-radar", async (el, ctx) => {
  const fill = (c, n) =>
    c.color(`color-mix(in srgb, var(--chart-${n}) 22%, transparent)`);
  const paint = (c) => {
    Chart.defaults.font.family = c.font;
    Chart.defaults.font.size = 22;
    Chart.defaults.color = c.solid("--ink-2");
  };
  paint(ctx);
  await ctx.shown; // a sweep or reveal is still covering the slide until this resolves
  const chart = new Chart(el.querySelector("canvas"), {
    type: "radar",
    data: {
      labels: ["Design", "Frontend", "Backend", "Data", "Ops"],
      datasets: [
        {
          label: "2025",
          data: [3, 4, 2, 3, 2],
          borderColor: ctx.color("--chart-1"),
          backgroundColor: fill(ctx, 1),
        },
        {
          label: "2026",
          data: [4, 5, 4, 4, 3],
          borderColor: ctx.color("--chart-2"),
          backgroundColor: fill(ctx, 2),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: ctx.animate ? { duration: 900 } : false,
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: { display: false },
          grid: { color: ctx.solid("--line") },
          angleLines: { color: ctx.solid("--line") },
        },
      },
    },
  });
  return {
    theme(c) {
      paint(c);
      chart.data.datasets.forEach((d, k) => {
        d.borderColor = c.color(`--chart-${k + 1}`);
        d.backgroundColor = fill(c, k + 1);
      });
      chart.options.scales.r.grid.color = c.solid("--line");
      chart.options.scales.r.angleLines.color = c.solid("--line");
      chart.update();
    },
  };
});
```

Why each part is there:

- **The wrapper.** Chart.js sizes the canvas to its parent. A `position: relative` wrapper that holds only the canvas, with `responsive: true` and `maintainAspectRatio: false`, makes the chart fill the box. `.grow` gives the box the rest of the slide's height.
- **`paint()`.** `Chart.defaults` sets the font and text color for every Chart.js chart in the deck, so the axis labels and legend use the theme's body font. Text and gridlines use `ctx.solid` so they are opaque.
- **`await ctx.shown`.** The slide enters with a `panels` sweep. Without the wait, the chart's grow-in would play under the cover. Because `init` is async, `deck.settled()` still waits for the chart before check.mjs takes its screenshot.
- **`ctx.animate`.** With no animation in `?static`, `?print` and `none` motion, screenshots and the PDF show the finished chart.
- **The `theme` hook.** It uses the fresh `c`, re-reads every color, and calls `chart.update()`. Running it twice is harmless.

Inside an app mockup, a smaller version works the same way: a `<canvas>` in the `.screen` and `backgroundColor: ctx.colors()` for a doughnut's slices. Charts on a slide that don't need hover or a special type should use `data-chart` instead; it becomes a native chart in PowerPoint.

---

## 10. Worked example: Mermaid

A flowchart written as text, drawn in the theme's colors and font when its slide is shown, and redrawn on theme change. This example has been run through check.mjs.

```sh
node scripts/add-lib.mjs <deck> mermaid
```

```html
<style>
  .diagram {
    display: grid;
    place-items: center;
  }
  .diagram svg {
    max-width: 100%;
    max-height: 100%;
    height: auto;
  }
</style>

<section class="slide" id="flow">
  <div class="slide-head"><h2>How a booking flows</h2></div>
  <div class="diagram grow" data-raw>
    flowchart LR A[Guest taps Book] --> B{{Table free?}} B -- yes --> C[Confirm]
    B -- no --> D[Waitlist] D -- table frees up --> C
  </div>
</section>
```

```js
let diagramId = 0;
deck.mount(".diagram", async (el, ctx) => {
  const source = el.textContent.trim(); // read once: rendering replaces the text with SVG
  const draw = async (c) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        fontFamily: c.font,
        fontSize: "26px",
        primaryColor: c.solid("--surface-2"),
        primaryTextColor: c.solid("--ink"),
        primaryBorderColor: c.solid("--accent"),
        lineColor: c.solid("--ink-2"),
      },
    });
    const { svg } = await mermaid.render("diagram-" + diagramId++, source);
    el.innerHTML = svg;
  };
  await draw(ctx);
  return { theme: (c) => draw(c) };
});
```

### Why `class="diagram"` and never `class="mermaid"`

- **Mermaid draws `.mermaid` elements by itself at page load.** Its `startOnLoad` setting is on by default. At load, every slide except the first is `display: none`, so Mermaid measures its text as zero-sized and the diagrams come out tiny or broken. Nothing in the deck redraws them later. With `class="diagram"`, Mermaid never sees the element until `deck.mount` calls `mermaid.render()`, when the slide is laid out at full size.
- **Rendering replaces the source with SVG.** A `.mermaid` element has no source text left to redraw from when the theme changes. The mount reads the source once and keeps it in `source`.
- **`startOnLoad: false`** in `initialize` keeps Mermaid from scanning the page itself.

The rest of the example:

- **`data-raw`** stops the engine from treating Mermaid syntax as data tokens. `B{{Table free?}}` (a hexagon) would otherwise be read as a `{{value}}` and left unfilled.
- **Solid colors.** Mermaid can't read CSS variables, and its `base` theme computes its other shades from the colors you pass. `ctx.solid` gives opaque `rgb()` values that work for that.
- **A unique id** for each `mermaid.render()` call. Two diagrams rendered with the same id clash.
- **`await draw(ctx)`**, so `deck.settled()` (and check.mjs) waits for the SVG.
- **The `theme` hook** redraws with the fresh `c`, which has the new theme's `font`.
- **HTML in the source.** The source is the element's text, so write `<` as `&lt;` and `&` as `&amp;`, and a line break in a label as `&lt;br&gt;`. Otherwise the browser reads them as HTML before Mermaid sees them.

---

## 11. More recipes

These come from a deck that check.mjs passes with no errors.

### Drag to reorder (sortable)

```html
<div class="device-browser" data-interactive>
  <div class="bar"><span class="url">app.example.com/bills</span></div>
  <div class="screen">
    <div class="kanban">
      <div>
        <h4>To pay</h4>
        <ol class="js-sortable">
          <li>Internet · $60</li>
          <li>Phone · $35</li>
        </ol>
      </div>
      <div>
        <h4>Paid</h4>
        <ol class="js-sortable">
          <li>Gym · $45</li>
        </ol>
      </div>
    </div>
  </div>
</div>
```

```js
deck.mount(".js-sortable", (el) => {
  new Sortable(el, { group: "bills", animation: 180 });
});
```

The shared `group` lets cards move between the two lists. The kanban layout itself is the deck's own CSS.

### Colored code (highlight)

```html
<pre
  class="code"
  data-anim="rise"
><code class="language-javascript">const pw = new Pocketwise({ token: process.env.PW_TOKEN });
await pw.expenses.add({ amount: 4.75, category: "coffee" });</code></pre>
```

```js
deck.mount("pre code", (el) => hljs.highlightElement(el));
```

### QR code

```html
<div class="qr js-qr" data-url="{{links.site}}"></div>
```

```css
.qr svg {
  width: 260px;
  height: 260px;
  display: block;
  background: #fff;
  padding: 14px;
  border-radius: 18px;
}
```

```js
deck.mount(".js-qr", (el) => {
  const qr = qrcode(0, "M");
  qr.addData(el.getAttribute("data-url"));
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
});
```

The URL comes from the data list through `{{links.site}}`, which the engine fills before the mount runs.

### Confetti when a slide appears

See [section 5](#confetti-when-a-slide-appears).

### Alpine: a working form

Alpine needs no `deck.mount`. It starts on its own, after the engine has filled the `{{values}}`, so a value from the data list can seed `x-data`. Keep `data-interactive` on the frame so clicks on rows don't change slides.

```html
<div
  class="device-browser"
  data-interactive
  style="width: 1100px; height: 640px"
>
  <div class="bar"><span class="url">app.example.com/plan</span></div>
  <div class="screen">
    <div
      class="ui-body"
      x-data="{ owner: '{{presenter.name}}', items: [{ name: 'Rent', amount: 1650 }], name: '', amount: '' }"
    >
      <div class="ui-title" x-text="owner + '\'s bills'"></div>
      <form
        class="row"
        @submit.prevent="if (name && amount) { items.push({ name, amount: Number(amount) }); name = ''; amount = '' }"
      >
        <input
          class="ui-input"
          x-model="name"
          placeholder="Bill"
          aria-label="Bill"
        />
        <input
          class="ui-input"
          x-model="amount"
          type="number"
          placeholder="$"
          aria-label="Amount"
        />
        <button class="ui-btn">Add</button>
      </form>
      <div class="ui-list">
        <template x-for="(item, i) in items" :key="i">
          <div class="ui-row">
            <span x-text="item.name"></span
            ><span
              class="ui-end"
              x-text="'$' + item.amount.toLocaleString()"
            ></span>
          </div>
        </template>
      </div>
      <div class="ui-card">
        <b>Total:</b>
        <span
          x-text="'$' + items.reduce((s, i) => s + i.amount, 0).toLocaleString()"
        ></span>
      </div>
    </div>
  </div>
</div>
```

Alpine expressions never use `{{ }}`. If one happens to contain `{{` (nested object literals written without spaces), put `data-raw` on the element. That also stops the engine filling data tokens inside it. The engine marks the overview and presenter copies of a slide with `x-ignore`, so Alpine doesn't start a second copy there.

---

## 12. Widgets in other outputs

| Output                       | What happens to library widgets                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| check.mjs screenshots        | Each slide is visited in `?static`, so every widget starts with `ctx.static` true, and `deck.settled()` waits for async `init`.                                         |
| PDF (`check.mjs --pdf`)      | `?print` starts every widget at load. `deck.settled()` waits for them before the PDF is written.                                                                        |
| Browser printing (Ctrl+P)    | Widgets on unvisited slides are started when printing begins, but the engine can't wait for asynchronous ones such as a Mermaid render. Use `check.mjs --pdf` for PDFs. |
| PowerPoint (export-pptx.mjs) | Loads `?static`, visits every slide and waits for `deck.settled()`. Canvases, SVGs and mockup screens become pictures. `data-chart` charts become native charts.        |
| Overview and presenter view  | Still copies. Canvas pixels are copied (WebGL canvases come out blank), other output looks as it does on the slide, and nothing in a copy runs or responds.             |
| Bundled deck (bundle.mjs)    | The pinned library files are inlined, so the single file works offline (except Leaflet tiles and anything else fetched at run time).                                    |
