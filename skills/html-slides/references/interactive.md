# Interactive slides: app and web demos

To present a web or mobile app, draw its screens in HTML inside a device frame and let clicks move between them. The engine gives any `[data-interactive]` box a small state, such as `screen:home menu:on`. Buttons change the state, and parts of the screen show or hide to match it. No library is needed. For real logic (forms that validate, lists you can add to, totals that update), add Alpine.js on top (libraries.md).

Everything here is implemented in engine/deck.js (state, tours, click handling) and engine/deck.css (frames and UI kit).

## Contents

1. [Device frames](#1-device-frames)
2. [The mockup UI kit](#2-the-mockup-ui-kit)
3. [Screenshots with hotspots](#3-screenshots-with-hotspots)
4. [State: data-interactive and data-state](#4-state-data-interactive-and-data-state)
5. [Showing parts: data-when](#5-showing-parts-data-when)
6. [Changing state: data-set and data-toggle](#6-changing-state-data-set-and-data-toggle)
7. [Screen transitions](#7-screen-transitions)
8. [Typed text: data-input and data-text](#8-typed-text-data-input-and-data-text)
9. [Resetting: data-reset](#9-resetting-data-reset)
10. [Jumping to slides: data-goto](#10-jumping-to-slides-data-goto)
11. [Tours](#11-tours)
12. [Clicks, keys and swipes inside a demo](#12-clicks-keys-and-swipes-inside-a-demo)
13. [Complete example: a two-screen phone demo](#13-complete-example-a-two-screen-phone-demo)
14. [How demos look in checks, PDF and PowerPoint](#14-how-demos-look-in-checks-pdf-and-powerpoint)
15. [Attributes the engine uses internally](#15-attributes-the-engine-uses-internally)

---

## 1. Device frames

| Class            | Size            | What it is                                                                                                                                                                                           |
| ---------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `device-phone`   | 410×860         | A phone with rounded corners and a camera notch. Put one `.screen` inside.                                                                                                                           |
| `device-browser` | 1120×720        | A browser window. First child `.bar` (traffic-light dots, add `<span class="url">` for the address), then `.screen`.                                                                                 |
| `device-laptop`  | screen 1100×660 | A laptop with a base. Put one `.screen` inside.                                                                                                                                                      |
| `screen`         | fills its frame | The app's display. It clips its content and uses app-sized text (22px) in the `--screen-*` colors. Its direct `[data-when]` children are stacked full size on top of each other, one per app screen. |

The frames have fixed sizes in canvas pixels. Change them with `style="width: 1500px; height: 640px"` on the frame. Place a frame with `layout-demo` (text `.col` beside the device) or in the `.visual` column of `layout-split`.

```html
<div class="device-phone">
  <div class="screen">…</div>
</div>

<div class="device-browser" style="width: 1500px; height: 640px">
  <div class="bar"><span class="url">app.example.com/plan</span></div>
  <div class="screen">…</div>
</div>
```

### Mockup colors

| Variable           | Default                | Used for                           |
| ------------------ | ---------------------- | ---------------------------------- |
| `--screen-bg`      | `#ffffff`              | Screen background.                 |
| `--screen-ink`     | `#15151a`              | Text.                              |
| `--screen-ink-2`   | `#6b6b75`              | Secondary text, inactive tabs.     |
| `--screen-line`    | `#e7e7ec`              | Dividers, input borders.           |
| `--screen-surface` | `#f4f4f7`              | Cards, lists, chips.               |
| `--screen-accent`  | the slide's `--accent` | Buttons, current tab, focus rings. |
| `--screen-font`    | the theme's body font  | Every font in the mockup.          |

Set them on the device frame (or its `.screen`) to match the app's brand. Don't set `--screen-accent` on `html`: every `.slide` resets it to the slide's accent, so a value set on `html` never reaches the mockup.

```html
<div
  class="device-phone"
  style="--screen-accent: #6c5cff; --screen-font: 'Inter', sans-serif"
>
  …
</div>
```

---

## 2. The mockup UI kit

Small classes for drawing an app screen. They use the `--screen-*` colors.

| Class                  | What it draws                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ui-page`              | A full-screen page: a column filling the `.screen`. Use one per app screen.                                  |
| `ui-status`            | Empty 54px strip at the top, clear of the phone's notch.                                                     |
| `ui-bar`               | Top app bar: bold title row. `ui-back` inside it is an accent-colored back arrow.                            |
| `ui-body`              | The scrollable-looking middle: a padded column that takes the remaining height.                              |
| `ui-title`, `ui-sub`   | Large bold heading; small grey caption.                                                                      |
| `ui-card`              | Rounded surface. `is-accent` makes it accent-colored with white text.                                        |
| `ui-list`, `ui-row`    | Grouped list with divided rows; `ui-end` inside a row pushes a value to the right.                           |
| `ui-btn`               | Accent button, 52px tall. `is-ghost` makes it an outline button.                                             |
| `ui-chips`, `ui-chip`  | Row of pill buttons. `is-current` fills the chosen one.                                                      |
| `ui-input`             | Text field, 52px tall, accent border when focused.                                                           |
| `ui-tabs`, `ui-tab`    | Bottom tab bar. Put an icon (`data-icon`) and a label in each tab. `is-current` colors the active one.       |
| `ui-fab`               | Floating round-cornered action button, bottom right.                                                         |
| `ui-sheet`, `ui-scrim` | Bottom sheet with a shadow; dark overlay behind it.                                                          |
| `ui-toast`             | Dark message bar near the bottom.                                                                            |
| `ui-side`, `ui-nav`    | Desktop sidebar and its items (`is-current` highlights one). Put `ui-side` beside the content in a flex row. |

`is-current` on chips, tabs and nav items is set automatically when they carry `data-set` or `data-toggle` (see section 6), so the chosen item lights up by itself.

`ui-row` is styled for a `<div>`. For a clickable row, use a `<button class="ui-row">` (keyboard friendly) and reset the button look in the deck's style:

```css
.screen button.ui-row {
  width: 100%;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
```

check.mjs allows text down to 13px inside `.screen` (20px elsewhere), and doesn't count mockup text toward a slide's word count.

---

## 3. Screenshots with hotspots

To demo an existing app, use real screenshots as screens and lay clickable areas over them. Without the app's code, `scripts/reference.mjs` gets the screens from screenshots, a screen recording or the live web app, with a grid (or, for a web page, exact boxes) to place the hotspots by; `check.mjs --hotspots` shows where each one landed (SKILL.md, section 9).

| Class          | What it does                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shot`         | An `<img>` that fills its screen, cropped from the top.                                                                                                                           |
| `hotspot`      | An invisible clickable area. Place it with `--x`, `--y`, `--w`, `--h` (percentages of the screen; `--r` sets the corner radius). It shows an outline on hover and keyboard focus. |
| `hotspot hint` | Adds a pulsing ring to show the audience where to click.                                                                                                                          |
| `pin`          | A numbered accent marker placed at `--x`, `--y`, for calling out parts of a screen.                                                                                               |

```html
<div class="device-browser" data-interactive data-state="page:dashboard">
  <div class="bar"><span class="url">app.example.com</span></div>
  <div class="screen">
    <div data-when="page:dashboard">
      <img class="shot" src="assets/dashboard.png" alt="Dashboard" />
      <button
        class="hotspot hint"
        data-set="page:reports"
        aria-label="Open reports"
        style="--x: 2%; --y: 30%; --w: 14%; --h: 6%"
      ></button>
      <span class="pin" style="--x: 60%; --y: 40%">1</span>
    </div>
    <div data-when="page:reports">
      <img class="shot" src="assets/reports.png" alt="Reports" />
      <button
        class="hotspot"
        data-set="page:dashboard"
        data-back
        aria-label="Back to the dashboard"
        style="--x: 2%; --y: 22%; --w: 14%; --h: 6%"
      ></button>
    </div>
  </div>
</div>
```

---

## 4. State: data-interactive and data-state

| Attribute          | Values                                 | What it does                                                                                              |
| ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `data-interactive` | no value                               | Makes the element a state box. Usually the device frame. Clicks and swipes inside it never change slides. |
| `data-state`       | `key:value` pairs, separated by spaces | The state the box opens in. A bare `key` means `key:on`.                                                  |

```html
<div class="device-phone" data-interactive data-state="screen:home tab:feed">
  …
</div>
```

The engine keeps `data-state` up to date as the state changes. It also writes one attribute per key, `data-s-<key>="<value>"` (here `data-s-screen="home"`), so CSS can react to the state:

```css
.device-phone[data-s-theme="dark"] .screen {
  --screen-bg: #111;
  --screen-ink: #eee;
}
```

**Which box an element belongs to.** A `[data-when]`, `[data-set]` or `[data-toggle]` element belongs to the nearest `[data-interactive]` that contains it. Boxes can be nested; each keeps its own state. An element outside any box belongs to its slide: a `section.slide` can carry `data-state` itself, and buttons anywhere on the slide can change it. That is useful for tabs on an ordinary slide.

---

## 5. Showing parts: data-when

`data-when="condition"` shows the element only while the condition holds. Hidden elements get the class `is-off` (`display: none`).

| Condition                    | Holds when                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `screen:home`                | `screen` is `home`.                                                               |
| `menu`                       | `menu` is `on` (same as `menu:on`).                                               |
| `time:off`                   | `time` has never been set, or is `off`. A key that was never set counts as `off`. |
| `!menu`                      | `menu` is not `on`. `!screen:home` means screen is not `home`.                    |
| `screen:list tab:stats`      | Both hold (a space means and).                                                    |
| `screen:list, screen:search` | Either holds (a comma means or).                                                  |

`!time` is true while `time` is `7pm`, because a bare key means `on`. To test that nothing has been chosen yet, use `time:off`.

Panels that are direct children of `.screen` fill the screen, so one `data-when` panel per app screen works without extra CSS. Smaller parts (a word, a badge, a button) can use `data-when` anywhere:

```html
<span data-when="time:6pm">6:00</span><span data-when="time:7pm">7:00</span
><span data-when="time:off">a time to be confirmed</span>
```

When a panel appears, counters (`data-count`), typed text (`data-anim="type"`) and tours inside it start.

---

## 6. Changing state: data-set and data-toggle

| Attribute     | Values                                        | What it does on click                                                                                     |
| ------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `data-set`    | `key:value` pairs, separated by spaces        | Sets those keys and leaves the others alone. A bare `key` sets it to `on`.                                |
| `data-toggle` | key names, separated by spaces                | Flips each key between `on` and `off`.                                                                    |
| `data-back`   | no value, next to `data-set` or `data-toggle` | With `data-transition="push"` on the box, the new screen slides in from the left, as a back button would. |

```html
<button class="ui-fab" data-set="screen:add" aria-label="Add">
  <span data-icon="LuPlus"></span>
</button>
<button class="ui-row" data-set="screen:detail item:3">Order #3</button>
<button class="ui-btn is-ghost" data-toggle="menu">Menu</button>

<nav class="ui-tabs">
  <button class="ui-tab" data-set="tab:home">
    <span data-icon="LuHouse"></span>Home
  </button>
  <button class="ui-tab" data-set="tab:stats">
    <span data-icon="LuChartPie"></span>Stats
  </button>
</nav>
```

After every change, each `data-set` element whose pairs all hold gets the class `is-current` and `aria-pressed="true"`. Each `data-toggle` element gets them while all its keys are `on`. So tabs, chips and nav items highlight themselves.

Any element can carry `data-set` or `data-toggle`, and gets a pointer cursor. Use `<button>` when you can: a focused button responds to Enter and Space, while a `<div>` with `data-set` responds only to clicks.

---

## 7. Screen transitions

| On the box               | Effect when panels change                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-transition="push"` | The new panel slides in from the right (from the left with `data-back`); the old one slides a little the other way and fades. 0.46s.                                             |
| `data-transition="fade"` | Cross-fade, 0.36s.                                                                                                                                                               |
| `data-transition="rise"` | The new panel slides up from the bottom (a sheet or modal); the old one fades. 0.46s.                                                                                            |
| `data-transition="zoom"` | The new panel zooms in; the old one fades. 0.42s.                                                                                                                                |
| no `data-transition`     | The whole change runs as a 0.4s View Transition cross-fade, where the browser supports it. Elements with the same `data-morph` name in the old and new state glide between them. |

These four names are the only panel animations defined. A box's `data-transition` affects its own panels only, not how the slide is entered. The reverse is not true for slide-level state (section 4): a slide that holds state uses its own `data-transition` for its panels as well. `fade`, `zoom` and `rise` animate them; `slide`, `panels` and the other slide transitions have no panel animation, and any `data-transition` on the slide turns off the cross-fade. Changes are instant in `?static` and at `none` motion.

```html
<div
  class="device-phone"
  data-interactive
  data-state="screen:home"
  data-transition="push"
>
  …
</div>
```

---

## 8. Typed text: data-input and data-text

Typing into `<input data-input="name">` copies the text into every `[data-text="name"]` element in the same box. When the input is empty, those elements show their `data-empty` text.

```html
<input
  class="ui-input"
  data-input="guest"
  placeholder="Name for the booking"
  aria-label="Name"
/>
<button class="ui-btn" data-set="booked" data-submit>
  Book for <span data-text="guest" data-empty="me">me</span>
</button>
```

Deck keys are ignored while the cursor is in the input, so typing never changes slides. Enter in the input presses the box's `data-submit` element, as a real form would (no `data-submit`, no effect). Resetting the box (`data-reset`, or a tour starting) empties its inputs and puts their `data-text` back to `data-empty`.

---

## 9. Resetting: data-reset

`data-reset` on a `[data-interactive]` box returns it to its opening `data-state` every time its slide is entered, so the demo starts fresh on each visit. Without it, a box keeps its state when you leave and come back. A slide's own state isn't reset this way. A tour always resets its box before it starts.

---

## 10. Jumping to slides: data-goto

`data-goto` turns any element into a link to another slide. It works anywhere on a slide, including inside a mockup.

| Value                        | Goes to                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| an id, `data-goto="pricing"` | The slide with that id.                                           |
| a number, `data-goto="5"`    | Slide 5 in file order (hidden slides counted).                    |
| `next` / `prev`              | The next or previous visible slide, skipping any remaining steps. |

Jumping to a hidden slide remembers where you came from, so ← returns there.

```html
<ol class="agenda">
  <li><a data-goto="problem">Why budgets fail</a></li>
  <li><a data-goto="demo">The app, live</a></li>
</ol>
<button class="ui-btn" data-goto="appendix-security">
  How is my data kept safe?
</button>
```

---

## 11. Tours

A tour clicks through a demo by itself, with a visible mouse cursor, when the slide appears. The presenter can talk while it plays.

| Attribute (on the box) | Values                                                     | What it does                                                                     |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `data-tour`            | steps separated by commas; each step is a `data-set` value | The states to click through, in order: `"screen:add, cat:coffee, screen:saved"`. |
| `data-tour-delay`      | ms                                                         | Wait before the first step. Default 900.                                         |
| `data-tour-interval`   | ms                                                         | Time between steps. Default 1700.                                                |
| `data-tour-loop`       | no value                                                   | Start again 1.2s after the last step.                                            |

How a tour plays:

1. When the slide appears, or when the box's build step appears, the box is reset to its opening `data-state`.
2. The cursor fades in 400ms before the first step.
3. For each step, the cursor glides to the visible `[data-set]` element in the box whose value matches the step (the same pairs, in any order), and clicks it 700ms later. If no element matches, the state is set at once without moving the cursor. That way a tour can reach states that have no button.
4. One interval after the last step started, plus 200ms, the cursor fades out. With `data-tour-loop`, the tour starts over 1.2s later, from a reset.

A real click on a `data-set` or `data-toggle` element in the box stops the tour and hides the cursor; clicks elsewhere in the box don't. Leaving the slide stops it too. It plays again on the next visit. Only `data-set` buttons can be tour targets; a tour step can't toggle.

In `?static`, at `none` motion, and therefore in check.mjs screenshots and the PowerPoint export, every step is applied at once and the box shows the state after the last step.

---

## 12. Clicks, keys and swipes inside a demo

- Clicks inside a `[data-interactive]` box never change slides. Neither do clicks on links, buttons, inputs, selects, textareas, labels, `summary`, video, audio, iframes, `[contenteditable]`, `[data-set]`, `[data-toggle]` or anything inside `.no-advance`. A click anywhere else on the slide advances.
- A mockup built with Alpine.js or another library, with no `data-set` of its own, still needs `data-interactive` (or `class="no-advance"`) on its frame. Otherwise a click on a card or a row advances the slide.
- Horizontal swipes inside a `[data-interactive]` box don't change slides, so a Swiper carousel or a drag inside the mockup is safe.
- While the cursor is in an input, textarea, select or editable element, deck keys are ignored; Esc still closes a panel.
- A button you clicked keeps keyboard focus. Space and Enter then press that button again instead of advancing. Use →, ↓ or PageDown (what clickers send) to move on.
- With the pen on (D), clicks draw instead of reaching the mockup. Press D or Esc to turn it off.

---

## 13. Complete example: a two-screen phone demo

A restaurant booking app with two screens (a list and a detail page), push transitions with a working back button, time chips that highlight themselves, a name field echoed into the button and the confirmation, and a tour that plays the booking when the slide appears. This example has been run through check.mjs.

```html
<!-- in the deck's <style> -->
<style>
  .screen button.ui-row {
    width: 100%;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
</style>

<section class="slide layout-demo" id="booking">
  <div class="col">
    <p class="kicker">Live demo</p>
    <h2>Book a table in three taps</h2>
    <p class="lead">Click the phone, or let it play.</p>
  </div>

  <div
    class="device-phone"
    data-interactive
    data-state="screen:list"
    data-transition="push"
    data-reset
    data-tour="screen:detail, time:7pm, booked"
    data-tour-delay="1200"
  >
    <div class="screen">
      <!-- Screen 1: the list -->
      <div class="ui-page" data-when="screen:list">
        <div class="ui-status"></div>
        <div class="ui-bar">Tonight near you</div>
        <div class="ui-body">
          <div class="ui-list">
            <button class="ui-row" data-set="screen:detail">
              <span data-icon="LuUtensils"></span>Luca's Trattoria<span
                class="ui-end"
                >4.8</span
              >
            </button>
            <div class="ui-row">
              <span data-icon="LuFish"></span>Harbor Oyster Bar<span
                class="ui-end"
                >4.6</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Screen 2: the detail page -->
      <div class="ui-page" data-when="screen:detail">
        <div class="ui-status"></div>
        <div class="ui-bar">
          <button
            class="ui-back"
            data-set="screen:list"
            data-back
            aria-label="Back"
            style="border: 0; background: none"
          >
            ‹
          </button>
          Luca's Trattoria
        </div>
        <div class="ui-body">
          <div class="ui-sub">Pick a time</div>
          <div class="ui-chips">
            <button class="ui-chip" data-set="time:6pm">6:00</button>
            <button class="ui-chip" data-set="time:7pm">7:00</button>
            <button class="ui-chip" data-set="time:8pm">8:00</button>
          </div>
          <input
            class="ui-input"
            data-input="guest"
            placeholder="Name for the booking"
            aria-label="Name"
          />
          <button class="ui-btn" data-set="booked" data-when="!booked">
            Book for <span data-text="guest" data-empty="me">me</span>
          </button>
          <div class="ui-card is-accent" data-when="booked">
            Booked for <span data-text="guest" data-empty="me">me</span> at
            <span data-when="time:6pm">6:00</span
            ><span data-when="time:7pm">7:00</span
            ><span data-when="time:8pm">8:00</span
            ><span data-when="time:off">a time to be confirmed</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <aside class="notes">
    The phone books a table by itself. Click any button on it to take over.
  </aside>
</section>
```

What happens:

- The slide opens on the list (`data-state="screen:list"`). Because of `data-reset`, it opens there on every visit.
- 1.2s in, the cursor taps the first row: `screen:detail` pushes the detail page in from the right. Then it taps 7:00, which lights up because its `data-set` now holds. Then it taps Book, which sets `booked:on`: the button hides (`!booked`) and the confirmation appears.
- Clicking any button on the phone stops the tour, and the presenter drives from there. The back arrow (`data-back`) slides the list back in from the left.
- Typing a name changes "Book for me" and the confirmation as you type.
- Icons named in `data-icon` are picked up by scripts/icons.mjs when check.mjs or bundle.mjs runs.

To show this demo in a slide's build sequence, add `data-step` to the phone. It then appears on a click, and the tour starts at that moment.

---

## 14. How demos look in checks, PDF and PowerPoint

| Output                               | State shown                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Presenting                           | Live: clickable, with transitions and tours.                                                    |
| check.mjs `slide-NN.png` (`?static`) | The opening `data-state`; for a box with a tour, the state after the last step.                 |
| check.mjs `sheet.png` (`?sheet`)     | The opening `data-state` (slides aren't entered there, so tours don't run).                     |
| PDF (`check.mjs --pdf`, `?print`)    | The opening `data-state`.                                                                       |
| PowerPoint (export-pptx.mjs)         | A picture of the mockup, as in `?static`: for a box with a tour, the state after the last step. |
| Overview and presenter view          | A still copy of the mockup in its current state; not clickable.                                 |

If a still output should show a particular screen, make that the opening `data-state`, or order the tour so its last step is the screen to keep.

---

## 15. Attributes the engine uses internally

The engine writes these itself, or uses them on its own controls. Don't put them in slides: they do nothing there, or they get overwritten.

| Attribute                                | Where the engine uses it                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `data-ctl`                               | Buttons in the on-screen control bar. Its click handler only listens inside that bar. |
| `data-pv`, `data-pv-screen`              | Buttons and the Now and Next previews in the presenter window.                        |
| `data-ed`                                | Buttons in the data editor (E).                                                       |
| `data-s-<key>`                           | Written on each box from its state. Read them in CSS; don't set them.                 |
| `data-pt`                                | Panel transition currently running (`push`, `fade`…).                                 |
| `data-mounted`                           | Elements that `deck.mount` has started.                                               |
| `data-cascade`, `data-anim-children`     | Set while preparing cascade and `data-stagger`/`data-steps` containers.               |
| `data-vt`, `data-vt-dir`, `data-mg-hold` | On `<html>` during slide and state transitions.                                       |
