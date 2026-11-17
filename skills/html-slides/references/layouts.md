# Layouts and components

Every slide layout and building block in `engine/deck.css`, with markup that works as written. Slides are `<section class="slide">` elements inside `<main class="deck">`. Colors and fonts come from the theme (see `styles.md`). Motion attributes (`data-anim`, `data-step`, transitions) are in `motion.md`.

## Contents

- [The canvas and how much fits](#the-canvas-and-how-much-fits)
- [Slide skeleton](#slide-skeleton)
- [Layout classes](#layout-classes)
  - [Plain slide (no layout class)](#plain-slide-no-layout-class)
  - [layout-title](#layout-title) · [layout-section](#layout-section) · [layout-statement](#layout-statement) · [layout-quote](#layout-quote)
  - [layout-split](#layout-split) · [layout-media](#layout-media) · [layout-chart](#layout-chart) · [layout-demo](#layout-demo) · [layout-closing](#layout-closing)
- [Slide frame: head, body, footer, notes](#slide-frame-head-body-footer-notes)
- [Text styles](#text-styles)
- [Components](#components)
  - [Grids and cards](#grids-and-cards) · [Icons](#icons) · [Stats](#stats) · [Lists and agenda](#lists-and-agenda)
  - [Timeline](#timeline) · [Compare](#compare) · [People](#people) · [Tables](#tables) · [Code](#code)
  - [Callouts, pills, definitions](#callouts-pills-definitions) · [Figures, meters, dividers](#figures-meters-dividers) · [Charts](#charts)
  - [Annotations and fitted text](#annotations-and-fitted-text) · [Layout utilities](#layout-utilities)
- [Color blocks: invert and on-accent](#color-blocks-invert-and-on-accent)
- [Background decor](#background-decor)
- [Media bleed](#media-bleed)
- [Devices and app mockups](#devices-and-app-mockups)
- [What check.mjs flags](#what-checkmjs-flags)

---

## The canvas and how much fits

Every slide is drawn on a fixed **1920 x 1080** canvas and scaled to the window, so every size in this file is in canvas pixels. A slide has 120px padding left and right and 96px top and bottom (`--pad-x`, `--pad-y`), which leaves a **1680 x 888** content area. Blocks on a slide are stacked in a column with a 48px gap (`--gap`).

**One message per slide.** Write the slide title as the takeaway sentence ("Churn halved after the new onboarding"), not a label ("Churn"). If a slide needs two titles, it is two slides.

### Text size floors

| Use                                                   | Size         | Note                                                    |
| ----------------------------------------------------- | ------------ | ------------------------------------------------------- |
| Hero title (`.layout-title h1`, `.layout-closing h2`) | 128px        | `--fs-hero`                                             |
| Slide title (`h2`)                                    | 68px         | `--fs-h2`                                               |
| Lead paragraph (`.lead`)                              | 40px         | `--fs-lead`                                             |
| Body text, bullets                                    | 32px         | `--fs-body` (editorial 34px, academic and elegant 30px) |
| Card text, table cells                                | 28px         | set by `.card p` and `table.data`                       |
| Small print (`.small`, captions, byline)              | 24px         | `--fs-small`                                            |
| Source line (`.source`)                               | 20px         | the floor for slide text                                |
| Inside app mockups (`.screen`)                        | 13px or more | app-sized text is allowed there                         |

`check.mjs` flags any text under **20px** as `small-text` (under 13px inside `.screen`, `.device-browser > .bar` or an element marked `data-small-ok`). Chart labels are exempt. Aim for 22px or more.

### How much fits

Measured across the eight themes:

| Element                                  | Characters per line | Guidance                                            |
| ---------------------------------------- | ------------------- | --------------------------------------------------- |
| Hero `h1` (128px)                        | about 25 to 30      | 2 lines at most                                     |
| Slide title `h2` (68px, max 1600px wide) | about 48 to 54      | 1 line is best, 2 is the limit                      |
| Statement `h2` (88px)                    | about 38            | 3 to 4 lines at most                                |
| Body paragraph, full width (32px)        | about 110 to 125    | avoid full-width paragraphs; use `.lead` or columns |
| `.lead` (40px, max 1400px wide)          | about 73 to 82      | 1 to 3 lines                                        |
| Card text, 3 columns (28px)              | about 30 to 40      | 2 to 3 lines per card                               |
| Card text, 4 columns (28px)              | about 20 to 30      | a title and 1 to 2 short lines                      |

After a kicker and a one-line title, about **720px of height** is left for the body: roughly 16 lines of 32px text, but a readable slide uses far less. Keep a slide **under 70 words** (`check.mjs` flags `dense` over 110) and lists to **6 items or fewer** (it flags `long-list` over 7).

---

## Slide skeleton

```html
<section class="slide" id="pricing">
  <div class="slide-head">
    <p class="kicker">Pricing</p>
    <h2>Two plans, and most teams pick the cheaper one</h2>
  </div>
  <p class="lead">Teams start on Basic and move up when they pass ten seats.</p>
  <aside class="notes">Mention the annual discount if asked.</aside>
</section>
```

- `id` is optional. It names the slide in the URL (`#/pricing`) and is what `data-goto="pricing"` jumps to.
- `<aside class="notes">` holds speaker notes. They never show on the slide; they appear in the presenter window (P) and in the PowerPoint notes pane. `check.mjs` lists slides without notes.
- `data-hidden` on a section makes it a backup slide: skipped by next and back, reachable by `data-goto` or its number.

---

## Layout classes

Add one layout class to the `<section class="slide">`. There are nine.

| Class              | Use it for                                | Arrangement                                |
| ------------------ | ----------------------------------------- | ------------------------------------------ |
| _(none)_           | Most content slides                       | Column: head on top, content below         |
| `layout-title`     | Opening slide                             | Vertically centered, hero-size `h1`        |
| `layout-section`   | Chapter divider                           | Centered, big section number               |
| `layout-statement` | One sentence that must land               | Centered `h2` at 88px                      |
| `layout-quote`     | A customer or expert quote                | Centered `.quote` with a big opening mark  |
| `layout-split`     | Text beside a picture or visual           | Two-column grid                            |
| `layout-media`     | Full-screen photo or video with a caption | Background media, white text at the bottom |
| `layout-chart`     | One chart with a takeaway                 | Chart grows to fill the height             |
| `layout-demo`      | Text beside a device mockup               | Text column plus a device at its own size  |
| `layout-closing`   | Last slide, thank you, contact            | Centered, hero-size `h2`                   |

The footer line and slide number (when the theme shows them) are never drawn on `layout-title`, `layout-section`, `layout-media` and `layout-closing`.

With `data-transition="auto"` (see `motion.md`), the layout also picks the transition: title, section and closing slides get the theme's signature sweep, statement and quote slides get its reveal, and all others get its content transition.

`.center-all` on any slide centers every block and its text: `<section class="slide layout-statement center-all">`.

### Plain slide (no layout class)

The default: a column with the head at the top and content below it, 48px apart. Wrap the content in `.slide-body` to center it vertically in the space under the head.

```html
<section class="slide">
  <div class="slide-head">
    <p class="kicker">Why now</p>
    <h2>Three shifts make this the right year</h2>
  </div>
  <div class="slide-body">
    <div class="grid cols-3">
      <div class="card">
        <h3>Open banking</h3>
        <p>Every major bank now offers an API.</p>
      </div>
      <div class="card">
        <h3>Phone-first</h3>
        <p>Most budgeting now starts on a phone.</p>
      </div>
      <div class="card">
        <h3>Cost of living</h3>
        <p>People want to see where money goes.</p>
      </div>
    </div>
  </div>
  <aside class="notes">One sentence per card, then move on.</aside>
</section>
```

### layout-title

Centered vertically, 32px between blocks. The `h1` uses the hero size (128px; keynote 140px, elegant 150px) and is capped at 1600px wide. `.lead` is capped at 1250px. `.byline` is a wrapping row of small items with a 36px top margin.

```html
<section class="slide layout-title" id="title">
  <p class="kicker">Q3 business review</p>
  <h1>Back to growth</h1>
  <p class="lead">Revenue up 18%, churn halved, and the plan for Q4.</p>
  <p class="byline"><span>Sam Lee, CFO</span><span>October 2026</span></p>
  <aside class="notes">Open with the one number that matters.</aside>
</section>
```

Theme touches: corporate fills the right 30% with a blue gradient panel and limits the text to 1150px; pitch draws a large accent circle in the bottom right and a small second-color circle, and limits the text to 1200px; elegant centers everything.

### layout-section

Centered, 24px between blocks. `.section-num` is a 220px number in the accent color; the `h2` is set at `h1` size (96px).

```html
<section class="slide layout-section" id="part-2">
  <p class="section-num">02</p>
  <h2>What we change in Q4</h2>
  <aside class="notes">Second half: the plan.</aside>
</section>
```

### layout-statement

Centered vertically; the `h2` is 88px with 1.08 line height, up to 1600px wide. Use `<mark>` for the words to stress (each theme styles it: accent color, gradient text, highlighter or italic).

```html
<section class="slide layout-statement">
  <p class="kicker">The problem</p>
  <h2>Eight in ten trial users never <mark>connect a bank account</mark>.</h2>
  <p class="source">Source: product analytics, January to September 2026</p>
  <aside class="notes">Pause after the number.</aside>
</section>
```

### layout-quote

Centered vertically. `.quote` is 64px in the heading font (override with `--font-quote` and `--quote-weight`) with a large opening quote mark in the accent color. `.cite` is a block in small text with a 36px top margin.

```html
<section class="slide layout-quote">
  <blockquote class="quote">
    It's the first budget app I didn't delete after a week.
  </blockquote>
  <cite class="cite">Beta user, App Store review</cite>
  <aside class="notes">Read it slowly.</aside>
</section>
```

Keep quotes to about 25 words; at 64px a line holds about 50 characters.

### layout-split

A grid with two columns (`1fr 1fr` by default), a 96px gap and both columns vertically centered. Children:

- `.col`: the text column (a column of blocks, 32px apart).
- `.visual`: the picture column. It is as tall as the content area (888px) and centers what it holds. An `<img>` or `<video>` directly inside fills it with `object-fit: cover` and rounded corners.

```html
<section class="slide layout-split">
  <div class="col">
    <p class="kicker">Onboarding</p>
    <h2>Setup now takes four minutes</h2>
    <ul class="bullets">
      <li>Bank sync on the first screen</li>
      <li>Categories learned from the first week</li>
      <li>No forms to fill in</li>
    </ul>
  </div>
  <div class="visual">
    <img src="assets/onboarding.png" alt="The new onboarding screen" />
  </div>
  <aside class="notes">The photo is the new first screen.</aside>
</section>
```

| Modifier                   | Effect                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `reverse`                  | Text column moves to the right, visual to the left                                                                     |
| `wide-text`                | Columns `1.3fr 1fr`                                                                                                    |
| `wide-visual`              | Columns `1fr 1.35fr`                                                                                                   |
| `bleed`                    | The visual runs off the top, bottom and outer edge of the slide, with square corners (see [Media bleed](#media-bleed)) |
| `style="--split: 2fr 1fr"` | Any other column ratio                                                                                                 |

Put `.col` first and `.visual` second in the markup; `reverse` swaps them visually. Because a direct `<img>` is cropped to fill the full-height column, use a `.figure` or a device mockup inside `.visual` when the whole picture must show.

### layout-media

A full-screen background picture or video with text at the bottom. The slide's text turns white, a dark gradient (the scrim) rises from the bottom so the text stays readable, and blocks other than the background are capped at 1300px wide. Theme decorations are not drawn on media slides.

```html
<section class="slide layout-media">
  <img class="bg" src="assets/warehouse.jpg" alt="" data-decor />
  <p class="kicker">Operations</p>
  <h2>Two warehouses became one, and shipping got faster</h2>
  <aside class="notes">Photo from the new site.</aside>
</section>
```

- The background is an `<img class="bg">` or `<video class="bg" muted loop data-autoplay>` as a direct child. `data-autoplay` makes the engine restart and play the video each time the slide is shown.
- `no-scrim` on the slide removes the gradient (only when the picture is dark enough on its own).
- `data-decor` on the background keeps it out of `data-enter="cascade"`, which would otherwise make the background rise with the text.

### layout-chart

A plain column where a `.chart` grows to fill the height left under the head. `.takeaway` is a lead-size sentence for under the chart.

```html
<section class="slide layout-chart">
  <div class="slide-head">
    <p class="kicker">Revenue by quarter, $M</p>
    <h2>Q3 beat the plan by 18%</h2>
  </div>
  <div
    class="chart"
    data-chart="bar"
    data-labels='["Q1","Q2","Q3","Q4"]'
    data-values="[4.2,5.1,6.8,7.4]"
    data-highlight="Q3"
  ></div>
  <p class="takeaway">The new pricing page drove most of the jump.</p>
  <aside class="notes">Q4 is the forecast.</aside>
</section>
```

Chart attributes are listed under [Charts](#charts).

### layout-demo

A grid with a flexible text column and a device at its own size (`minmax(0, 1fr) auto`), 110px apart, vertically centered. Put the text in `.col` first and the device second.

```html
<section class="slide layout-demo">
  <div class="col">
    <p class="kicker">Live demo</p>
    <h2>Log a coffee in two taps</h2>
    <ul class="bullets check">
      <li>Tap + from any screen</li>
      <li>Pick a category</li>
    </ul>
  </div>
  <div class="device-phone">
    <div class="screen">
      <img class="shot" src="assets/app-home.png" alt="The app's home screen" />
    </div>
  </div>
  <aside class="notes">Point at the plus button.</aside>
</section>
```

**Device on the left:** add `reverse` (`class="slide layout-demo reverse"`). The text column stays first in the markup, and the columns swap with it.

A phone is 860px tall, which fills the 888px content area. Use it in `layout-demo` or a `layout-split` `.visual`, not under a slide head, where only about 720px is left.

### layout-closing

Centered vertically; the `h2` uses the hero size. `.contact` is a wrapping row of items at body size, each item an inline row of icon and text. It pairs well with `on-accent` or `invert`.

```html
<section class="slide layout-closing on-accent">
  <p class="kicker">Thank you</p>
  <h2>Questions?</h2>
  <div class="contact">
    <span><span data-icon="LuMail"></span>sam@example.com</span>
    <span><span data-icon="LuGlobe"></span>example.com</span>
  </div>
  <aside class="notes">Leave this up during questions.</aside>
</section>
```

---

## Slide frame: head, body, footer, notes

| Class         | What it does                                                           |
| ------------- | ---------------------------------------------------------------------- |
| `.slide-head` | Column for kicker, title and lead; 18px gap; max 1600px wide           |
| `.slide-body` | Takes the remaining height and centers its blocks vertically; 32px gap |
| `.notes`      | Speaker notes; never shown on the slide                                |
| `.no-chrome`  | On a slide: hide the footer and slide number on that slide             |

**Footer and slide number.** The engine adds a footer to every slide: the text of `data-footer` on `<main class="deck">` on the left and the slide number on the right. Whether it shows depends on the theme:

| Theme                            | Footer                                |
| -------------------------------- | ------------------------------------- |
| corporate                        | Bottom, with a hairline above it      |
| academic                         | Bottom                                |
| minimal                          | Top, bold uppercase, under a 2px rule |
| editorial                        | Top, italic, under a double rule      |
| keynote, pitch, playful, elegant | Not shown                             |

```html
<main class="deck" data-transition="fade" data-footer="Acme · Q3 review"></main>
```

The slide number counts every section, hidden ones included. To write one slide's footer yourself, put `<footer class="slide-chrome"><span>Your text</span><span>7</span></footer>` directly in that section; the engine then leaves it alone.

**Logo.** `data-logo="assets/logo.svg"` on `<main class="deck">` puts the logo at the start of that footer row on every content slide, in every theme (on its own where the theme hides the footer). `data-logo-invert` is the version for dark slides; `class="no-logo"` leaves it off one slide. Details: engine.md, "Footer, slide number and logo".

---

## Text styles

| Class or tag        | Look                                                         |
| ------------------- | ------------------------------------------------------------ |
| `h1`                | 96px heading (`--fs-h1`); hero size on title slides          |
| `h2`                | 68px heading (`--fs-h2`)                                     |
| `h3`                | 40px heading (`--fs-h3`); 38px in cards                      |
| `h4`                | 30px heading                                                 |
| `.kicker`           | 22px bold uppercase label in the accent color, letter-spaced |
| `.lead`             | 40px secondary-color paragraph, max 1400px wide              |
| `.muted` / `.faint` | Secondary / tertiary text color                              |
| `.small` / `.big`   | 24px / 40px                                                  |
| `.accent`           | Accent-colored text                                          |
| `<mark>`            | Stressed words; each theme styles it differently             |
| `.source`           | 20px faint line for sources and footnotes                    |
| `.takeaway`         | 40px sentence, max 1500px wide                               |
| `.dropcap`          | Large first letter (editorial theme only)                    |

Headings balance their lines (`text-wrap: balance`), so a two-line title breaks evenly.

---

## Components

### Grids and cards

`.grid` is an equal-column grid with a 32px gap, 3 columns by default. `.cols-2`, `.cols-3`, `.cols-4`, `.cols-5` set the count (they also work on `.stats`, `.timeline` and `.people`), or set `style="--cols: 6"`.

`.card` is a padded box (44px) with the theme's surface, border, radius and shadow; `h3` inside is 38px and `p` is 28px in the secondary color.

```html
<div class="grid cols-3">
  <div class="card">
    <span class="icon" data-icon="LuWallet"></span>
    <h3>Budgets</h3>
    <p>Plan the month in five minutes.</p>
  </div>
  <div class="card is-accent">
    <span class="icon" data-icon="LuChartPie"></span>
    <h3>Insights</h3>
    <p>See where the money went.</p>
  </div>
  <div class="card is-quiet">
    <span class="icon" data-icon="LuSettings"></span>
    <h3>Rules</h3>
    <p>Sort every expense automatically.</p>
  </div>
</div>
```

| Modifier          | Effect                                                               |
| ----------------- | -------------------------------------------------------------------- |
| `.card.is-accent` | Filled with the accent color; text and icon switch to `--accent-ink` |
| `.card.is-quiet`  | No background or shadow                                              |

Themes reshape cards: minimal and editorial turn them into columns with a rule on top (no box), playful tilts them and adds a thick border with a hard offset shadow, keynote gives them a frosted-glass look.

### Icons

`data-icon` takes a react-icons name (`LuWallet`, `LuMail`, `FaRocket`, `MdOutlineSavings`...). `check.mjs` (and `scripts/icons.mjs`) writes the icons a deck uses into `engine/icons.js` and reports unknown names with suggestions.

| Markup                                                  | Look                                             |
| ------------------------------------------------------- | ------------------------------------------------ |
| `<span class="icon" data-icon="LuWallet"></span>`       | 76px tile, accent-tinted background, accent icon |
| `<span class="icon lg" data-icon="LuWallet"></span>`    | 116px tile                                       |
| `<span class="icon plain" data-icon="LuWallet"></span>` | Icon only, 1.2em, no tile                        |
| `<span data-icon="LuWallet"></span>`                    | Inline icon at the text size (1em)               |

### Stats

`.stats` is a grid of big numbers, 3 columns by default with a 56px gap. Each `.stat` holds a `.stat-value` (136px, `--fs-stat`, never wraps) and a `.stat-label` (body size, max 24 characters wide). Numbers in one `.stats` row shrink together to fit their columns, so all of them keep the same size.

```html
<div class="stats">
  <div class="stat">
    <div class="stat-value" data-count="48200" data-format="compact"></div>
    <div class="stat-label">monthly active users</div>
  </div>
  <div class="stat">
    <div class="stat-value" data-count="71" data-format="percent"></div>
    <div class="stat-label">still active after 90 days</div>
  </div>
  <div class="stat">
    <div class="stat-value">4.8★</div>
    <div class="stat-label">App Store rating</div>
  </div>
</div>
```

- `data-count` makes the number count up when it appears (details and formats in `motion.md`). Leave the element empty; the engine writes the number. A plain value like `4.8★` works too.
- Number color: accent in most themes; ink in keynote. In minimal and pitch the numbers are ink and the first one (or any `.stat.is-key`) is accent.
- Three stats per row is the sweet spot; four fit with shorter numbers (`.stats.cols-4`).

### Lists and agenda

`.bullets` is a list without browser bullets: each item has a 16px accent marker (the theme sets its shape) and 22px between items.

```html
<ul class="bullets">
  <li>Bank sync on the first screen</li>
  <li>
    Categories learned from the first week
    <span class="muted">No rules to write</span>
  </li>
  <li>No forms to fill in</li>
</ul>
```

| Variant             | Marker                                            |
| ------------------- | ------------------------------------------------- |
| `.bullets`          | Dot, bar, diamond or ring, depending on the theme |
| `.bullets.numbered` | Number in a 44px tinted circle                    |
| `.bullets.check`    | Check mark in the accent color                    |
| `li > .muted`       | Becomes a second, smaller line under the item     |

`.agenda` is a numbered table of contents: items in the heading font at 46px, numbered 01, 02... in the accent color, with a rule under each. Links with `data-goto` jump to a slide by id.

```html
<ol class="agenda">
  <li><a data-goto="problem">Why budgets fail</a></li>
  <li><a data-goto="demo">The app, live</a></li>
  <li><a data-goto="ask">The ask</a></li>
</ol>
```

Up to about 7 agenda items fit under a slide head.

### Timeline

`.timeline` is a grid of milestones (4 columns by default) with a line across the top and an accent ring above each item. Inside an item: `.when` (small bold uppercase accent label), `h3` (36px) and `p` (26px, secondary color).

```html
<div class="timeline">
  <div>
    <span class="when">Q1 2026</span>
    <h3>Beta</h3>
    <p>2,000 waitlist users</p>
  </div>
  <div>
    <span class="when">Q2 2026</span>
    <h3>Launch</h3>
    <p>iOS and Android</p>
  </div>
  <div>
    <span class="when">Q3 2026</span>
    <h3>Shared budgets</h3>
    <p>Couples and roommates</p>
  </div>
  <div>
    <span class="when">Q1 2027</span>
    <h3>Pro</h3>
    <p>Forecasts and alerts</p>
  </div>
</div>
```

Use `.timeline.cols-3` or `.cols-5` for other counts; at 4 columns each item is about 390px wide.

### Compare

`.compare` puts two blocks side by side with a word between them (`minmax(0,1fr) auto minmax(0,1fr)`, 48px gap). `.vs` is the middle word in the heading font.

```html
<div class="compare">
  <div class="card">
    <h3>Before</h3>
    <p>Forty minutes of setup and a spreadsheet.</p>
  </div>
  <div class="vs">vs</div>
  <div class="card is-accent">
    <h3>After</h3>
    <p>Four minutes, and the bank does the typing.</p>
  </div>
</div>
```

### People

`.people` is a grid of `.person` blocks (4 columns by default): a 168px round `.avatar`, a 34px `h3` and a 24px `p`, all centered. The avatar holds a photo or initials.

```html
<div class="people">
  <div class="person">
    <div class="avatar"><img src="assets/sam.jpg" alt="" /></div>
    <h3>Sam Lee</h3>
    <p>CEO</p>
  </div>
  <div class="person">
    <div class="avatar">RK</div>
    <h3>Riya Kapoor</h3>
    <p>CTO</p>
  </div>
</div>
```

With the data list, `<div class="avatar">{{person.name | initials}}</div>` writes the initials.

### Tables

`table.data`: full width, 28px cells with a rule under each row, 22px uppercase headers over a 2px rule.

```html
<table class="data">
  <tr>
    <th>Metric</th>
    <th class="num">Q2</th>
    <th class="num">Q3</th>
  </tr>
  <tr>
    <td>Customer acquisition cost</td>
    <td class="num">$5.20</td>
    <td class="num">$4.10</td>
  </tr>
  <tr class="is-key">
    <td>Lifetime value</td>
    <td class="num">$54</td>
    <td class="num">$62</td>
  </tr>
  <tr>
    <td>Payback</td>
    <td class="num">3 months</td>
    <td class="num">2 months</td>
  </tr>
</table>
```

- `.num` on a cell right-aligns it with even-width digits.
- `tr.is-key` makes a row bold and accent-colored.
- About 8 rows fit under a slide head; past that, split the table or move detail to a hidden backup slide.

### Code

`.code` (on a `<pre>`) is a dark block: 26px monospace, 40px by 48px padding, no wrapping (long lines are cut off, so keep lines under about 70 characters). Color the tokens with spans, or load a highlighter with `scripts/add-lib.mjs`.

```html
<pre
  class="code"
><span class="k">const</span> pw = <span class="k">new</span> <span class="f">Pocketwise</span>({ token });
<span class="c">// one call per expense</span>
<span class="hl"><span class="k">await</span> pw.expenses.<span class="f">add</span>({ amount: <span class="n">4.75</span>, category: <span class="s">"coffee"</span> });</span></pre>
```

| Span class | Color                                       |
| ---------- | ------------------------------------------- |
| `.k`       | Keyword (red)                               |
| `.s`       | String (light blue)                         |
| `.c`       | Comment (gray italic)                       |
| `.n`       | Number (blue)                               |
| `.f`       | Function name (purple)                      |
| `.hl`      | Wrap a whole line to give it a lighter band |

Set `--code-bg` and `--code-ink` (on the `.code` element or the deck) to change the block's background and text color.

### Callouts, pills, definitions

```html
<p class="callout">Every expense is logged in two taps.</p>
<p class="callout soft">Tip: connect the bank first.</p>
<span class="pill">New in Q3</span>
<div class="definition">
  <strong>Churn</strong>: users who stop logging for 30 days.
</div>
```

| Class           | Look                                                               |
| --------------- | ------------------------------------------------------------------ |
| `.callout`      | Accent-filled box with lead-size text                              |
| `.callout.soft` | Accent-tinted box with ink text                                    |
| `.pill`         | Small rounded label (22px), accent-tinted                          |
| `.definition`   | Box with a 6px accent bar on the left, on the second surface color |

### Figures, meters, dividers

```html
<figure class="figure">
  <img src="assets/dashboard.png" alt="The budget dashboard" />
  <figcaption>The dashboard after one month of use</figcaption>
</figure>

<div class="meter" style="--value: 72%"><i></i></div>

<div class="divider"></div>
```

| Class      | What it is                                                                              |
| ---------- | --------------------------------------------------------------------------------------- |
| `.figure`  | Column with a rounded, cover-fitted picture and a small caption                         |
| `.meter`   | 22px progress bar; the `<i>` inside fills to `--value`, animated when the slide appears |
| `.divider` | 1px rule in the line color                                                              |

### Charts

A `<div class="chart" data-chart="...">` is drawn as an SVG chart in the theme's chart colors, and it animates when the slide appears. Its height is `--chart-h` (520px by default); in `layout-chart` it fills the remaining height instead.

| Attribute                          | Meaning                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `data-chart`                       | `bar`, `hbar`, `line`, `area`, `donut` or `pie`                                                       |
| `data-labels`                      | Category labels: JSON (`'["Q1","Q2"]'`) or comma-separated (`"Q1,Q2"`)                                |
| `data-values`                      | One series of numbers                                                                                 |
| `data-series`                      | Several series: `'[{"name":"2025","values":[3,4]},{"name":"2026","values":[4,6],"color":"#e8361c"}]'` |
| `data-format`                      | Value labels: `number` (default), `money`, `percent`, `compact`                                       |
| `data-highlight`                   | A label or index to stress; the others are faded                                                      |
| `data-show-values="false"`         | Hide the value labels                                                                                 |
| `data-max`, `data-min`             | Fix the axis (`data-min` on line and area only)                                                       |
| `data-smooth`                      | Curved lines (line, area)                                                                             |
| `data-center`, `data-center-label` | Big text and caption in a donut's hole (default: the total)                                           |

Series take `--chart-1` to `--chart-6` in order. A legend is added for two or more series, and always for donut and pie (with values and percentages). Chart text is 22px and is not counted by the small-text check. Charts are exported to PowerPoint as native, editable charts.

```html
<div
  class="chart"
  data-chart="donut"
  data-labels='["Rent","Food","Transport","Fun"]'
  data-values="[1650,380,120,65]"
  data-format="money"
  data-center-label="per month"
  style="--chart-h: 560px"
></div>
```

### Annotations and fitted text

`data-annotate` draws a hand-drawn mark on an element when the slide appears: `circle`, `underline`, `box`, `highlight` or `strike`. `data-annotate-color` changes its color (default accent) and `data-annotate-delay` its start in ms (default 500).

```html
<h2>
  <span data-annotate="circle">8 in 10</span> trial users never connect a bank.
</h2>
```

`data-fit` keeps an element on one line and shrinks its font until it fits its width: good for one huge word or number. Give it its starting size with a class in the deck's `<style>`, not an inline style: the engine clears an inline `font-size` (and the size inside an inline `font:`) before it measures. The same goes for `.stat-value`.

```html
<style>
  .huge {
    font: 800 300px/1 var(--font-head);
  }
</style>

<p class="huge" data-fit>$3,000,000</p>
```

### Layout utilities

| Class          | Effect                                                   |
| -------------- | -------------------------------------------------------- |
| `.row`         | Horizontal flex row, 32px gap, items vertically centered |
| `.stack`       | Vertical column, 24px gap                                |
| `.grow`        | Takes the remaining space (`flex: 1`)                    |
| `.center`      | Centers its content both ways                            |
| `.text-center` | Centers text                                             |
| `.mt-auto`     | Pushes a block to the bottom of a column                 |

```html
<div class="row">
  <span class="icon lg" data-icon="LuCircleCheck"></span>
  <p class="lead">Approved by the board on 14 October.</p>
</div>
```

---

## Color blocks: invert and on-accent

| Class        | Effect                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `.invert`    | Swaps to the theme's inverted colors: dark in light themes (navy in corporate, black in minimal), light in the dark themes (keynote, elegant) |
| `.on-accent` | Fills with the theme's accent color; text, kickers, icons and lines turn to the accent's ink color                                            |

Both work on a slide or on any block inside one:

```html
<section class="slide layout-statement invert">
  <h2>We are not building another spreadsheet.</h2>
  <aside class="notes">Contrast with competitors.</aside>
</section>

<div class="card on-accent">
  <h3>Pro</h3>
  <p>$8 a month</p>
</div>
```

Use one or two of these per deck to mark section breaks, the key statement or the closing slide. Keynote's glow and playful's corner shapes are not drawn on `invert` or `on-accent` slides.

---

## Background decor

**Theme decoration.** Several themes draw on the slide's own `::before` and `::after`: minimal (top rule), editorial (double top rule), elegant (inset frame), keynote (glow), playful (corner shapes) on every slide, and corporate and pitch on title slides; `layout-media` uses `::after` for its scrim. Do not style `.slide::before` or `.slide::after` yourself; add an element instead.

**`.blob`**: a soft organic shape in the accent color at 16% opacity, behind the content. Place and size it with inline styles; it may hang off the slide edge.

```html
<section class="slide layout-title">
  <div
    class="blob"
    style="width: 760px; height: 760px; right: -160px; top: -200px"
  ></div>
  <p class="kicker">Seed round</p>
  <h1>Pocketwise</h1>
  <aside class="notes">Intro.</aside>
</section>
```

Blobs drift slowly at the heavy motion level; `data-loop="drift"` makes one drift at every level except subtle and none (see `motion.md`).

**`data-decor`** marks any decorative element you add (a shape, a big faint number, a background picture). `check.mjs` does not check it and `data-enter="cascade"` does not animate it. Position it absolutely with `z-index: -1` to put it behind the content:

```html
<div
  data-decor
  aria-hidden="true"
  style="position: absolute; right: 80px; bottom: -60px; z-index: -1; font: 800 420px/1 var(--font-head); color: var(--accent-soft)"
>
  03
</div>
```

---

## Media bleed

"Bleed" means a picture runs off the slide edge. Three ways:

| Way                            | Markup                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-screen background         | `layout-media` with `<img class="bg">`                                                                                                              |
| Half-slide picture to the edge | `<section class="slide layout-split bleed">`: the `.visual` loses the padding on the top, bottom and outer side and its picture gets square corners |
| Anything else past the edge    | Position it yourself and add `data-bleed` so `check.mjs` does not report it as off-slide                                                            |

```html
<section class="slide layout-split bleed">
  <div class="col">
    <p class="kicker">Our stores</p>
    <h2>Forty shops, one checkout</h2>
  </div>
  <div class="visual">
    <img src="assets/store.jpg" alt="A store interior" />
  </div>
  <aside class="notes">Photo from the Leeds store.</aside>
</section>
```

`check.mjs` currently skips every element on a `layout-split bleed` slide, so it will not report overflow or small text there; look at that slide's screenshot yourself.

---

## Devices and app mockups

| Class             | Size                               | Holds                                                                          |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `.device-phone`   | 410 x 860                          | One `.screen`                                                                  |
| `.device-browser` | 1120 x 720 (override with `style`) | `<div class="bar"><span class="url">example.com</span></div>` then a `.screen` |
| `.device-laptop`  | screen 1100 x 660                  | One `.screen`                                                                  |

A `.screen` holds a screenshot (`<img class="shot" src="...">`, cropped from the top) or a mockup built from the UI kit. Mockup text may go down to 13px.

```html
<div class="device-browser" style="width: 1400px; height: 640px">
  <div class="bar"><span class="url">app.example.com/plan</span></div>
  <div class="screen">
    <img class="shot" src="assets/plan.png" alt="The planning page" />
  </div>
</div>
```

**UI kit** (colors from `--screen-bg`, `--screen-ink`, `--screen-ink-2`, `--screen-line`, `--screen-surface`, `--screen-accent`; font from `--screen-font`):

| Class                                    | Part                                              |
| ---------------------------------------- | ------------------------------------------------- |
| `.ui-page`                               | A full screen (absolute, column)                  |
| `.ui-status`                             | Empty 54px status-bar space                       |
| `.ui-bar`                                | Top bar with a title; `.ui-back` for a back arrow |
| `.ui-body`                               | Scrolling area, column, 14px gap                  |
| `.ui-title`, `.ui-sub`                   | 34px bold title, 18px secondary line              |
| `.ui-card` (`.is-accent`)                | Rounded panel (accent-filled)                     |
| `.ui-list` > `.ui-row` (`.ui-end`)       | List rows; `.ui-end` pushes a value to the right  |
| `.ui-btn` (`.is-ghost`)                  | Button (outlined)                                 |
| `.ui-chips` > `.ui-chip` (`.is-current`) | Filter chips                                      |
| `.ui-input`                              | Text field                                        |
| `.ui-tabs` > `.ui-tab` (`.is-current`)   | Bottom tab bar                                    |
| `.ui-fab`                                | Round floating button                             |
| `.ui-sheet`, `.ui-scrim`, `.ui-toast`    | Bottom sheet, dimmed backdrop, toast              |
| `.ui-side` > `.ui-nav` (`.is-current`)   | Desktop sidebar and its items                     |

```html
<div class="device-phone">
  <div class="screen">
    <div class="ui-page">
      <div class="ui-status"></div>
      <div class="ui-bar">Hi, Sam</div>
      <div class="ui-body">
        <div class="ui-card is-accent">
          <div class="ui-sub" style="color: rgba(255,255,255,.8)">
            Left this month
          </div>
          <div class="ui-title">$1,284.50</div>
        </div>
        <div class="ui-list">
          <div class="ui-row">
            <span data-icon="LuCoffee"></span>Blue Bottle<span class="ui-end"
              >-$4.75</span
            >
          </div>
          <div class="ui-row">
            <span data-icon="LuShoppingCart"></span>Groceries<span
              class="ui-end"
              >-$62.10</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

`.pin` is a numbered marker placed over a screenshot with `style="--x: 30%; --y: 42%"` (position relative to the parent, which must be positioned, such as a `.screen`). Clickable mockups (`data-interactive`, `data-set`, `data-when`, `data-tour`) and `.hotspot` are described in `references/interactive.md`.

---

## What check.mjs flags

`node scripts/check.mjs <deck>` lays out every slide in its final state and reports:

| Problem      | Meaning                              | Usual fix                                                               |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| `overflow`   | Content is bigger than its box       | Shorten the text, or give the box room                                  |
| `cut-off`    | Same, but the box hides the overflow | As above                                                                |
| `off-slide`  | More than 4px outside the slide      | Move it in, or mark intentional bleed with `data-bleed` or `data-decor` |
| `small-text` | Text under 20px (13px in mockups)    | Use 22px or more                                                        |
| `dense`      | More than 110 words                  | Split the slide; aim for under 70 words                                 |
| `long-list`  | A list with more than 7 items        | Split or group                                                          |
| `empty`      | No text and no picture               | Add content or delete the slide                                         |
| `image`      | A picture did not load               | Fix the `src` path                                                      |

Elements inside `.notes`, `.blob`, `[data-decor]`, `[data-bleed]`, `.bleed` and `[aria-hidden="true"]` are not checked. The audit cannot judge design: always look at the PNGs in `.check/`.
