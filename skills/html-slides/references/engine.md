# Engine reference

engine/deck.js turns `<main class="deck">` and its `<section class="slide">` children into a presentation. This file lists every attribute, key, URL parameter and script call the engine handles, with what each one does.

Slides are drawn on a 1920×1080 canvas and scaled to fit the window. Every size in CSS (font sizes, widths, `--chart-h`) is in canvas pixels.

## Contents

1. [Deck structure](#1-deck-structure)
2. [Data list and {{values}}](#2-data-list-and-values)
3. [Builds and animation](#3-builds-and-animation)
4. [Slide transitions](#4-slide-transitions)
5. [Counters](#5-counters)
6. [Charts](#6-charts)
7. [Annotations](#7-annotations)
8. [Text that fits: data-fit](#8-text-that-fits-data-fit)
9. [Icons](#9-icons)
10. [Video and other media](#10-video-and-other-media)
11. [Presenting](#11-presenting)
12. [URL parameters](#12-url-parameters)
13. [Printing, PDF and the contact sheet](#13-printing-pdf-and-the-contact-sheet)
14. [What check.mjs reports](#14-what-checkmjs-reports)
15. [JavaScript API](#15-javascript-api)

Clickable mockups and tours are in interactive.md. Library widgets and `deck.mount` are covered in full in libraries.md.

---

## 1. Deck structure

```html
<!doctype html>
<html lang="en" data-theme="corporate" data-motion="moderate">
  <head>
    <meta charset="utf-8" />
    <title>{{deck.title}}</title>
    <link rel="stylesheet" href="engine/deck.css" />
    <link rel="stylesheet" href="engine/themes.css" />
  </head>
  <body>
    <script type="application/json" id="deck-data">
      { "deck": { "title": "Q3 review" } }
    </script>

    <main class="deck" data-transition="fade" data-footer="{{deck.title}}">
      <section class="slide layout-title" id="title">
        <h1>{{deck.title}}</h1>
        <aside class="notes">Say who you are and why this matters.</aside>
      </section>
      <section class="slide" id="results">
        <div class="slide-head"><h2>Results</h2></div>
      </section>
    </main>

    <script src="engine/icons.js"></script>
    <script src="engine/deck.js"></script>
    <script>
      // The deck's own code (deck.mount calls) goes here, after deck.js.
    </script>
  </body>
</html>
```

Rules the engine relies on:

- Only direct `section.slide` children of `main.deck` are slides. There is one deck per page.
- engine/deck.js runs once, when it loads, so it must come after the slides. Your own script goes after it, because `window.deck` exists only from then on.
- The engine fills `{{values}}`, expands `data-each`, fills icons and sets up builds once, at load. Elements your script adds later get none of that.

### `<html>` attributes

| Attribute     | Values                                                                                    | What it does                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `data-theme`  | `corporate`, `minimal`, `keynote`, `pitch`, `editorial`, `academic`, `playful`, `elegant` | Picks the theme in engine/themes.css. T cycles themes while presenting; `?theme=` overrides it. |
| `data-motion` | `none`, `subtle`, `moderate` (default), `heavy`                                           | How much movement. See [Motion levels](#motion-levels).                                         |

### `main.deck` attributes

| Attribute                  | Values                                                   | What it does                                                                                                                                               |
| -------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-transition`          | a transition name, or `auto`                             | How slides are entered when they don't set their own. Default `fade`. See [Slide transitions](#4-slide-transitions).                                       |
| `data-transition-duration` | milliseconds                                             | Default length for transitions that accept one.                                                                                                            |
| `data-transition-origin`   | `center`, `left`, `right`, `top`, `bottom`, or `"x% y%"` | Where `iris`, `circle` and `tiles` start.                                                                                                                  |
| `data-enter`               | `cascade`                                                | Every slide's blocks flow in one after another. See [Cascade](#cascade).                                                                                   |
| `data-footer`              | text, may hold `{{values}}`                              | Footer text on every slide, for themes that draw a footer.                                                                                                 |
| `data-logo`                | an image path, may hold `{{values}}`                     | The deck's logo at the start of the footer row on every content slide, in every theme. See [Footer, slide number and logo](#footer-slide-number-and-logo). |
| `data-logo-invert`         | an image path, may hold `{{values}}`                     | The logo for dark slides (`invert`, `on-accent`), such as a white version.                                                                                 |
| `data-auto`                | seconds                                                  | Advance automatically (kiosk mode).                                                                                                                        |
| `data-auto-loop`           | no value                                                 | With `data-auto`, start over at the first slide after the last.                                                                                            |
| `data-progress`            | `off`                                                    | Hide the progress bar at the bottom of the screen.                                                                                                         |
| `data-controls`            | `off`                                                    | Hide the on-screen control bar.                                                                                                                            |

### `section.slide` attributes and classes

| Attribute or class                                                      | Values              | What it does                                                                                                         |
| ----------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                    | a name              | Names the slide for `#/id` links, `data-goto` and `deck.goTo()`. The address bar shows `#/id` while it is on screen. |
| `class="layout-…"`                                                      | see the table below | Slide layout. Some layouts change the footer and `auto` transitions.                                                 |
| `data-transition`, `data-transition-duration`, `data-transition-origin` | as on the deck      | How this slide is entered. Going back out of it plays the same transition reversed.                                  |
| `data-enter`                                                            | `cascade`           | Cascade for this slide only.                                                                                         |
| `data-hidden`                                                           | no value            | Hidden slide. See [Hidden slides](#hidden-slides).                                                                   |
| `data-auto`                                                             | seconds             | Auto-advance time for this slide. It wins over `?auto` and the deck's `data-auto`.                                   |
| `data-state`                                                            | `key:value …`       | State for the slide itself (interactive.md).                                                                         |
| `class="no-chrome"`                                                     |                     | No footer, slide number or logo on this slide.                                                                       |
| `class="no-logo"`                                                       |                     | No logo on this slide (the footer stays).                                                                            |
| `class="invert"` / `class="on-accent"`                                  |                     | Recolor the slide: dark version of the theme, or accent-colored background.                                          |

### Speaker notes

Put notes in `<aside class="notes">` inside the slide. They never show on the slide. The presenter view shows the first `.notes` element's HTML, so paragraphs and lists keep their formatting. The PowerPoint export puts them in the notes pane. scripts/check.mjs lists slides without notes. A `data-step` inside notes is ignored.

```html
<aside class="notes">
  <p>Pause after the number.</p>
  <ul>
    <li>Mention the pilot</li>
    <li>Hand over to Sam</li>
  </ul>
</aside>
```

### Hidden slides

`data-hidden` keeps a slide in the deck but out of the normal path.

- →, ←, Home, End and auto-advance skip it.
- You reach it with `data-goto`, `deck.goTo()`, number + Enter, the overview, or a `#/id` link. From a hidden slide, ← returns to the slide you jumped from.
- The overview shows it dimmed. Printing and the PDF leave it out. The control bar shows `↳ N` while it is on screen.

```html
<section class="slide" id="appendix-costs" data-hidden>…</section>
<a data-goto="appendix-costs">See the cost breakdown</a>
```

### Footer, slide number and logo

The engine adds `<footer class="slide-chrome">` to every slide. It holds `.slide-footer` (the deck's `data-footer` text) and `.slide-num` (the slide's position in the file). Only the corporate, minimal, editorial and academic themes display it. It never shows on `layout-title`, `layout-section`, `layout-media`, `layout-closing` or `.no-chrome` slides. To write your own footer, put a `<footer class="slide-chrome">` directly inside the slide; the engine then leaves that slide alone.

A logo goes on every content slide with one attribute, so changing the file (or the data value) and rebuilding changes it everywhere:

```html
<main
  class="deck"
  data-footer="{{deck.title}}"
  data-logo="{{deck.logo}}"
  data-logo-invert="{{deck.logoWhite}}"
></main>
```

The engine puts an `<img class="slide-logo">` at the start of the footer row. In themes that show the footer it sits before the footer text; in the others it shows on its own in the footer's place (bottom left; top left in minimal and editorial, whose footer runs along the top). `--logo-h` (default 34px) and `--logo-max-w` (260px) size it. Title, section, media and closing slides leave it out, because they usually show the logo large: put `<img data-src="{{deck.logo}}">` on them yourself. `class="no-logo"` leaves it off one slide. Any image works (SVG, PNG, WebP, JPG); give dark slides a light version with `data-logo-invert`. `bundle.mjs` inlines the file, and the PowerPoint export keeps it as a picture on each slide.

Slide numbers count hidden slides. That applies to the footer number, number + Enter, `?slide=N`, `#/N`, `data-goto="N"` and `deck.goTo(N)`. Only the control bar's "3 / 12" counts visible slides.

### Layouts

| Class              | Use                                                                                                                    | Engine behaviour                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `layout-title`     | Opening: `.kicker`, `h1`, `.lead`, `.byline`                                                                           | No footer. `auto` uses the theme's signature sweep. |
| `layout-section`   | Divider: `.section-num` and `h2`                                                                                       | No footer. `auto` uses the signature sweep.         |
| `layout-statement` | One large `h2`                                                                                                         | `auto` uses the theme's reveal.                     |
| `layout-quote`     | `blockquote.quote` and `.cite`                                                                                         | `auto` uses the theme's reveal.                     |
| `layout-closing`   | Closing `h2` and `.contact`                                                                                            | No footer. `auto` uses the signature sweep.         |
| `layout-media`     | Full-bleed `img.bg` or `video.bg` with text over a dark scrim (`no-scrim` removes it)                                  | No footer.                                          |
| `layout-split`     | `.col` (text) beside `.visual`. Modifiers: `reverse`, `wide-text`, `wide-visual`, `bleed`; `--split` sets the columns. |                                                     |
| `layout-chart`     | Heading, a `.chart` that fills the rest, `.takeaway`                                                                   |                                                     |
| `layout-demo`      | Text `.col` beside a device mockup (`reverse` swaps them)                                                              | See interactive.md.                                 |

The other classes in engine/deck.css are styling only: `slide-head`, `slide-body`, `kicker`, `lead`, `muted`, `faint`, `small`, `big`, `accent`, `source`, `byline`, `center-all`, `grid` with `cols-2` to `cols-5`, `stats`, `stat`, `stat-value`, `stat-label`, `agenda`, `timeline` (`.when`), `compare` (`.vs`), `people`, `person`, `avatar`, `card` (`is-accent`, `is-quiet`), `icon` (`lg`, `plain`), `bullets` (`numbered`, `check`), `pill`, `callout` (`soft`), `definition`, `figure`, `meter`, `divider`, `table.data` (`num`, `tr.is-key`), `code`, `row`, `stack`, `grow`, `center`, `text-center`, `mt-auto`, `blob`.

A meter fills to `--value` when its slide appears:

```html
<div class="meter"><i style="--value: 72%"></i></div>
```

### Markers for check.mjs

| Marker                          | Effect                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `data-bleed` or `class="bleed"` | May extend past the slide edge; not reported as off-slide.                                                                              |
| `data-decor`                    | Decoration: skipped by cascade and by the layout checks.                                                                                |
| `class="blob"`                  | Decorative shape: skipped by cascade and the checks. It drifts at `heavy` motion.                                                       |
| `aria-hidden="true"`            | Skipped by the layout checks.                                                                                                           |
| `data-small-ok`                 | Text inside may be 13px instead of the usual 20px minimum. `.screen` (app mockups) and `.device-browser > .bar` get this automatically. |

---

## 2. Data list and {{values}}

Names, numbers and dates live once, in a JSON block, and the slides refer to them.

```html
<script type="application/json" id="deck-data">
  {
    "company": "Northwind",
    "currency": "EUR",
    "q3": { "revenue": 4820000, "growth": 18.4, "customers": 1260 },
    "regions": [
      { "name": "North", "revenue": 1900000 },
      { "name": "South", "revenue": 1450000 },
      { "name": "West", "revenue": 1470000 }
    ]
  }
</script>

<p class="kicker">{{company}} · Q3</p>
<h2>Revenue up {{q3.growth | percent}}</h2>
<p>{{regions.0.name}} led with {{regions.0.revenue | money}}</p>
```

This renders "Northwind · Q3", "Revenue up 18.4%" and "North led with €1,900,000".

### Where tokens are filled

- In the text and attribute values of everything inside `main.deck`, including the deck element's own attributes (so `data-footer="{{deck.title}}"` works), and in `<title>`.
- Not inside `<script>`, `<style>`, `<textarea>` or a plain `<template>` (a `<template data-each>` is repeated and filled: [Whole slides from the data](#whole-slides-from-the-data-template-data-each)), and not inside an element with `data-raw` (neither its attributes nor anything in it).
- Once, when engine/deck.js runs, before builds, icons and charts are set up. So a token can feed any attribute: `data-count`, `data-values`, `data-icon`, `href`, `style`. For an image or video from the data write `data-src`, not `src` ([below](#images-from-the-data-data-src)).

What a token becomes:

| Value                 | Result                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| missing (`undefined`) | The token stays as typed, `{{like.this}}`, and check.mjs reports it as missing from the data list. |
| `null`                | Empty text.                                                                                        |
| object or array       | JSON text. This is how `data-values='{{growth.users}}'` passes an array to a chart.                |
| anything else         | The value as text.                                                                                 |

Paths use dots, including array positions: `{{regions.0.name}}`. A token can also hold a literal: `{{ 42 }}`, `{{ "draft" | upper }}`.

### Filters

Filters run left to right: `{{regions | sum:revenue | money}}`. An unknown filter is skipped with a warning. When the value is missing, every filter except `default` is skipped.

| Filter           | Example                                         | Result                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `money`          | `{{x \| money}}`, `{{x \| money:EUR}}`          | Currency from the argument, else the data list's `currency` key, else USD. Whole numbers show no cents; other values show two. Write the code in capitals. **Known issue:** a decimals argument (`money:0`, `money:EUR:0`) is ignored. |
| `number`         | `{{x \| number}}`, `{{x \| number:1}}`          | Grouped for the locale (`1,234.5`). The argument sets exact decimals; without it, up to 2.                                                                                                                                             |
| `percent`        | `{{x \| percent}}`, `{{x \| percent:1}}`        | The number plus `%`. It does not multiply: `18.4` → `18.4%`, `0.18` → `0.18%`.                                                                                                                                                         |
| `compact`        | `{{x \| compact}}`                              | `4820000` → `4.8M`.                                                                                                                                                                                                                    |
| `date`           | `{{d \| date}}`, `{{d \| date:short}}`          | See [Dates](#dates).                                                                                                                                                                                                                   |
| `upper`, `lower` | `{{name \| upper}}`                             | Changes case.                                                                                                                                                                                                                          |
| `count`          | `{{regions \| count}}`                          | Items in a list, or keys in an object.                                                                                                                                                                                                 |
| `sum`            | `{{list \| sum}}`, `{{regions \| sum:revenue}}` | Adds the numbers in a list, or one key of each item.                                                                                                                                                                                   |
| `join`           | `{{tags \| join}}`, `{{tags \| join:" · "}}`    | Joins a list. Default separator `, `.                                                                                                                                                                                                  |
| `first`, `last`  | `{{regions \| first}}`                          | First or last item.                                                                                                                                                                                                                    |
| `initials`       | `{{name \| initials}}`                          | `"Ada Lovelace"` → `AL` (two letters at most).                                                                                                                                                                                         |
| `default`        | `{{x \| default:"TBC"}}`                        | Used when the value is missing, `null` or `""`.                                                                                                                                                                                        |

(The `\|` in this table is only Markdown escaping. Write a plain `|` in the deck.)

Number-like strings work too. `"$1,200"` and `"18%"` are read as numbers.

Two optional top-level keys change formatting for the whole deck: `"locale": "de-DE"` (default: the browser's language) and `"currency": "EUR"` (default USD).

### Dates

A date value can be `"today"`, a shift from today (`"+3d"`, `"-2w"`, `"+1m"`, `"+1y"`), `"2026-03-04"` (read as a local date), or anything JavaScript's `Date` understands. Styles, shown in `en-US`:

| Style            | Example            |
| ---------------- | ------------------ |
| `long` (default) | March 4, 2026      |
| `medium`         | Mar 4, 2026        |
| `short`          | Mar 4              |
| `numeric`        | 3/4/26             |
| `month`          | March 2026         |
| `weekday`        | Wednesday, March 4 |
| `year`           | 2026               |

### Repeating: data-each

| Attribute    | Values                       | What it does                                                                                                                          |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `data-each`  | `"item in list"` or `"list"` | Repeats the element's content once per item. Inside, `{{item.…}}` (or the name you chose), `{{index}}` (from 0) and `{{n}}` (from 1). |
| `data-limit` | number                       | Only the first n items.                                                                                                               |

The element itself stays as the container; its other attributes are filled from the outer data. An object is repeated as `{key, value}` pairs. A single non-list value is shown once. A missing list renders nothing and is reported. Repeats can nest, and inner content can still use outer names.

```html
<table class="data">
  <thead>
    <tr>
      <th>Region</th>
      <th class="num">Revenue</th>
    </tr>
  </thead>
  <tbody data-each="r in regions">
    <tr>
      <td>{{n}}. {{r.name}}</td>
      <td class="num">{{r.revenue | money}}</td>
    </tr>
  </tbody>
</table>
<p class="small muted">
  Total {{regions | sum:revenue | money}} across {{regions | count}} regions
</p>
```

Repeating happens before builds are set up, so `data-each` combines with `data-steps` or `data-stagger` on the same element:

```html
<div class="timeline" data-each="m in milestones" data-steps>
  <div>
    <span class="when">{{m.when}}</span>
    <h3>{{m.what}}</h3>
    <p>{{m.detail}}</p>
  </div>
</div>
```

An empty list renders nothing, so a one-item list works as a switch: `data-each="_ in lesson.only.chart"` with `"only": {"chart": [1], "photo": []}` shows the chart part and drops the photo part. Do this rather than hiding parts with CSS: hidden parts still count in check.mjs's word count and add weight to the bundle.

### Whole slides from the data: `<template data-each>`

A `<template data-each>` repeats its content in its own place, so one template inside `main.deck` makes a run of slides, one set per item. Everything above works inside it, including nested `data-each`, builds and `data-morph`.

```html
<main class="deck">
  <section class="slide" id="agenda">…</section>
  <template data-each="lesson in lessons">
    <section class="slide layout-section" id="{{lesson.id}}-intro">
      <h2 data-morph="{{lesson.id}}-title">{{lesson.title}}</h2>
    </section>
    <section class="slide" id="{{lesson.id}}">
      <h2 data-morph="{{lesson.id}}-title">{{lesson.title}}</h2>
      …
    </section>
  </template>
  <section class="slide" id="closing">…</section>
</main>
```

Give each repeated slide an id from the data (`{{lesson.id}}`) so `data-goto` and `#/id` reach it. This is how a deck is regenerated from a source file: a build script writes the data list, and the templates turn it into slides (see SKILL.md, "Decks built from a source file").

### Images from the data: data-src

The browser starts loading `<img src="{{photo}}">` as the page is parsed, before the token is filled, and check.mjs reports the failed request. Write `data-src` (or `data-srcset`, `data-poster`) instead: the engine fills it and then sets the real attribute. bundle.mjs inlines local files named in `data-src` and in the data list.

```html
<div data-each="p in team"><img data-src="{{p.photo}}" alt="{{p.name}}" /></div>
```

### data-raw

`data-raw` leaves an element and everything in it untouched. Use it for text that contains `{{` and isn't a data token: Mermaid source (`B{{Decision}}` is a hexagon node), TeX, template code, or an Alpine expression.

### Trying other values while presenting (E)

E opens the data editor with the list as JSON.

- **Apply** reloads the deck with the new values in this browser tab. They last until the data list in the file changes, and the help screen (?) says when edited data is showing.
- **Download deck** saves a copy of the page as written, with the new values in `#deck-data`. An unbundled deck's copy uses the engine folder, so keep it next to the deck.
- **Reset** drops the applied values.

`deck.data` returns the list in use, edited values included.

`data-text` is not part of the data list. It shows what is typed into a mockup's input (interactive.md).

---

## 3. Builds and animation

### Click steps

| Attribute    | Values               | What it does                                                                                                                                        |
| ------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-step`  | empty, or a number   | The element appears on a click. Empty takes the next number; a number joins that step.                                                              |
| `data-exit`  | number               | The element fades out (0.45s) when that step is reached. Its space is kept.                                                                         |
| `data-steps` | no value, or `focus` | On a container: each child becomes a step (children keep their own `data-step` if set). With `focus`, the shown items except the newest dim to 32%. |

Numbering: an empty `data-step` gets one more than the highest number used so far, in document order. Steps are the distinct numbers used by `data-step` and `data-exit`, played in ascending order, so gaps don't matter. Hidden steps keep their space (`visibility: hidden`). A step without `data-anim` rises in.

```html
<section class="slide" id="plan">
  <div class="slide-head"><h2>Three fixes</h2></div>
  <ul class="bullets" data-steps="focus" data-anim="left">
    <li>Find the leak</li>
    <li>Fix onboarding</li>
    <li>Measure again</li>
  </ul>
  <p class="callout soft" data-step="2">Appears with the second bullet</p>
  <p class="small muted" data-exit="3">Leaves at the third click</p>
</section>
```

Click 1 shows the first bullet. Click 2 shows the second bullet and the callout. Click 3 shows the third bullet and removes the note. The next click goes to the next slide.

`data-step="0"` marks an element that belongs to the step sequence but is already showing when the slide opens (it isn't a click). Use it for the first item of a walkthrough whose items are numbered from the data: `data-step="{{index}}"` then gives the first item 0 (shown) and the rest one click each.

**Jumping to a step.** `data-goto-step="3"` on any element makes a click on it jump the current slide to step 3 (forward or back; 0 is the slide as it opens). It's how a walkthrough lets the presenter click a step in a list, or a hotspot in a screenshot, instead of pressing →. Give its container `class="no-advance"` if clicks around it shouldn't advance the slide. From script: `deck.goStep(n)`; `deck.step` is the current step. The PowerPoint export plays steps in order; a `data-goto-step` click has no PowerPoint equivalent.

```html
<ol data-steps="focus" data-each="s in steps">
  <li data-step="{{index}}" data-goto-step="{{index}}">{{s.do}}</li>
</ol>
<div class="device-phone no-advance">
  <div class="screen" data-each="layer in screens">
    <!-- Each screen covers the one before it, so only the newest one's buttons can be clicked. -->
    <div data-step="{{layer.step}}" style="position: absolute; inset: 0">
      <img class="shot" data-src="{{layer.img}}" alt="{{layer.alt}}" />
      <button
        class="hotspot hint"
        data-goto-step="{{layer.next}}"
        aria-label="{{layer.label}}"
        style="--x: {{layer.x}}%; --y: {{layer.y}}%; --w: {{layer.w}}%; --h: {{layer.h}}%"
      ></button>
    </div>
  </div>
</div>
```

`hotspot` and `hint` (the pulsing ring) are described in interactive.md, "Screenshots with hotspots". Give `hint` only to the button the presenter should press next, and leave it off the last screen.

→ always plays the next step before moving on. ← takes steps back first. Arriving at a slide with ← lands on its last step, with entrance animations skipped; counters and typed text still run again. Counters, typing, tours, charts and annotations inside a step start when the step appears.

### Entrance animations: data-anim

An element with `data-anim` animates when its slide appears. If it is (or is inside) a step, it animates when the step appears. Under a sweep transition, entrances wait until the slide is uncovered.

| Name      | Effect                                                           |
| --------- | ---------------------------------------------------------------- |
| `fade`    | Fades in.                                                        |
| `rise`    | Fades in moving up 48px. Also used for an empty or unknown name. |
| `drop`    | Fades in moving down 48px.                                       |
| `left`    | Fades in from 90px to the left.                                  |
| `right`   | Fades in from 90px to the right.                                 |
| `zoom`    | Fades in growing from 84%.                                       |
| `pop`     | Grows from 50% with a slight overshoot.                          |
| `blur`    | Comes into focus from a blur.                                    |
| `flip`    | Flips down from its top edge, in 3D.                             |
| `wipe`    | Is uncovered from left to right.                                 |
| `reveal`  | Slides up into place, clipped to its own box.                    |
| `spin`    | Spins in from −120° and 40% with an overshoot.                   |
| `grow`    | Stretches out from its left edge (bars, rules).                  |
| `grow-up` | Stretches up from its bottom edge.                               |
| `draw`    | Strokes SVG shapes on. See below.                                |
| `type`    | Types its text one letter at a time. See below.                  |

| Attribute           | Values                       | What it does                                                                                                                                                                                                              |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-delay`        | ms                           | Wait before starting. It also delays charts, annotations, meters and cascade inside the element.                                                                                                                          |
| `data-duration`     | ms                           | Animation length. Default 800ms, 1000ms at `heavy` motion.                                                                                                                                                                |
| `data-stagger`      | no value, or ms              | On a container: children enter one after another, this far apart (default 90ms, 120ms at `heavy`). The container's `data-anim` moves to its children; a child keeps its own. With no `data-anim` anywhere, nothing moves. |
| `data-split`        | `words` (default) or `chars` | Splits the text into words or letters that animate one after another with the element's `data-anim` (default `rise`). The gap is `data-stagger`, else 75ms per word or 30ms per letter.                                   |
| `data-draw-stagger` | ms                           | With `data-anim="draw"`: start each shape this long after the previous one.                                                                                                                                               |
| `data-speed`        | ms                           | With `data-anim="type"`: time per character (default 38).                                                                                                                                                                 |

```html
<h1 data-split="words" data-anim="rise" data-stagger="90">{{deck.title}}</h1>
<p class="lead" data-anim="fade" data-delay="450">{{deck.subtitle}}</p>
<div class="stats" data-stagger="120" data-anim="rise">
  … three .stat children …
</div>
```

`data-anim="draw"` goes on an `<svg>` or on one shape. Every `path`, `line`, `polyline`, `polygon`, `circle`, `ellipse` and `rect` inside is stroked on over 1.6s (`--draw-dur`). The shapes need a `stroke`.

```html
<svg viewBox="0 0 400 120" width="800" data-anim="draw" data-draw-stagger="300">
  <path
    d="M10 100 C 120 10, 280 10, 390 100"
    fill="none"
    stroke="currentColor"
    stroke-width="6"
  />
  <circle
    cx="390"
    cy="100"
    r="8"
    fill="none"
    stroke="currentColor"
    stroke-width="6"
  />
</svg>
```

`data-anim="type"` replaces the element's content with its plain text, so any markup inside is lost. A blinking caret shows while it types and for 1.2s after.

CSS variables for fine tuning: `--dur`, `--stagger`, `--delay`, `--draw-dur`, `--ease-out`, `--ease-back`.

### Cascade

`data-enter="cascade"` on the deck or a slide makes the slide's blocks fade up one after another, 70ms apart (`--cascade-gap`; `--cascade-dur` sets the length). Blocks are headings, paragraphs, `.kicker`, `.lead`, cards, stats, list items, figures, images, SVGs, videos, tables, quotes, charts, pills, callouts, meters, devices, icons, avatars, code and buttons. After the 15th block the rest arrive together.

Cascade leaves alone anything that has its own `data-anim`, `data-step`, `data-steps`, `data-stagger`, `data-split` or `data-when`, plus notes, footers, `.blob`, `.bleed`, `[data-bleed]` and `[data-decor]`. A block that contains such an element is not animated as a whole; the engine looks at its children instead.

### Loops and parallax

| Attribute    | Values                            | What it does                                                                                                                                                                                                         |
| ------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-loop`  | `float`, `pulse`, `spin`, `drift` | Keeps moving while the slide is on screen. `float` bobs 18px (6s), `pulse` swells to 106% (2.4s), `spin` turns once every 30s, `drift` wanders (18s). `--loop-dur` sets the time. Off at `subtle` and `none` motion. |
| `data-depth` | 0 to 1                            | At `heavy` motion only: shifts with the pointer for a parallax effect. Default 0.5; `0` is also treated as 0.5.                                                                                                      |

Don't put `data-loop` and `data-anim` on the same element. The entrance wins the animation name but takes the loop's repeat, so the entrance repeats forever. Wrap one element in the other.

### Morph

Give an element the same `data-morph` name on two slides, and use `data-transition="morph"` on the second. The element glides from its old place and size to the new one while the rest cross-fades (0.85s). Names are compared case-insensitively. Two elements with the same name on one slide trigger a warning, unless they are in different `[data-when]` panels. Sweep transitions don't morph. Inside a clickable mockup, `data-morph` also glides between states (interactive.md).

```html
<section class="slide">
  <div class="dot" data-morph="hero"></div>
  …
</section>
<section class="slide" data-transition="morph">
  <div class="dot big" data-morph="hero"></div>
  …
</section>
```

### Motion levels

| Level      | Effect                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`     | No animation. Slide transitions are cut. Counters and typed text show their final values, and tours jump to their last state. `ctx.animate` is false. |
| `subtle`   | Every entrance is a 0.5s fade. Loops and blobs stop. Every slide transition becomes `fade`.                                                           |
| `moderate` | The default.                                                                                                                                          |
| `heavy`    | Longer and bigger: 1s entrances, 120ms stagger, cascade with blur, drifting `.blob` shapes, `data-depth` parallax.                                    |

Set the level with `<html data-motion>`, `?motion=`, the M key, or `deck.setMotion()`. If the viewer's system asks for reduced motion, `moderate` and `heavy` drop to `subtle`, unless `?motion=` is in the URL.

---

## 4. Slide transitions

Set `data-transition` on a slide (how it is entered) or on the deck (the default for every slide).

| Group     | Names                                                     | Look                                                                                                                                                   |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Basic     | `fade`, `slide`, `zoom`, `wipe`, `rise`, `morph`, `none`  | Cross-fade; push sideways; zoom through; straight wipe; float up; glide matching `data-morph` elements; cut.                                           |
| Reveals   | `iris`, `diagonal`, `split`, `blinds`, `cube`             | The new slide shows through a growing circle, a slanted edge, doors opening from the middle, venetian blinds, or a cube turn.                          |
| Sweeps    | `panels`, `stripes`, `shutter`, `circle`, `tiles`, `wave` | Bands of color in `--mg-1`, `--mg-2` and `--mg-3` cover the screen, the slide changes underneath, then they sweep off.                                 |
| Automatic | `auto`                                                    | Title, section and closing slides get the theme's signature sweep; statement and quote slides get its reveal; other slides get its content transition. |

The theme picks what `auto` uses, through `--mg-signature`, `--mg-reveal` and `--mg-content`:

| Theme     | Signature | Reveal     | Content |
| --------- | --------- | ---------- | ------- |
| corporate | `stripes` | `wipe`     | `slide` |
| minimal   | `panels`  | `split`    | `fade`  |
| keynote   | `panels`  | `iris`     | `slide` |
| pitch     | `circle`  | `diagonal` | `slide` |
| editorial | `shutter` | `blinds`   | `fade`  |
| academic  | `wipe`    | `split`    | `fade`  |
| playful   | `tiles`   | `iris`     | `rise`  |
| elegant   | `wave`    | `split`    | `fade`  |

Details:

- Going back plays the transition of the slide you are leaving, in reverse.
- `data-transition-duration` (ms, on the slide or deck) changes `fade`, `morph`, the reveals and the sweeps. `slide` (0.7s), `zoom` (0.6s), `wipe` (0.8s) and `rise` (0.7s) keep their own lengths. Default reveal lengths: `iris`, `diagonal` and `blinds` 900ms, `split` 800ms, `cube` 1000ms. Default sweep lengths: `panels` 1250ms, `stripes` 1400ms, `shutter` 1300ms, `circle` 1400ms, `tiles` 1350ms, `wave` 1500ms.
- `iris`, `circle` and `tiles` start from `data-transition-origin`, else from where you clicked, else from the side the next slide comes from.
- Sweep colors are `--mg-1`, `--mg-2` and `--mg-3` (default: accent, second accent, ink). Set them on the slide or in the deck's style.
- During a sweep, and early in a reveal, the new slide's entrance animations are paused so they play as the slide appears.
- `subtle` motion turns every transition into `fade`. `none` motion, a hidden browser tab or an open overview/help panel turns it into a cut.
- Basic transitions and reveals use the browser's View Transitions API. Without it, the new slide fades in over 0.5s. Sweeps don't need it.
- An unknown name falls back to `fade` with a warning, which check.mjs reports.

assets/transitions.html shows every transition. `node scripts/check.mjs <deck> --transitions` freezes each kind the deck uses at 25%, 50% and 75% into `.check/transitions.png`.

---

## 5. Counters

```html
<div class="stats">
  <div class="stat">
    <div
      class="stat-value"
      data-count="{{q3.revenue}}"
      data-format="compact"
      data-prefix="€"
    ></div>
    <div class="stat-label">revenue</div>
  </div>
  <div class="stat">
    <div
      class="stat-value"
      data-count="{{q3.growth}}"
      data-format="percent"
    ></div>
    <div class="stat-label">growth</div>
  </div>
  <div class="stat">
    <div class="stat-value" data-count="{{q3.customers}}"></div>
    <div class="stat-label">customers</div>
  </div>
</div>
```

This counts up to "€4.8M", "18.4%" and "1,260".

| Attribute                    | Values                                                     | What it does                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data-count`                 | number (may be a `{{value}}`)                              | The final value. Decimals shown = digits after the point as written: `71` counts in whole numbers, `71.0` shows one decimal.                                                                     |
| `data-from`                  | number                                                     | Start value. Default 0.                                                                                                                                                                          |
| `data-format`                | `number` (default), `money`, `percent`, `compact`, `plain` | `number` groups digits for the locale. `money` uses the deck's currency (whole values without cents, others with two). `percent` appends `%`. `compact` gives `4.8M`. `plain` shows no grouping. |
| `data-format-arg`            | text                                                       | For `money`, a currency code such as `EUR`. **Known issue:** a decimals value (`0`) is ignored.                                                                                                  |
| `data-prefix`, `data-suffix` | text                                                       | Added before or after the number: `€`, `+`, `x`, ` users`.                                                                                                                                       |
| `data-duration`              | ms                                                         | Counting time. Default 1600. Eases out.                                                                                                                                                          |
| `data-delay`                 | ms                                                         | Wait before counting.                                                                                                                                                                            |

Counting starts when the slide appears (or the counter's step does), and runs again on every visit. In `?static`, `?sheet` and `none` motion, the final value shows at once. The element's content is replaced by the number. A `data-count` that isn't a number triggers a warning.

---

## 6. Charts

Charts are SVG, drawn by the engine in the theme's colors. They animate in, and the PowerPoint export turns them into native, editable charts.

```html
<section class="slide layout-chart" id="revenue">
  <div class="slide-head"><h2>Quarterly revenue, € millions</h2></div>
  <div
    class="chart"
    data-chart="bar"
    data-labels='["Q1","Q2","Q3","Q4"]'
    data-series='[{"name":"2025","values":[3.1,3.4,3.9,4.2]},{"name":"2026","values":[3.6,4.1,4.8]}]'
    data-format="number"
    data-format-arg="1"
    data-highlight="Q3"
  ></div>
</section>

<div
  class="chart"
  data-chart="donut"
  data-labels="Rent,Food,Travel,Other"
  data-values="1650,420,180,90"
  data-format="money"
  data-center-label="per month"
></div>

<div
  class="chart"
  data-chart="area"
  data-labels="{{growth.labels}}"
  data-values="{{growth.users}}"
  data-smooth
></div>
```

| Attribute           | Values                                                    | What it does                                                                                                        |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `data-chart`        | `bar` (default), `hbar`, `line`, `area`, `donut`, `pie`   | Chart type.                                                                                                         |
| `data-labels`       | JSON array, or a comma list                               | Category labels (slice names for donut and pie).                                                                    |
| `data-values`       | JSON array, or a comma list                               | The values of a single series.                                                                                      |
| `data-name`         | text                                                      | Name of that single series. It is used by the PowerPoint export; a single series has no legend.                     |
| `data-series`       | JSON `[{"name": …, "values": […], "color": …}]`           | Several series. Replaces `data-values`. Two or more series get a legend. `color` is optional.                       |
| `data-format`       | `number` (default), `money`, `percent`, `compact`, `date` | Format of value labels, axis ticks, legend values and the donut center.                                             |
| `data-format-arg`   | text                                                      | Argument for the format: decimals for `number` and `percent`, a currency for `money`, a style for `date`.           |
| `data-highlight`    | a label, or a 0-based index                               | The other bars, dots or slices fade to 28% (their labels and values to 60%). PowerPoint gets the same faded colors. |
| `data-show-values`  | `false`                                                   | Hide the value labels (bar, hbar, and the end label of line and area).                                              |
| `data-max`          | number                                                    | Top of the scale (bar, hbar, line, area). Default: the largest value, rounded up.                                   |
| `data-min`          | number                                                    | Bottom of the scale (line, area). Default 0, or below the lowest negative value.                                    |
| `data-smooth`       | no value                                                  | Curved lines (line, area).                                                                                          |
| `data-center`       | text                                                      | Text in the middle of a donut. Default: the total, formatted.                                                       |
| `data-center-label` | text                                                      | Small line under the center text.                                                                                   |

Rules and details:

- Put JSON attributes in single quotes, since JSON uses double quotes. From the data list, `data-values='{{growth.users}}'` works because arrays are written as JSON.
- A single number must be a JSON array: `data-values="[5]"`. A bare `data-values="5"` parses as a number, not a list, and the chart fails with a warning.
- Size: `.chart` is full width and 520px tall (`--chart-h` changes the height). Inside `layout-chart` it fills the remaining height. Donut and pie draw a square (the height, or 60% of the width if that is smaller) with the legend beside it, so give them room.
- Colors are the theme's `--chart-1` to `--chart-6`, in order. Override them in the deck's style, or per series with `color`. In donut and pie, slices take the chart colors in order, and a `color` in `data-series` changes only the first slice.
- Missing values (a shorter series, `null`) leave a gap in bar and hbar charts. In line and area charts they are drawn at the bottom of the scale, so give every series a value for every label.
- Negative values draw bars below the zero line.
- Bars grow, lines draw, dots pop, slices sweep, and labels and legend fade in when the slide (or the chart's step) appears. `--chart-dur` sets the bar time (1s). `data-delay` on the chart delays all of it.
- Charts are drawn when the deck starts and again, if their box changed size, after fonts load or the theme changes.

For radar, scatter, bubble, mixed, gauges or charts that respond to hover, use a library (libraries.md).

---

## 7. Annotations

A hand-drawn mark that draws itself on when the element appears.

```html
<h2>Churn fell to <span data-annotate="circle">2.1%</span></h2>
<p>
  We
  <span data-annotate="highlight" data-annotate-color="#facc15"
    >doubled retention</span
  >
  and <span data-annotate="strike" data-annotate-delay="1200">cut costs</span>.
</p>
```

| Attribute             | Values                                                        | What it does                                              |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `data-annotate`       | `circle`, `underline` (default), `box`, `highlight`, `strike` | The mark. `highlight` is a marker stroke behind the text. |
| `data-annotate-color` | any CSS color                                                 | Default: the theme accent.                                |
| `data-annotate-delay` | ms                                                            | Wait after the slide (or step) appears. Default 500.      |

CSS variables: `--annot-color`, `--annot-width` (stroke, 5px), `--annot-dur` (draw time, 0.9s). Inline tags (`span`, `mark`, `strong`, `em`, `b`, `i`, `a`, `code`) become `inline-block` so the mark fits them. The wobble is the same every time for the same text.

Marks are measured when the deck starts, and again after fonts load or a theme change. An element that has no size then, such as one inside a `[data-when]` panel that starts hidden, gets no mark.

---

## 8. Text that fits: data-fit

`.stat-value` always shrinks to fit its width. Add `data-fit` to any other element to do the same. The element stays on one line, and its font size drops until the text fits. All `.stat-value` and `[data-fit]` elements in one `.stats` row share the smallest size, so a row of numbers matches. Counters are measured at their final value. Fitting runs at start, after fonts load and after a theme change.

```html
<h1 data-fit>{{client.name}}: three-year plan</h1>
```

---

## 9. Icons

```html
<span class="icon" data-icon="LuRocket"></span>
<!-- tinted rounded square, 76px -->
<span class="icon lg" data-icon="LuShieldCheck"></span>
<!-- 116px -->
<span class="icon plain" data-icon="LuCheck"></span>
<!-- no background -->
Ship it <span data-icon="LuArrowRight"></span>
<!-- inline, 1em, current text color -->
```

`data-icon` takes any react-icons component name. The prefix picks the set: `Lu` Lucide, `Fa` Font Awesome (5, then 6), `Md` Material, `Tb` Tabler, `Pi` Phosphor, `Hi` Heroicons (1, then 2), `Ri` Remix, `Bs` Bootstrap, `Io` Ionicons (5, then 4), `Fi` Feather, `Si` brand logos, and more. `fa6/FaRocket` forces a set. Icons use the current text color.

scripts/icons.mjs writes engine/icons.js with only the icons the deck uses. It finds them in literal `data-icon="…"` attributes and in data-list strings that look like icon names, so `data-icon="{{t.icon}}"` works when the data holds names such as `"LuCoffee"`. check.mjs, bundle.mjs and export-pptx.mjs run it for you.

```sh
node scripts/icons.mjs <deck>                          # rebuild engine/icons.js
node scripts/icons.mjs --search chart line --set lu,fa6 --limit 40
node scripts/icons.mjs --sets                          # sets and prefixes
```

The engine fills each `[data-icon]` element's content with the SVG at load, after the data list. An unknown name logs a warning, and check.mjs reports it with suggestions. A `data-icon` your script adds later is not filled.

---

## 10. Video and other media

| Markup                                                               | Behaviour                                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `<video data-autoplay muted playsinline loop src="assets/demo.mp4">` | Rewinds to the start and plays each time its slide is shown, after the transition reveals it. |
| any `<video>`                                                        | Paused when you leave its slide. Clicking it doesn't advance the slide, so its controls work. |

- Use `data-autoplay`, not the HTML `autoplay` attribute, which starts the video at page load on a hidden slide. The engine starts and rewinds only `data-autoplay` videos.
- Add `muted` when a video must start without a click. Browsers block autoplay with sound until the viewer has interacted with the page, and the engine ignores the refusal silently.
- `<audio>` is not managed: it keeps playing when you leave the slide.
- A video can be a full-bleed background: `<video class="bg" data-autoplay muted loop playsinline src="…">` in a `layout-media` slide.
- Overview and presenter thumbnails show videos muted and still.
- bundle.mjs inlines local video and audio unless you pass `--keep-media`.

---

## 11. Presenting

### Keys

| Key                              | Action                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| → ↓ PageDown Space Enter         | Next step, then next slide.                                                                  |
| ← ↑ PageUp Backspace Shift+Space | Back.                                                                                        |
| Home / End                       | First / last visible slide.                                                                  |
| a number, then Enter             | Go to that slide (file order, hidden slides counted). The typed digits are dropped after 2s. |
| O                                | Overview of all slides; O again closes it.                                                   |
| Esc                              | Turns off the laser or pen if on; else closes the open panel; else opens the overview.       |
| F                                | Full screen.                                                                                 |
| P                                | Presenter view.                                                                              |
| L                                | Laser pointer on or off.                                                                     |
| D                                | Pen on or off.                                                                               |
| C                                | Clear the pen drawing on this slide.                                                         |
| E                                | Data editor.                                                                                 |
| T / Shift+T                      | Next / previous theme.                                                                       |
| M                                | Next motion level.                                                                           |
| B or .                           | Black screen.                                                                                |
| W                                | White screen.                                                                                |
| ? or H                           | Keyboard help.                                                                               |

- Keys with Alt, Ctrl or Cmd are left to the browser.
- While the help panel or a black or white screen is up, the next key only closes it.
- While the cursor is in a text field, only Esc does anything. Typing into a mockup's input never changes slides.
- Space and Enter don't advance while a button, link, `summary`, `[role="button"]`, `[data-set]`, `[data-toggle]` or `[data-goto]` element has focus; they are left to that element, so a focused button or link is pressed. A button you clicked inside a mockup keeps focus, so Space presses it again; → and PageDown still advance.

### Mouse, touch and clickers

- A click on the slide goes to the next step. Clicks don't advance when they land on a link, button, input, select, textarea, label, summary, video, audio, iframe, `[contenteditable]`, a `[data-interactive]` box, a `[data-set]` or `[data-toggle]` element, or anything inside `.no-advance`. Clicks that end a text selection don't advance either.
- `data-goto` makes any element a jump link (interactive.md).
- On a touch screen, a tap on the left third of the slide goes back. A horizontal swipe of more than 50px goes forward (swipe left) or back (swipe right), unless it is inside a `[data-interactive]` box.
- Presentation clickers send PageDown and PageUp (or arrow keys), which work. Their blank-screen button usually sends B or `.`, which black out the screen.

### Control bar and progress bar

Moving the mouse shows a control bar at the bottom: back, position (click it for the overview), next, overview, presenter view, laser, pen, full screen and help. It hides after 2.2 seconds without movement, and so does the mouse cursor. A thin progress bar runs along the bottom edge. `data-controls="off"` and `data-progress="off"` on the deck hide them.

### Overview (O)

The overview is a grid of every slide, fully built. Hidden slides are dimmed, and the current slide is outlined. Arrow keys move between thumbnails, Enter or a click opens one, and Esc or O closes the overview. Thumbnails are copies: canvases are copied as pixels (WebGL canvases come out blank), and nothing in them responds to clicks.

### Presenter view (P)

P opens a presenter window with:

- **Now**: the current slide at its current step.
- **Next**: the next step of this slide, or the next visible slide fully built ("End of deck" after the last).
- **Notes**: the slide's `.notes`. A− and A+ resize them; the size is remembered in this browser.
- **Timer** (click to pause, double-click to restart) and a clock.
- **Buttons**: Back, Next, laser, pen, clear ink, black screen, and a slide list to jump to.

All keys work in the presenter window too. Now and Next are copies refreshed on every slide or step change; they don't show clicks made inside a mockup. If pop-ups are blocked, a message asks you to allow them.

### Two screens

With two screens, in a browser that has the Window Management API (Chrome, Edge), P puts the slides full screen on the other screen (an external display if there is one) and opens the presenter view on this one. The first time, the browser asks for permission to manage windows. If going full screen then fails, a message asks you to press P again.

With one screen, or a browser without the API, the presenter view opens as a 1280×800 window and the slides stay in this window. On an extended desktop, a message says to drag the slides window to the projector and press F.

The engine keeps exactly two windows in step: the deck and the presenter window it opened. Slide changes, steps, theme changes, laser and ink show in both. It doesn't sync separate tabs or devices that open the same file. Closing or reloading the deck closes the presenter window.

### Laser and pen

- **L**: a red laser dot follows the pointer on the slide. Clicks still work.
- **D**: draw on the slide with the pointer, in red. While the pen is on, clicks draw instead of advancing (keys still navigate) and auto-advance pauses. Drawings are kept per slide while the page is open and come back when you return to the slide. **C** clears this slide's drawing. **Esc** turns either tool off.
- Both tools also work on the presenter view's Now picture, and show on the audience screen.

### Black, white and help

B or `.` shows a black screen and W a white one. A click or any key returns to the slide. ? (or H) shows the keys, the theme name, and whether edited data is showing.

### Auto-advance

`data-auto="8"` on the deck (or `?auto=8`) moves on every 8 seconds, step by step. A slide's own `data-auto` sets its time. The timer restarts at every step. At the end the deck stops, unless the deck has `data-auto-loop` or the URL has `?loop`, in which case it returns to the first visible slide. Auto-advance pauses while a panel is open or the pen is on, and is off in `?static`, `?print` and `?sheet` and at `none` motion.

---

## 12. URL parameters

| Parameter            | What it does                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?static`            | Every slide in its final state, with no motion: all steps, final counter values, tours at their last state. check.mjs and export-pptx.mjs use it. |
| `?sheet`             | Contact sheet: every slide as a numbered thumbnail on one scrolling page. `--sheet-cols` on `<html>` sets the columns (default 4).                |
| `?print`             | Print layout: every visible slide on its own 1920×1080 page, fully built, with every library widget started.                                      |
| `?theme=pitch`       | Use another theme.                                                                                                                                |
| `?motion=none`       | Motion level. It also overrides the system's reduced-motion setting.                                                                              |
| `?slide=5`           | Open at slide 5 (file order, hidden slides counted).                                                                                              |
| `?auto=8`            | Advance every 8 seconds.                                                                                                                          |
| `?loop`              | With auto-advance, start over at the end.                                                                                                         |
| `#/pricing` or `#/5` | Open at (or jump to) the slide with that id or number. The engine keeps the hash up to date as you move, so a reload returns to the same slide.   |

Combine them: `deck.html?static&theme=pitch#/pricing`. `?slide` wins over the hash.

---

## 13. Printing, PDF and the contact sheet

- **Browser printing** (Ctrl+P or Cmd+P): each visible slide prints on its own 1920×1080 page, at its last step, with backgrounds and without the deck's controls. Hidden slides are left out. Afterwards the deck returns to the step you were on. Library widgets on slides you haven't shown are started when printing begins, but the engine can't wait for asynchronous ones (such as a Mermaid render) to finish.
- **PDF**: `node scripts/check.mjs <deck> --pdf` loads `?print`, waits for `deck.settled()`, and writes `.check/deck.pdf`. This is the reliable way to make a PDF.
- **Known issue:** in `?print`, counters, typed text and tours on the slide the deck opens on still animate for a moment after load. A PDF made right away can catch a counter part way. Keep counters off the first slide, or check that slide in the PDF.
- **Contact sheet**: `?sheet` shows every slide at a quarter size on one page; check.mjs saves it as `.check/sheet.png`. Interactive mockups show the state they open in, because slides aren't entered there.

---

## 14. What check.mjs reports

`node scripts/check.mjs <deck> [--pdf] [--slides 3,5-7] [--theme pitch] [--no-shots] [--no-sheet] [--transitions | --transitions=all]` visits every slide in `?static` (which starts each slide's widgets), then writes `.check/slide-NN.png`, `sheet.png` and `audit.json`.

| Report                     | Meaning                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off-slide`                | Element more than 4px outside the slide. Mark intended bleeds with `data-bleed`.                                                                                     |
| `overflow` / `cut-off`     | Content bigger than its box: spilling out, or clipped by `overflow: hidden`.                                                                                         |
| `small-text`               | Text under 20px (under 13px inside `.screen`, a browser mockup's bar, or `[data-small-ok]`).                                                                         |
| `image`                    | An image that failed to load.                                                                                                                                        |
| `dense`                    | More than 110 words on the slide (aim for under 70). Notes, SVG text, code and mockup screens aren't counted.                                                        |
| `long-list`                | A list with more than 7 items.                                                                                                                                       |
| `empty`                    | No text and no image, SVG, video, canvas, iframe or chart.                                                                                                           |
| missing from the data list | `{{tokens}}` with no value.                                                                                                                                          |
| `engine:` lines            | Engine warnings: invalid data JSON, unknown filters, unknown icons, failed charts, bad `data-count`, duplicate `data-morph`, unknown transitions, JavaScript errors. |
| `error:` lines             | JavaScript errors, `console.error` output (including failed `deck.mount` calls), and files that failed to load.                                                      |

It also lists the transitions used and the slides without speaker notes. The audit can't judge design, so look at the screenshots too.

---

## 15. JavaScript API

The engine sets `window.deck` when engine/deck.js runs. Use it from a script placed after deck.js.

### window.deck

| Member                                            | What it is                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deck.ready`                                      | Promise that resolves (to `true`) once fonts and images have loaded and charts have been re-measured.                                                                                                                                                                                |
| `deck.settled()`                                  | Promise: waits for `ready`, then for every pending `deck.mount` start-up (including ones started while waiting), then one frame and 50ms. check.mjs calls it before each screenshot.                                                                                                 |
| `deck.next()` / `deck.prev()`                     | Same as → and ←: steps first, hidden slides skipped.                                                                                                                                                                                                                                 |
| `deck.goTo(target)`                               | Jump to a slide: an id (`"pricing"`), a slide number counted from 1 (`3` or `"3"`), or `"next"` / `"prev"` (the next or previous visible slide, skipping remaining steps). From a hidden slide, ← returns to where you jumped from. An unknown target does nothing.                  |
| `deck.go(index, opts)`                            | Go to a slide by 0-based index, even the current one (it is re-entered and its steps reset). `opts.instant`: no transition. `opts.atEnd`: show all its steps. `opts.dir`: `1` or `-1` to set the transition direction. A slide id works too (like `goTo`); anything else is ignored. |
| `deck.goStep(n)` / `deck.step`                    | Jump the current slide to step n (0 = as it opens; forward or back), as `data-goto-step` does. `deck.step` is the step showing.                                                                                                                                                      |
| `deck.index`                                      | 0-based index of the current slide.                                                                                                                                                                                                                                                  |
| `deck.slides`                                     | Array of the `section.slide` elements.                                                                                                                                                                                                                                               |
| `deck.data`                                       | The data list object in use (edited values included).                                                                                                                                                                                                                                |
| `deck.static`                                     | `true` in `?static`, `?print` and `?sheet`, and at `none` motion.                                                                                                                                                                                                                    |
| `deck.themes`                                     | The theme ids, in T order.                                                                                                                                                                                                                                                           |
| `deck.setTheme(id)`                               | Switch theme. This loads the theme's Google Fonts if needed, redraws charts, re-fits text, calls `theme()` hooks and fires `deck:theme`.                                                                                                                                             |
| `deck.setMotion(level)`                           | `none`, `subtle`, `moderate` or `heavy` (anything else means `moderate`).                                                                                                                                                                                                            |
| `deck.toast(message, ms)`                         | Show a short message at the top of the screen (default 1800ms).                                                                                                                                                                                                                      |
| `deck.mount(selector, init, opts)`                | Start a library widget on each matching element when its slide is first shown. See below and libraries.md.                                                                                                                                                                           |
| `deck.mountAll()`                                 | Start every registered mount on every slide now.                                                                                                                                                                                                                                     |
| `deck.audit()`                                    | The report check.mjs prints: `{ title, theme, motion, slideCount, hiddenCount, missingData, issues, slides: [{ n, id, title, layout, hidden, builds, transition, words, notes, problems }] }`.                                                                                       |
| `deck.transitions`                                | Every transition name.                                                                                                                                                                                                                                                               |
| `deck.seekTransition(f)` / `deck.endTransition()` | Freeze the running transition at a fraction from 0 to 1, or finish it. Used by `check.mjs --transitions`.                                                                                                                                                                            |

### Events

| Event        | Fired on            | When                                                                        | `detail`           |
| ------------ | ------------------- | --------------------------------------------------------------------------- | ------------------ |
| `deck:enter` | the slide (bubbles) | The slide is shown: after a sweep or reveal uncovers it, otherwise at once. | `{ slide, index }` |
| `deck:leave` | the slide (bubbles) | The slide is being left, before the next one shows.                         | `{ slide, index }` |
| `deck:theme` | `document`          | The theme changed.                                                          | `{ theme }`        |

```js
document.addEventListener("deck:enter", (e) => {
  if (e.detail.slide.id === "launch") deck.toast("Launch day");
});
```

The opening slide's `deck:enter` fires inside engine/deck.js, before your script can listen. To act on the opening slide, check `deck.slides[deck.index]` when your script starts, or use `deck.mount`, which starts at once for the current slide.

### deck.mount in brief

```js
deck.mount(
  ".js-radar",
  async (el, ctx) => {
    // runs once per element, the first time its slide is shown, after fonts and images load
    const chart = makeChart(el, ctx.colors(), ctx.animate);
    return {
      enter(ctx) {
        /* later visits, when the slide is shown */
      },
      leave(ctx) {
        /* every time the slide is left */
      },
      theme(ctx) {
        /* theme changed: recolor from ctx */
      },
    };
  },
  { eager: false },
);
```

| `ctx` member    | What it is                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `ctx.slide`     | The slide element.                                                                                        |
| `ctx.data`      | The data list.                                                                                            |
| `ctx.static`    | `true` when output should be still: `?static`, `?print`, `?sheet`, `none` motion.                         |
| `ctx.animate`   | `true` when the widget may animate (the opposite of `static`).                                            |
| `ctx.motion`    | The motion level.                                                                                         |
| `ctx.font`      | The theme's body font stack.                                                                              |
| `ctx.css(name)` | The value of a CSS variable on the element, as text.                                                      |
| `ctx.color(c)`  | A theme variable (`"--accent"`) or any CSS color, resolved to `rgb()`/`rgba()`. Transparency is kept.     |
| `ctx.solid(c)`  | The same, blended onto the slide background, so always an opaque `rgb()`.                                 |
| `ctx.colors()`  | The six chart colors (`--chart-1` to `--chart-6`) as `rgb()` strings.                                     |
| `ctx.shown`     | Promise that resolves when the slide can be seen: after a sweep or reveal uncovers it, otherwise at once. |

`static`, `animate`, `motion` and `font` are captured when the ctx is made. `color`, `solid`, `colors` and `css` read the current theme each time they are called. Hooks receive a fresh ctx; use it rather than the one from `init`.

Lifecycle, `eager`, cleanup, theme changes and worked examples: libraries.md.
