# Motion

Everything that moves in a deck: the motion level, entrance animations, click builds, slide transitions (basic, reveals and motion-graphic sweeps), `auto` transitions, cascade entrances, morph, reduced motion and static outputs, how to preview, and what to choose. Layout markup is in `layouts.md`; theme colors are in `styles.md`.

## Contents

- [Motion levels](#motion-levels)
- [Entrance animations: data-anim](#entrance-animations-data-anim)
- [Other self-running effects](#other-self-running-effects)
- [Builds vs animations](#builds-vs-animations)
- [Slide transitions](#slide-transitions)
- [auto: the theme picks per slide](#auto-the-theme-picks-per-slide)
- [data-enter="cascade"](#data-entercascade)
- [data-morph](#data-morph)
- [Reduced motion, print and static outputs](#reduced-motion-print-and-static-outputs)
- [Previewing motion](#previewing-motion)
- [Recommendations](#recommendations)
- [Pitfalls](#pitfalls)

---

## Motion levels

One setting scales all motion in the deck. It lives on `<html>`:

```html
<html lang="en" data-theme="keynote" data-motion="heavy"></html>
```

| Set it with                                         | Notes                                                       |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `node scripts/new-deck.mjs --title "…" --motion heavy` | `none`, `subtle`, `moderate` (default) or `heavy`           |
| `data-motion` on `<html>`                           | A missing or unknown value means `moderate`                 |
| **M** while presenting                              | Cycles none, subtle, moderate, heavy; not saved to the file |
| `deck.html?motion=heavy`                            | Overrides the file and the viewer's reduced-motion setting  |

What each level does:

|                                                       | `none`                                             | `subtle`                        | `moderate` (default)           | `heavy`                                      |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------- | ------------------------------ | -------------------------------------------- |
| Slide transitions                                     | None, instant                                      | Every transition becomes `fade` | As written                     | As written                                   |
| `data-anim` entrances                                 | Off                                                | All become a 0.5s fade          | As written, 0.8s, 90ms stagger | As written, 1s, 120ms stagger                |
| Click builds                                          | Skipped: each slide arrives with every build shown | Fade in, 0.5s                   | Play their animation           | Play their animation                         |
| `data-enter="cascade"`                                | Off                                                | 0.5s fade per block             | Rise 36px, 0.8s                | Rise 64px with a slight zoom and blur, 0.95s |
| Charts, meters, `data-annotate`, `data-anim="draw"`   | Shown finished                                     | Animate                         | Animate                        | Animate                                      |
| Counters, typing                                      | Show the final value and full text at once         | Run                             | Run                            | Run                                          |
| `data-loop`, `.blob` drift                            | Off                                                | Off                             | `data-loop` runs; blobs still  | `data-loop` runs; blobs drift                |
| Theme background drift (keynote glow, playful shapes) | Off                                                | Off                             | Off                            | On                                           |
| `data-depth` parallax                                 | Off                                                | Off                             | Off                            | On (follows the pointer)                     |

`none` turns off every CSS animation and CSS transition inside the deck, so hover and state changes are instant too.

---

## Entrance animations: data-anim

An element with `data-anim` animates in each time its slide appears (after the slide transition reveals it).

| Name      | What it does                                                              |
| --------- | ------------------------------------------------------------------------- |
| `fade`    | Fades in                                                                  |
| `rise`    | Fades in while moving up 48px                                             |
| `drop`    | Fades in while moving down 48px                                           |
| `left`    | Fades in from 90px to the left                                            |
| `right`   | Fades in from 90px to the right                                           |
| `zoom`    | Fades in while growing from 84%                                           |
| `pop`     | Grows from 50% with a small overshoot                                     |
| `blur`    | Comes into focus from an 18px blur, settling from 104%                    |
| `flip`    | Swings down from 75° around its top edge, in 3D                           |
| `wipe`    | Revealed left to right by a straight edge (no fade)                       |
| `reveal`  | Rises into place from behind its own bottom edge, as if from under a mask |
| `spin`    | Spins in from -120° while growing from 40%, with an overshoot             |
| `grow`    | Stretches out horizontally from its left edge (bars, rules)               |
| `grow-up` | Stretches up from its bottom edge (columns)                               |
| `draw`    | Fades in while every SVG shape inside it draws its stroke on (1.6s)       |
| `type`    | Text types itself out letter by letter with a blinking caret              |

Timing: 0.8s (`--dur`; 1s at heavy) with an ease-out curve; `pop` and `spin` use an overshoot curve.

### Attributes

| Attribute                         | On                                                            | Effect                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-delay="300"`                | Any element                                                   | Waits 300ms. Inherited: delays every animation inside the element too (child entrances, chart bars, annotation marks, meters)                        |
| `data-duration="1200"`            | Any element                                                   | Animation length in ms (inherited by children). On a `data-count` element it is the counting time instead                                            |
| `data-stagger="100"`              | A container                                                   | Its children animate one after another, 100ms apart. Its `data-anim` is passed to each child. An empty value uses the default (90ms; 120ms at heavy) |
| `data-anim-children="pop"`        | A container with `data-stagger`, `data-steps` or `data-split` | The animation for the children (the same thing `data-anim` on the container does)                                                                    |
| `data-split="words"` or `"chars"` | A heading or paragraph                                        | Splits the text and animates each word or letter (default `rise`), 75ms apart for words, 30ms for letters, or `data-stagger`                         |
| `data-draw-stagger="150"`         | A `data-anim="draw"` element                                  | Draws its shapes one after another, 150ms apart                                                                                                      |
| `data-speed="38"`                 | A `data-anim="type"` element                                  | Milliseconds per letter (default 38)                                                                                                                 |

```html
<section class="slide layout-title">
  <p class="kicker" data-anim="fade">Seed round · 2026</p>
  <h1 data-split="words" data-anim="rise" data-stagger="90">
    Budgeting people actually do
  </h1>
  <p class="lead" data-anim="rise" data-delay="450">
    Every expense logged in two taps.
  </p>
  <p class="byline" data-anim="fade" data-delay="700">
    <span>Sam Lee, CEO</span>
  </p>
  <aside class="notes">Let the title land.</aside>
</section>
```

```html
<ul class="bullets" data-stagger data-anim="rise">
  <li>Tap + from any screen</li>
  <li>Pick a category</li>
  <li>Done before the coffee cools</li>
</ul>
```

`data-stagger` with no `data-anim` (on the container or the children) does nothing visible.

Tokens for the whole deck: `--dur` (0.8s), `--stagger` (90ms), `--ease-out` (entrances), `--ease-in-out` (drawing, reveals), `--ease-back` (overshoot). Set them in `html[data-theme] { ... }`. A value set there also replaces the longer `--dur` and `--stagger` of the heavy level.

---

## Other self-running effects

| Effect     | Markup                                                   | Behavior                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Counter    | `<span data-count="48200" data-format="compact"></span>` | Counts up from `data-from` (default 0) over `data-duration` ms (default 1600) after `data-delay` ms, easing out. Shows as many decimals as `data-count` has. `data-format`: `number` (default), `money` (currency from the data list's `currency`, else USD; `data-format-arg="EUR"` picks another, `"0"` sets the decimals, `"EUR:0"` both), `percent`, `compact` (48.2K), `plain`. `data-prefix` and `data-suffix` add text |
| Typing     | `<p data-anim="type">npm install pocketwise</p>`         | Types the text; any markup inside (bold, links) is lost, so use plain text                                                                                                                                                                                                                                                                                                           |
| Charts     | `data-chart` (see `layouts.md`)                          | Bars grow (one after another), lines draw, dots pop, donut slices sweep, legends fade in                                                                                                                                                                                                                                                                                             |
| Meter      | `<div class="meter" style="--value: 72%"><i></i></div>`  | Fills over 1.3s                                                                                                                                                                                                                                                                                                                                                                      |
| Annotation | `data-annotate="circle"`                                 | Hand-drawn mark draws on after 500ms (`data-annotate-delay`), 0.9s                                                                                                                                                                                                                                                                                                                   |
| Loop       | `data-loop="float"`, `pulse`, `spin`, `drift`            | Repeats while the slide is shown: float bobs 18px (6s), pulse breathes to 106% (2.4s), spin turns (30s), drift wanders (18s). `--loop-dur` changes the period. Off at subtle and none                                                                                                                                                                                                |
| Parallax   | `data-depth="0.3"`                                       | At heavy only: shifts against the pointer, up to 32px x 22px times the depth (default 0.5)                                                                                                                                                                                                                                                                                           |
| Video      | `<video data-autoplay muted>`                            | Restarts and plays each time the slide is shown; paused when you leave                                                                                                                                                                                                                                                                                                               |

---

## Builds vs animations

|                                        | Animation (`data-anim`)                | Build (`data-step`, `data-steps`)                        |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Starts                                 | By itself when the slide appears       | When the presenter clicks or presses →                   |
| Hidden until then                      | No (only during its delay)             | Yes, the space stays reserved                            |
| Animation used                         | The named one                          | Its `data-anim` if it has one, else `rise`               |
| In print, PDF, overview, contact sheet | Shown finished                         | Every build shown                                        |
| In the PowerPoint export               | Not exported (shapes are simply there) | A click animation (fade in, or fade out for `data-exit`) |
| At motion `none`                       | Off                                    | Skipped: all builds already shown                        |

### Build markup

| Attribute                   | Effect                                                     |
| --------------------------- | ---------------------------------------------------------- |
| `data-step`                 | Appears on the next click (numbered in document order)     |
| `data-step="3"`             | Appears with click 3, together with anything else marked 3 |
| `data-steps` on a container | Each child is its own click                                |
| `data-steps="focus"`        | Same, and earlier items dim to 32% as each new one appears |
| `data-exit="2"`             | Fades out (0.45s) at click 2; it keeps its space           |

```html
<section class="slide">
  <div class="slide-head">
    <p class="kicker">Roadmap</p>
    <h2>What the round pays for</h2>
  </div>
  <div class="timeline" data-steps data-anim="rise">
    <div>
      <span class="when">Q1</span>
      <h3>Beta</h3>
      <p>2,000 users</p>
    </div>
    <div>
      <span class="when">Q2</span>
      <h3>Launch</h3>
      <p>iOS and Android</p>
    </div>
    <div>
      <span class="when">Q3</span>
      <h3>Shared budgets</h3>
      <p>Couples</p>
    </div>
  </div>
  <aside class="notes">Click through the milestones.</aside>
</section>
```

```html
<ul class="bullets" data-steps="focus">
  <li>First we fix onboarding</li>
  <li>Then we add shared budgets</li>
  <li>Then we charge for Pro</li>
</ul>
<p class="callout" data-step="3">Break-even in month 18</p>
```

Navigation with builds: → shows the next build, and moves on only when all are shown. ← hides the last build. Coming back to a slide from the next one lands on its last build, finished and frozen (entrances don't replay), though counters and typing run again.

---

## Slide transitions

`data-transition` on `<main class="deck">` sets the default; on a slide it sets how **that slide is entered**. With neither, slides fade.

```html
<main class="deck" data-transition="slide">
  <section class="slide layout-title">...</section>
  <section class="slide layout-section" data-transition="panels">...</section>
</main>
```

- The first slide appears without a transition.
- Going back plays the transition of the slide you are leaving, mirrored (a `slide` push goes the other way, `panels` come from the left).
- An unknown name is reported (in the console and by `check.mjs`) and plays as `fade`.
- No transition plays while an overlay (overview, help) is open or the tab is hidden.

### All transitions

**Basic**: the browser animates a picture of the whole slide.

| Name    | What it looks like                                                                              | Default ms |
| ------- | ----------------------------------------------------------------------------------------------- | ---------- |
| `none`  | Instant cut                                                                                     | 0          |
| `fade`  | Cross-fade                                                                                      | 600        |
| `slide` | Old slide pushes off to the left as the new one pushes in from the right                        | 700        |
| `rise`  | Old fades out while the new one floats up 6% and fades in                                       | 700        |
| `zoom`  | Old grows to 112% and fades out while the new grows from 90% and fades in                       | 600        |
| `wipe`  | A straight edge moves from the right side to the left, uncovering the new slide over the old    | 800        |
| `morph` | Cross-fade while `data-morph` elements glide to their new place (see [data-morph](#data-morph)) | 850        |

**Reveals**: the new slide is uncovered through a shape while the old one darkens and shrinks slightly behind it. Entrances on the new slide wait until 35% of the way through.

| Name       | What it looks like                                                       | Default ms |
| ---------- | ------------------------------------------------------------------------ | ---------- |
| `iris`     | A circle opens from the origin (see below)                               | 900        |
| `diagonal` | A slanted edge cuts across from the right; the old slide slides 5% aside | 900        |
| `split`    | Opens from the vertical center line outward, like doors                  | 800        |
| `blinds`   | Twelve vertical strips open together                                     | 900        |
| `cube`     | The deck turns like a cube on its vertical axis                          | 1000       |

**Motion-graphic sweeps**: colored shapes drawn by the engine cover the screen, the slide changes underneath, and the shapes sweep off. Colors are `--mg-1`, `--mg-2`, `--mg-3` (set by the theme, see `styles.md`). Entrances on the new slide wait until it is uncovered.

| Name      | What it looks like                                                                                                                   | Default ms | Slide changes at | Slide shows at |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------- | -------------- |
| `panels`  | Three full-screen panels (colors 1, 2, 3) slide in one after another from the right, then slide off to the left in reverse order     | 1250       | 50%              | 78%            |
| `stripes` | Seven diagonal bands in colors 1 and 2 race in from the right and race out to the left                                               | 1400       | 50%              | 60%            |
| `shutter` | Eight columns in colors 1 and 2 drop from the top one after another, then fall away downward                                         | 1300       | 51%              | 60%            |
| `circle`  | A ring of color 1, then color 2, grows from the origin to fill the screen; a hole then opens from the same point onto the new slide  | 1400       | 50%              | 68%            |
| `tiles`   | A checkerboard of 8 x 5 tiles in colors 1 and 2 pops in as dots that grow into squares, spreading from the origin, then shrinks away | 1350       | 48%              | 58%            |
| `wave`    | Two wavy shapes (color 2, then color 1) rise from the bottom, cover the screen and leave through the top                             | 1500       | 50%              | 68%            |

Going back, the direction flips: panels and stripes come from the left, shutter starts from the left, waves fall from the top, `slide`, `wipe`, `diagonal`, `blinds` and `cube` mirror.

### Duration

`data-transition-duration="1600"` (ms) on a slide or the deck changes the length of `fade`, `morph`, every reveal and every sweep (sweeps keep their proportions). `slide`, `zoom`, `wipe` and `rise` have fixed lengths: the attribute changes only how fast `data-morph` elements move during them.

### Origin

`iris`, `circle` and `tiles` start from a point:

1. `data-transition-origin` on the slide or the deck: `center`, `left`, `right`, `top`, `bottom`, or two percentages `"80 20"` (or `"80% 20%"`) for x and y.
2. Otherwise the spot where the presenter clicked or tapped the slide, if that click moved the deck on (within 0.8s).
3. Otherwise the side the next slide comes from: the right edge, middle height going forward (94%, 50%), the left edge going back (6%, 50%). Keyboard, remote and the on-screen buttons land here.

### How they run

- Basic transitions and reveals use the browser's View Transitions API. In a browser without it, they all become a 0.5s fade-in of the new slide.
- Sweeps are drawn by the engine (Web Animations) on top of the slide and work in every modern browser.
- Per-slide sweep colors: `<section class="slide" data-transition="panels" style="--mg-1: #111; --mg-2: #e8361c; --mg-3: #f6f5f1">`.
- `data-transition` on a `[data-interactive]` mockup is different: `push`, `fade`, `rise` or `zoom` there animate the mockup's screens, not the slide.

---

## auto: the theme picks per slide

`data-transition="auto"` (usually on the deck) lets each slide's layout pick from its theme:

| Slide                                              | Transition used                | Theme token      |
| -------------------------------------------------- | ------------------------------ | ---------------- |
| `layout-title`, `layout-section`, `layout-closing` | The theme's signature          | `--mg-signature` |
| `layout-statement`, `layout-quote`                 | The theme's reveal             | `--mg-reveal`    |
| Every other slide                                  | The theme's content transition | `--mg-content`   |

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

Without a theme the defaults are `panels`, `iris` and `slide`. Going back, the layout of the slide you are leaving decides.

The result: big sweeps only at the deck's structural moments, a reveal for the lines that must land, and a quiet move everywhere else. A slide's own `data-transition` still overrides `auto`. To change a theme's choices, set the tokens (any transition name):

```css
html[data-theme] {
  --mg-signature: circle;
  --mg-content: fade;
}
```

`check.mjs` prints which transition each slide actually gets, with `auto` resolved.

---

## data-enter="cascade"

`data-enter="cascade"` on the deck (or on one slide) makes each slide's blocks flow in one after another when the slide appears, without marking every element.

```html
<main class="deck" data-transition="auto" data-enter="cascade"></main>
```

How the engine picks the blocks, walking the slide from the top:

- A block is a kicker, heading, paragraph, `.lead`, `.card`, `.stat`, list item, figure, picture, SVG, video, table, quote, chart, pill, callout, definition, meter, device, icon, avatar, code block or button, or any element that contains only text. Containers that are not blocks (`.grid`, `.stats`, `.slide-head`, `ul`) are opened, so their cards, stats and items each get their own turn.
- Skipped: notes, the footer, `.blob`, `[data-decor]`, `[data-bleed]`, `.bleed`, mockup screens (`[data-when]`), and anything with its own `data-anim`, `data-step`, `data-steps`, `data-stagger` or `data-split` (a block containing one of those is opened instead).
- Each block starts 70ms after the previous one, after a 60ms pause; from the 15th block on they all start together (at about 1s).

| Level    | Cascade                                         |
| -------- | ----------------------------------------------- |
| none     | Off                                             |
| subtle   | 0.5s fade                                       |
| moderate | Rise 36px with fade, 0.8s                       |
| heavy    | Rise 64px, from 96% size and an 8px blur, 0.95s |

Tune it with `--cascade-gap` (70ms) and `--cascade-dur` (0.8s). Turn it off for one slide with any other value: `<section class="slide" data-enter="none">`. Explicit `data-anim` and cascade mix well: write `data-anim` on the title slide and let cascade handle the rest.

---

## data-morph

Give an element the same `data-morph` name on two consecutive slides, and the browser animates it from its place, size and look on the first slide to those on the second, like PowerPoint's Morph.

```html
<section class="slide layout-title">
  <img
    data-morph="logo"
    src="assets/logo.svg"
    alt="Pocketwise"
    style="width: 420px"
  />
  <h1>Pocketwise</h1>
  <aside class="notes">Intro.</aside>
</section>

<section class="slide" data-transition="morph">
  <img
    data-morph="logo"
    src="assets/logo.svg"
    alt=""
    style="position: absolute; right: 120px; top: 80px; width: 120px"
  />
  <div class="slide-head">
    <p class="kicker">Problem</p>
    <h2>Budgets fail in the first month</h2>
  </div>
  <aside class="notes">The logo moves to the corner.</aside>
</section>
```

How matching works:

- Names are compared without case, and any run of characters other than letters, digits, `_` and `-` counts as one `-`: `"Hero Card"`, `"hero-card"` and `"hero card"` match.
- Only the slide being left and the slide being entered take part.
- A name may appear once per slide. Two elements with one name on a slide get a warning (in the console and `check.mjs`), and the browser then cancels the whole transition into and out of that slide: it cuts. Elements inside different mockup states (`[data-when]`) may share a name.

When it plays:

- During `morph` (a 0.85s cross-fade of the rest of the slide) and also during every other basic transition and reveal, because they all use View Transitions. Sweeps and `none` don't morph.
- An element with a `data-morph` name that has **no partner** on the other slide still gets its own animation: it fades in or out on its own, above the transition, so a wipe or iris does not cover it. Only name elements that appear on both slides.
- The element's picture is stretched between its two sizes, so it works best for things that keep their proportions: logos, shapes, photos, a device, a big number, a heading that moves.
- In the PowerPoint export, named elements become Morph objects, and a slide with `data-transition="morph"` gets PowerPoint's Morph transition. Use `morph` (not another transition) when the .pptx must morph too.

---

## Reduced motion, print and static outputs

**Reduced motion.** When the viewer's system asks for reduced motion, the deck opens at `subtle` if it was set to `moderate` or `heavy` (`none` and `subtle` stay as they are). This is read once at load; a `?motion=` parameter overrides it, and M still cycles levels. Don't let motion carry meaning that a still slide doesn't.

**Static outputs:**

| Output                                            | What you get                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `?static` (used by `check.mjs` screenshots)       | Every slide in its final state: builds shown, counters at their end values, typing finished, no entrance animation |
| Print (Ctrl+P, `?print`, `check.mjs --pdf`)       | One 1920 x 1080 page per slide in its final state, no animation, hidden slides left out, controls hidden           |
| Contact sheet (`?sheet`, `check.mjs` `sheet.png`) | All slides finished, on one page                                                                                   |
| Overview (O)                                      | Finished thumbnails                                                                                                |
| Presenter window (P)                              | Its slide previews run at motion `none`                                                                            |
| `scripts/bundle.mjs`                              | The same deck in one file: all motion kept                                                                         |
| `scripts/export-pptx.mjs`                         | See below                                                                                                          |

**PowerPoint export.** Each slide is exported as it looks at its last build. Entrance animations, cascade, counters, typing, loops and chart growth are not exported. Builds become click animations (fade in, fade out for `data-exit`), even at motion `none`, where the HTML deck skips them. Slide transitions become the nearest PowerPoint transition; at motion `none` there are none, and at `subtle` they are all Fade.

| Deck       | PowerPoint                   | Deck      | PowerPoint            |
| ---------- | ---------------------------- | --------- | --------------------- |
| `fade`     | Fade                         | `split`   | Split (vertical, out) |
| `slide`    | Push (left)                  | `blinds`  | Blinds (vertical)     |
| `rise`     | Cover (up)                   | `cube`    | Push (left)           |
| `zoom`     | Zoom                         | `panels`  | Cover (left)          |
| `wipe`     | Wipe (left)                  | `stripes` | Strips                |
| `morph`    | Morph (Fade in old versions) | `shutter` | Blinds (horizontal)   |
| `iris`     | Circle                       | `circle`  | Circle                |
| `diagonal` | Strips                       | `tiles`   | Checkerboard          |
|            |                              | `wave`    | Wipe (up)             |

Sweeps, `cube` and `morph` are exported at slow speed, the rest at medium.

---

## Previewing motion

| Tool                                          | How                                                                                                                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/transitions.html`                     | Open it in a browser: one slide per transition, entered with the transition it names, ending with an `auto` slide; it uses `data-enter="cascade"`. Press → to step, **T** to change theme (and so the sweep colors), **M** to change the motion level      |
| `node scripts/check.mjs <deck> --transitions` | Freezes the first slide of each transition kind the deck uses at 25%, 50% and 75% into `.check/transitions.png` (one row per kind); single frames go to `.check/transitions/NN-kind-25.png` and so on. `auto` is resolved first; hidden slides are skipped |
| `--transitions=all`                           | A row for every slide instead of every kind                                                                                                                                                                                                                |
| `--theme pitch`                               | The same, with another theme's colors and choices                                                                                                                                                                                                          |
| URL parameters                                | `deck.html?motion=heavy&slide=5` opens slide 5 at heavy motion; `?theme=elegant` switches theme                                                                                                                                                            |

The frames show what the deck plays at its own motion level: at `subtle` every frame is a fade (the row label still names the written transition), at `none` every frame is just the finished slide. Preview at `moderate` or `heavy`.

To get stills of `assets/transitions.html` without writing into the skill folder, copy it and the engine to a scratch folder first:

```bash
mkdir -p /tmp/tx && cp -r assets/engine /tmp/tx/ && cp assets/transitions.html /tmp/tx/deck.html
node scripts/check.mjs /tmp/tx --transitions --no-shots --no-sheet
```

---

## Recommendations

|                 | Sober                                                            | Balanced (most decks)                    | Animation-heavy                                                                 |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| For             | Board, finance, consulting, academic, legal, anything read later | Business updates, product reviews, talks | Launches, keynotes, pitches, events, kids                                       |
| `data-motion`   | `subtle`                                                         | `moderate`                               | `heavy`                                                                         |
| Deck transition | `fade` (or `slide`)                                              | `auto`                                   | `auto`                                                                          |
| `data-enter`    | none                                                             | `cascade` optional                       | `cascade`                                                                       |
| Entrances       | Title slide only                                                 | Title, statements, key numbers           | Split-text titles, counters, annotations                                        |
| Builds          | Only for a list you talk through item by item                    | 1 or 2 per deck                          | Where the story has a sequence                                                  |
| Extras          | none                                                             | One `data-morph` pair                    | Morph pairs, `.blob` drift, `data-depth` on a hero device, `data-loop` on decor |

An animation-heavy title slide:

```html
<section class="slide layout-title">
  <div
    class="blob"
    data-loop="drift"
    style="width: 760px; height: 760px; right: -160px; top: -200px"
  ></div>
  <p class="kicker" data-anim="fade">Launch · 2026</p>
  <h1 data-split="words" data-anim="rise" data-stagger="90">
    Meet Pocketwise Pro
  </h1>
  <p class="lead" data-anim="blur" data-delay="500">
    Forecasts, alerts and shared budgets.
  </p>
  <aside class="notes">Wait for the title to settle.</aside>
</section>
```

A key-number slide:

```html
<section class="slide layout-statement">
  <p class="kicker">Retention</p>
  <h2>
    <span data-annotate="circle" data-annotate-delay="900"
      ><span data-count="71" data-format="percent"></span
    ></span>
    of users still log expenses after 90 days.
  </h2>
  <aside class="notes">The industry average is 25%.</aside>
</section>
```

---

## Pitfalls

1. **Too many different transitions.** A deck that uses six kinds feels like a transitions demo. Use `auto`, or one content transition plus a sweep on section slides. The `transitions:` line of `check.mjs` lists them; three kinds is plenty.
2. **Sweeps on every slide.** Each takes 1.25 to 1.5s; over 20 slides that is half a minute of colored shapes. Keep them for title, section and closing slides (which is what `auto` does).
3. **Long entrance chains.** The presenter waits for them on every visit. Keep the last entrance under about 1.2s after the slide shows (its `data-delay` plus stagger times the number of items).
4. **Builds on every list.** Build only when you speak to each item in turn; otherwise show the list.
5. **One animation per element.** `data-anim`, cascade and `data-loop` each set the element's animation, so only one plays (`data-anim` wins over `data-loop`, cascade over `data-loop`). Put the loop on an inner element:

   ```html
   <div data-anim="pop">
     <div
       class="blob"
       data-loop="float"
       style="width: 300px; height: 300px; right: 100px; top: 100px"
     ></div>
   </div>
   ```

6. **Cascade and media backgrounds.** Under `data-enter="cascade"` the `<img class="bg">` of a `layout-media` slide rises with the text. Add `data-decor` to it.
7. **Typing strips markup.** `data-anim="type"` keeps only the text; bold, links and icons inside disappear.
8. **Morph without a partner.** A named element that is not on the other slide fades on its own above a `wipe` or `iris` instead of being covered. Duplicate names on one slide cancel the whole slide transition, in both directions.
9. **`flip` and `data-depth` on one element.** Both use `transform`; at heavy the parallax overrides the flip. Put them on different elements.
10. **Expecting `data-transition-duration` to slow `slide`, `zoom`, `wipe` or `rise`.** Their lengths are fixed; pick `fade`, a reveal or a sweep if the length matters.
11. **Relying on entrances in PowerPoint.** The .pptx keeps builds and transitions only. If the PowerPoint file is the deliverable, put any sequence that matters into builds.
12. **Checking transitions at subtle.** `check.mjs --transitions` would show fades; preview at moderate or heavy and set the final level afterwards.
