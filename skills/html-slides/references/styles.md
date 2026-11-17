# Styles: themes, brands and tokens

How a deck gets its look: the eight built-in themes (style presets), how to pick and set one, how to apply a brand, and every design token you can override. Layout markup is in `layouts.md`; motion is in `motion.md`.

## Contents

- [Pick a theme from what the user says](#pick-a-theme-from-what-the-user-says)
- [The eight themes](#the-eight-themes)
- [Setting the theme](#setting-the-theme)
- [Brand overrides with new-deck.mjs --brand](#brand-overrides-with-new-deckmjs---brand)
- [Customizing tokens in a style block](#customizing-tokens-in-a-style-block)
- [Token reference](#token-reference)
- [Light and dark](#light-and-dark)
- [Chart color palettes](#chart-color-palettes)
- [Fonts](#fonts)
- [Worked examples](#worked-examples)

---

## Pick a theme from what the user says

| The user says                                                                                     | Theme                                                        | Starting settings                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| "Clean business template", "quarterly review", "client report", "consulting deck", "board update" | `corporate`                                                  | `--motion subtle` or `moderate`; deck `data-transition="fade"`; set `data-footer` (footer and slide numbers show) |
| "Minimal", "Swiss", "design studio", "architecture", "strategy, no fluff"                         | `minimal`                                                    | `--motion moderate`; `data-transition="auto"`                                                                     |
| "Apple keynote", "dark", "product launch", "vision talk", "conference talk", "dramatic"           | `keynote`                                                    | `--motion heavy`; `data-transition="auto"`; `data-enter="cascade"`                                                |
| "Startup pitch", "investors", "demo day", "sales deck", "bold and punchy"                         | `pitch`                                                      | `--motion moderate` or `heavy`; `data-transition="auto"`                                                          |
| "Magazine", "storytelling", "editorial", "research findings", "annual report"                     | `editorial`                                                  | `--motion moderate`; `data-transition="auto"`                                                                     |
| "Lecture", "class", "training", "research talk", "thesis defense", "university template"          | `academic`                                                   | `--motion subtle`; `data-transition="fade"`; set `data-footer`                                                    |
| "Fun", "workshop", "kids", "school", "community event", "team celebration"                        | `playful`                                                    | `--motion heavy`; `data-transition="auto"`                                                                        |
| "Luxury", "premium", "gala", "wedding", "wine", "fashion", "art and culture"                      | `elegant`                                                    | `--motion moderate`; `data-transition="auto"`                                                                     |
| "Our brand is navy and orange" (any brand colors)                                                 | The theme whose _shape_ fits the occasion, plus brand tokens | See [Worked examples](#worked-examples)                                                                           |
| "Dark mode"                                                                                       | `keynote` (modern) or `elegant` (refined)                    | Or override a light theme's colors, see [Light and dark](#light-and-dark)                                         |

Pick the theme for its shape, type and personality first; colors are the easiest thing to change.

---

## The eight themes

Quick comparison:

| Theme       | Name shown by T | Background                 | Headings / body font                  | Accent, second color                          | Corners                     | Feel                       |
| ----------- | --------------- | -------------------------- | ------------------------------------- | --------------------------------------------- | --------------------------- | -------------------------- |
| `corporate` | Corporate       | White                      | Plus Jakarta Sans 800 / Source Sans 3 | Royal blue `#1f4fd8`, teal `#0e9f8f`          | 10px, soft shadow           | Clean, structured business |
| `minimal`   | Minimal         | Off-white paper `#f6f5f1`  | Archivo 800 / Archivo                 | Red `#e8361c`, black                          | Square, no shadow           | Swiss grid, hairlines      |
| `keynote`   | Bold keynote    | Near-black `#07070b`       | Sora 700 / DM Sans                    | Violet `#8b7cff`, cyan `#2ee6d6`              | 18px, deep shadow           | Dark, glowing, big type    |
| `pitch`     | Startup pitch   | Warm cream `#fffaf3`       | Bricolage Grotesque 800 / DM Sans     | Red-orange `#ff4d2e`, electric blue `#3a3dff` | 18px                        | Warm, punchy, color blocks |
| `editorial` | Editorial       | Warm paper `#f3eee4`       | Fraunces 600 / Newsreader (serif)     | Brick red `#b23a1e`, forest green `#2f5d50`   | 2px, no shadow              | Magazine serif             |
| `academic`  | Academic        | Off-white `#fbfaf6`        | Libre Franklin 700 / Literata (serif) | Navy `#123f7a`, crimson `#9e1b32`             | 6px, faint shadow           | Quiet, readable, numbered  |
| `playful`   | Playful         | Sunny cream `#fff4d9`      | Fredoka 600 / Nunito                  | Coral `#ff5b5b`, blue `#4361ee`               | 22px, hard "sticker" shadow | Rounded, bouncy, fun       |
| `elegant`   | Elegant         | Dark green-black `#0f1412` | Cormorant Garamond 500 / Jost         | Gold `#c9a45c`, sage `#8fae9a`                | Square, thin gold lines     | Luxury, refined serif      |

Each theme's motion-graphic signature is what `data-transition="auto"` uses (details in `motion.md`):

| Theme     | Title, section, closing (`--mg-signature`) | Statement, quote (`--mg-reveal`) | Other slides (`--mg-content`) | Sweep colors `--mg-1` / `--mg-2` / `--mg-3` |
| --------- | ------------------------------------------ | -------------------------------- | ----------------------------- | ------------------------------------------- |
| corporate | `stripes`                                  | `wipe`                           | `slide`                       | blue / teal / navy ink                      |
| minimal   | `panels`                                   | `split`                          | `fade`                        | black / red / light gray                    |
| keynote   | `panels`                                   | `iris`                           | `slide`                       | violet / cyan / near-white                  |
| pitch     | `circle`                                   | `diagonal`                       | `slide`                       | red-orange / blue / near-black              |
| editorial | `shutter`                                  | `blinds`                         | `fade`                        | brick red / ink / ink                       |
| academic  | `wipe`                                     | `split`                          | `fade`                        | navy / crimson / ink                        |
| playful   | `tiles`                                    | `iris`                           | `rise`                        | coral / blue / brown ink                    |
| elegant   | `wave`                                     | `split`                          | `fade`                        | gold / sage / cream                         |

### corporate: the clean business template

The look of a well-made company template: white slides, navy text, one confident blue.

- **Palette:** white `#ffffff` with a pale blue-gray second background `#f3f6fb`; ink `#0e1a2b`, secondary `#4a5568`; blue accent `#1f4fd8`, teal `#0e9f8f`. Inverted slides are deep navy `#0f2242` with a light-blue accent `#7aa7ff`.
- **Type:** Plus Jakarta Sans at 800 with tight tracking for headings, Source Sans 3 for text.
- **Signature touches:** the title slide's right 30% is a blue-to-navy gradient panel with a dot grid (title text is limited to 1150px so it stays clear of it); a footer with the `data-footer` text and slide number sits at the bottom under a hairline.
- **Pick it for:** business reviews, reports, client updates, consulting and strategy decks, internal updates, anything that should look professional and safe.

### minimal: Swiss grid, one red accent

Typographic and strict: black on paper, one red, rules instead of boxes.

- **Palette:** paper `#f6f5f1`, second background `#ecebe5`; ink `#111111`; one red `#e8361c` (the second color is black). Inverted slides are black with a brighter red `#ff5a3c`.
- **Type:** Archivo throughout, 800 weight, very tight tracking (`-0.045em`) and leading (0.98).
- **Signature touches:** a 2px black rule across the top of every slide (except media slides), with the footer and slide number in bold uppercase above it; cards lose their box and become columns under a 2px rule; bullets are short bars; stat numbers are black with the first one (or `.is-key`) in red; no shadows, square corners.
- **Pick it for:** design and product reviews, strategy, architecture and studio portfolios, any audience that likes restraint.

### keynote: the dark Apple-keynote look

Dark stage, big bright type, glowing color.

- **Palette:** near-black `#07070b`, ink `#f4f4f8`, secondary `#a5a5b8`; violet `#8b7cff` and cyan `#2ee6d6`. Surfaces are translucent white. Inverted slides are light (`#f4f4f8`) with a deeper violet `#5b4cff`.
- **Type:** Sora 700 for headings (hero size raised to 140px), DM Sans for text.
- **Signature touches:** soft violet and cyan glows on every slide (not on media or inverted slides), which drift slowly at the heavy motion level; `<mark>` becomes violet-to-cyan gradient text; cards are frosted glass (background blur); stat numbers are white.
- **Pick it for:** product launches, vision and keynote talks, tech conference talks, demos, dark-mode requests.

### pitch: the startup pitch deck

Warm, confident and loud where it counts: big numbers and bold color.

- **Palette:** warm cream `#fffaf3`, second background `#fff1de`; ink `#17130f`; red-orange `#ff4d2e` and electric blue `#3a3dff`. Inverted slides are near-black with orange `#ff6a4d`.
- **Type:** Bricolage Grotesque 800 for headings, DM Sans for text.
- **Signature touches:** the title slide has a large accent circle in the bottom-right corner and a small blue circle (title text limited to 1200px); `<mark>` is a solid accent block with white text; stat numbers are ink with the first one (or `.is-key`) in the accent; cards are borderless with a warm shadow.
- **Pick it for:** fundraising decks, demo days, sales decks, startup all-hands, anything that needs energy.

### editorial: magazine serif on warm paper

A feature article on slides: serif type, rules, italics.

- **Palette:** warm paper `#f3eee4`, second background `#e9e2d4`; ink `#1d1a16`; brick red `#b23a1e` and forest green `#2f5d50`. Inverted slides are near-black with a terracotta accent `#e0714f`.
- **Type:** Fraunces 600 headings, Newsreader body at 34px; kickers are italic Newsreader, not uppercase; quotes use weight 400.
- **Signature touches:** a double rule (2px over 1px) across the top of every slide (except media) with an italic running footer under it; cards become columns under a 1px rule; `<mark>` turns italic; `.dropcap` gives a paragraph a large accent first letter; no shadows.
- **Pick it for:** storytelling, research findings, brand narratives, annual reports, journalism, long-form arguments.

### academic: readable, numbered, quiet

Made to be read from the back row and cited: clear sans headings, serif text, slide numbers.

- **Palette:** off-white `#fbfaf6`; ink `#1c2430`; navy `#123f7a` and crimson `#9e1b32`. Inverted slides are navy with a gold accent `#ffd27a`.
- **Type:** Libre Franklin 700 headings, Literata serif body at 30px.
- **Signature touches:** footer and slide number at the bottom on every content slide; each `.slide-head h2` has a 2px rule under it; kickers are crimson; `<mark>` is a pale yellow highlighter.
- **Pick it for:** lectures, training, conference research talks, thesis defenses, teaching material.

### playful: sunny, rounded, sticker shadows

Friendly and bouncy, like a well-designed workshop handout.

- **Palette:** sunny cream `#fff4d9`, second background `#ffe8b0`; brown-black ink `#2a1f14` (also used for lines); coral `#ff5b5b` and blue `#4361ee`, plus a fixed yellow `#ffd23f`. Inverted slides are dark brown with yellow `#ffd23f`.
- **Type:** Fredoka 600 headings, Nunito body.
- **Signature touches:** every slide (except media and inverted) has a blue blob in the top-right and a yellow blob in the bottom-left, which drift at the heavy motion level; cards have a 3px ink border, a hard 6px offset shadow and alternate slight tilts; bullets are bordered circles; icons get an ink border; `<mark>` is a yellow highlighter stroke.
- **Pick it for:** workshops, kids and school, community events, onboarding, hackathons, team celebrations.

### elegant: dark green and gold

Refined and quiet luxury: a thin frame, centered serif titles, gold.

- **Palette:** dark green-black `#0f1412`, ink cream `#f2ece0`; gold `#c9a45c` and sage `#8fae9a`; lines are translucent gold. Inverted slides are cream with a darker gold `#9a7a3a`.
- **Type:** Cormorant Garamond 500 headings at larger sizes (hero 150px, `h1` 108px, `h2` 80px, stats 150px), Jost body at 30px; kickers are widely letter-spaced (0.34em).
- **Signature touches:** a thin gold frame inset 36px on every slide (except media); title, section, statement, closing and quote slides are centered; bullets are small diamonds; `<mark>` is italic; square corners, no shadows.
- **Pick it for:** luxury and premium brands, galas and events, weddings, wine and hospitality, fashion, art and culture.

---

## Setting the theme

The theme lives on the `<html>` element (not on `main.deck`):

```html
<html lang="en" data-theme="pitch" data-motion="moderate"></html>
```

| Where            | How                                                                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New deck         | `node scripts/new-deck.mjs --title "..." --theme pitch` writes `data-theme` and the theme's Google Fonts link. Default theme: `corporate`.                                                                                                                                  |
| Existing deck    | Change `data-theme` on `<html>` **and** the Google Fonts `<link ... data-theme-fonts="...">` in `<head>` (copy the new theme's query from `THEME_FONTS` in `engine/deck.js`). Without the new link, the theme falls back to system fonts, in the browser and in the bundle. |
| While presenting | **T** goes to the next theme, **Shift+T** to the previous one, in this order: corporate, minimal, keynote, pitch, editorial, academic, playful, elegant. The engine loads the theme's fonts on the fly (needs internet). Nothing is saved to the file.                      |
| From the URL     | `deck.html?theme=keynote` opens with that theme.                                                                                                                                                                                                                            |
| In a check       | `node scripts/check.mjs <deck> --theme keynote` screenshots the deck in another theme without editing it.                                                                                                                                                                   |

Brand overrides written as `html[data-theme] { ... }` stay on when you press T, so T is a quick way to try different theme shapes with the same brand colors.

---

## Brand overrides with new-deck.mjs --brand

`--brand brand.json` writes a brand block into the deck's `<style>`:

```json
{
  "accent": "#F26B21",
  "accent2": "#1B2A4A",
  "ink": "#1B2A4A",
  "fontHead": "Montserrat",
  "fontBody": "Open Sans",
  "charts": ["#1B2A4A", "#F26B21", "#5B7DB1", "#F5A623", "#2BA59A", "#9AA5B8"]
}
```

```html
<style>
  html[data-theme] {
    --accent: #F26B21;
    --accent-2: #1B2A4A;
    --ink: #1B2A4A;
    --chart-1: #1B2A4A;
    ...
    --font-head: "Montserrat", system-ui, sans-serif;
    --font-body: "Open Sans", system-ui, sans-serif;
  }
</style>
```

| Key        | Sets                        | What it changes on the slides                                                                                                                          |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `accent`   | `--accent`                  | Kickers, bullets, stat numbers, links, `<mark>`, progress bar, icons, `.callout`, `.card.is-accent`, `.on-accent` slides; sweep color 1 in most themes |
| `accent2`  | `--accent-2`                | Second color: sweep color 2, academic's kickers, pitch's small title circle, keynote's second glow and `<mark>` gradient, playful's blue blob          |
| `bg`       | `--bg`                      | Slide background and the letterbox around the slide                                                                                                    |
| `ink`      | `--ink`                     | Headings and main text                                                                                                                                 |
| `charts`   | `--chart-1` ... `--chart-6` | Chart series colors, in order (first 6 used)                                                                                                           |
| `fontHead` | `--font-head`               | Headings, stat numbers, agenda, quotes                                                                                                                 |
| `fontBody` | `--font-body`               | Everything else                                                                                                                                        |

Rules the script follows:

- Colors must be 6-digit hex (`#1b2a4a` or `1b2a4a`); anything else (3-digit hex, `rgb()`, names) is skipped without a warning.
- Fonts are written as `"Name", system-ui, sans-serif`. Fonts that ship with Office (Calibri, Arial, Segoe UI, Aptos, Georgia, Times New Roman, Helvetica, Garamond, Consolas and similar) are not downloaded; any other name gets a Google Fonts link for weights 400 and 700 only.
- A file shaped `{"brand": {...}}` also works.
- `scripts/reference.mjs` writes a `brand.json` from a PowerPoint file: theme colors accent1 and accent2, background and text from the master (dark or light), the heading and body fonts, and accent1 to accent6 as chart colors.

What `--brand` does **not** change, and when to finish it by hand in the `<style>` block:

| Token                                                                   | Still the theme's                           | Set it when                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--accent-ink`                                                          | Text on accent fills (white in most themes) | The brand accent is light (yellow, orange, lime): use a dark ink so `.callout`, `.card.is-accent` and `.on-accent` stay readable |
| `--inv-bg`, `--inv-accent`, `--inv-ink*`, `--inv-surface`, `--inv-line` | The theme's inverted colors                 | You use `.invert` slides: make them the brand's dark color                                                                       |
| `--bg-2`, `--surface`, `--surface-2`, `--ink-2`, `--ink-3`, `--line`    | The theme's                                 | You changed `bg` or `ink` a lot (especially light to dark)                                                                       |
| `--mg-3`                                                                | Usually `--ink`                             | The `panels` sweep uses it                                                                                                       |

Some theme decorations use fixed colors that no token changes: corporate's title panel gradient (`#1f4fd8` to `#0f2242`), playful's yellow blob and highlighter (`#ffd23f`), academic's highlighter (`#ffd27a`), keynote's third sweep color (`#f4f4f8`). Override the rule itself when the brand clashes:

```css
[data-theme="corporate"] .layout-title::before {
  background:
    radial-gradient(
        circle at 1px 1px,
        rgba(255, 255, 255, 0.22) 1.5px,
        transparent 0
      )
      0 0 / 28px 28px,
    linear-gradient(160deg, var(--accent), var(--inv-bg) 70%);
}
```

Do not confuse the `--brand` flag with the `--brand` CSS token: the token is derived (it holds the deck's accent for `.on-accent` blocks) and you never set it.

---

## Customizing tokens in a style block

Override tokens in the deck's own `<style>` in `<head>` (after the engine stylesheets). Three scopes:

```css
/* Whole deck, whatever theme is active (survives T) */
html[data-theme] {
  --accent: #0a7cff;
  --fs-body: 34px;
}

/* Only while one theme is active */
html[data-theme="corporate"] {
  --radius: 4px;
  --radius-lg: 8px;
}

/* One slide or block: a class, or an inline style */
.slide.warm {
  --accent: #e8590c;
}
```

```html
<section class="slide warm">...</section>
<section class="slide" style="--chart-1: #e8590c">...</section>
```

`html[data-theme]` beats the theme's own `[data-theme="..."]` rules whatever the order, so brand blocks always win.

Per-slide overrides change what that slide draws, with two exceptions computed once for the whole deck: the sweep colors `--mg-1` to `--mg-3` (set them on the slide directly to recolor its sweep) and the `--brand` token used by `.on-accent`.

---

## Token reference

Defaults are from `engine/deck.css`; each theme overrides most of the color, font and shape tokens.

### Colors

| Token                                                                                                   | Default                             | Used for                                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--bg`                                                                                                  | `#ffffff`                           | Slide background                                                                                                                    |
| `--bg-2`                                                                                                | `#f4f4f5`                           | A second background tone for your own use (alternate slides, panels); the engine itself only uses it as minimal's third sweep color |
| `--surface`                                                                                             | `#ffffff`                           | Cards                                                                                                                               |
| `--surface-2`                                                                                           | `#f1f1f3`                           | `.definition`, meter track, browser bar                                                                                             |
| `--ink`                                                                                                 | `#111114`                           | Headings and main text                                                                                                              |
| `--ink-2`                                                                                               | `#55555c`                           | Secondary text: lead, labels, card text                                                                                             |
| `--ink-3`                                                                                               | `#8b8b93`                           | Tertiary text: footer, source lines, ticks                                                                                          |
| `--line`                                                                                                | `rgba(0,0,0,.12)`                   | Rules, borders, table lines                                                                                                         |
| `--accent`                                                                                              | `#2563eb`                           | Main highlight color                                                                                                                |
| `--accent-2`                                                                                            | `#0ea5e9`                           | Second color                                                                                                                        |
| `--accent-ink`                                                                                          | `#ffffff`                           | Text on accent fills                                                                                                                |
| `--accent-soft`                                                                                         | 14% accent                          | Derived: tinted icon tiles, pills, avatars, `.callout.soft`                                                                         |
| `--head-ink`                                                                                            | `--ink`                             | Heading color (set it to color headings only)                                                                                       |
| `--stat-ink`                                                                                            | `--accent`                          | Stat number color                                                                                                                   |
| `--backdrop`                                                                                            | `--bg`                              | The letterbox around the slide when the window is not 16:9                                                                          |
| `--inv-bg`, `--inv-ink`, `--inv-ink-2`, `--inv-ink-3`, `--inv-surface`, `--inv-line`, `--inv-accent`    | dark set                            | `.invert` blocks (`--inv-ink-3` falls back to `--inv-ink-2`)                                                                        |
| `--chart-1` ... `--chart-6`                                                                             | blue, sky, amber, green, red, slate | Chart series                                                                                                                        |
| `--mg-1`, `--mg-2`, `--mg-3`                                                                            | `--accent`, `--accent-2`, `--ink`   | Sweep transition colors                                                                                                             |
| `--code-bg`, `--code-ink`                                                                               | `#0e1116`, `#e6edf3`                | `.code` blocks                                                                                                                      |
| `--screen-bg`, `--screen-ink`, `--screen-ink-2`, `--screen-line`, `--screen-surface`, `--screen-accent` | white app colors; accent            | App mockups inside `.screen` (set `--screen-accent` to the app's own brand color)                                                   |
| `--annot-color`                                                                                         | `--accent`                          | `data-annotate` marks                                                                                                               |

### Type

| Token             | Default                                               | Used for                                                |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `--font-head`     | system-ui                                             | Headings, stat numbers, agenda, section numbers, quotes |
| `--font-body`     | system-ui                                             | All other text                                          |
| `--font-mono`     | ui-monospace, Cascadia Code, SF Mono, Menlo, Consolas | `.code`                                                 |
| `--font-kicker`   | `--font-body`                                         | Kickers                                                 |
| `--font-quote`    | `--font-head`                                         | `.quote`                                                |
| `--screen-font`   | `--font-body`                                         | App mockups                                             |
| `--head-weight`   | 700                                                   | Heading weight                                          |
| `--head-tracking` | `-0.02em`                                             | Heading letter-spacing                                  |
| `--head-leading`  | 1.04                                                  | Heading line height                                     |
| `--head-case`     | `none`                                                | `uppercase` for all-caps headings                       |
| `--head-style`    | `normal`                                              | `italic` for italic headings                            |
| `--body-leading`  | 1.4                                                   | Text line height                                        |
| `--quote-weight`  | 500                                                   | `.quote` weight                                         |

### Type scale (canvas pixels)

| Token         | Default | Element                                  |
| ------------- | ------- | ---------------------------------------- |
| `--fs-hero`   | 128px   | Title `h1`, closing `h2`                 |
| `--fs-h1`     | 96px    | `h1`, section `h2`                       |
| `--fs-h2`     | 68px    | `h2`                                     |
| `--fs-h3`     | 40px    | `h3`                                     |
| `--fs-lead`   | 40px    | `.lead`, `.callout`, `.takeaway`, `.big` |
| `--fs-body`   | 32px    | Body text and bullets                    |
| `--fs-small`  | 24px    | `.small`, byline, captions, cite         |
| `--fs-kicker` | 22px    | `.kicker`                                |
| `--fs-stat`   | 136px   | `.stat-value`                            |

Theme changes: keynote hero 140px; editorial body 34px; academic body 30px; elegant hero 150, h1 108, h2 80, h3 46, body 30, stat 150.

### Spacing and shape

| Token             | Default        | Used for                            |
| ----------------- | -------------- | ----------------------------------- |
| `--pad-x`         | 120px          | Slide side padding                  |
| `--pad-y`         | 96px           | Slide top and bottom padding        |
| `--gap`           | 48px           | Space between blocks on a slide     |
| `--radius`        | 14px           | Small corners (code, definition)    |
| `--radius-lg`     | 24px           | Cards, callouts, pictures           |
| `--icon-radius`   | 20px           | Icon tiles (`50%` makes them round) |
| `--bullet-radius` | 50%            | Bullet marker shape (`0` square)    |
| `--shadow`        | soft two-layer | Cards                               |
| `--card-border`   | 1px line       | Cards (`0` for none)                |

Keep `--pad-x` at 96px or more and `--pad-y` at 72px or more; text closer to the edge looks cramped when projected.

---

## Light and dark

| Light themes                                            | Dark themes                                      |
| ------------------------------------------------------- | ------------------------------------------------ |
| corporate, minimal, pitch, editorial, academic, playful | keynote, elegant (both set `color-scheme: dark`) |

- `.invert` on a slide or block flips to the theme's opposite palette: navy, black or dark brown in the light themes, light in keynote and elegant (see `layouts.md`).
- For a dark deck, start from keynote (modern) or elegant (refined).
- To make a light theme dark, override the whole color set, not just `--bg` and `--ink`; otherwise cards, secondary text and lines stay light-theme colors:

```css
html[data-theme] {
  color-scheme: dark;
  --bg: #0b1220;
  --bg-2: #111a2e;
  --surface: #131d33;
  --surface-2: #1a2640;
  --ink: #f1f5fb;
  --ink-2: #a9b4c7;
  --ink-3: #6f7c93;
  --line: rgba(255, 255, 255, 0.12);
  --accent: #5b8cff;
  --accent-ink: #0b1220;
  --inv-bg: #f1f5fb;
  --inv-ink: #0b1220;
  --inv-ink-2: #4a5568;
  --inv-surface: #ffffff;
  --inv-line: rgba(0, 0, 0, 0.1);
  --inv-accent: #1f4fd8;
  --shadow: none;
}
```

Check contrast whichever way you go: accent text (kickers, stat numbers) must stand out from `--bg`, and `--accent-ink` must be readable on `--accent`.

---

## Chart color palettes

Charts (`data-chart`) color series 1 to 6 with `--chart-1` to `--chart-6` and then repeat. Library widgets get the same colors from `ctx.colors()`.

| Theme     | 1                    | 2                 | 3                | 4                    | 5                   | 6                     |
| --------- | -------------------- | ----------------- | ---------------- | -------------------- | ------------------- | --------------------- |
| corporate | `#1f4fd8` blue       | `#0e9f8f` teal    | `#f2a93b` amber  | `#7c5cdb` violet     | `#e5484d` red       | `#8592a6` gray        |
| minimal   | `#111111` black      | `#e8361c` red     | `#8c8c85` gray   | `#c9c7bf` light gray | `#4a4a46` dark gray | `#ff9b85` salmon      |
| keynote   | `#8b7cff` violet     | `#2ee6d6` cyan    | `#ff7ab6` pink   | `#ffd166` yellow     | `#5aa9ff` blue      | `#a5a5b8` gray        |
| pitch     | `#ff4d2e` red-orange | `#3a3dff` blue    | `#ffb800` yellow | `#00b37e` green      | `#17130f` black     | `#c9bfb3` sand        |
| editorial | `#b23a1e` brick      | `#2f5d50` green   | `#c99a3b` ochre  | `#1d1a16` ink        | `#7a8b99` slate     | `#bdb3a3` sand        |
| academic  | `#123f7a` navy       | `#9e1b32` crimson | `#d08c2c` ochre  | `#2e7d5b` green      | `#6b7a8f` slate     | `#b8c2cf` light slate |
| playful   | `#ff5b5b` coral      | `#4361ee` blue    | `#ffb703` amber  | `#2ec4b6` teal       | `#9b5de5` purple    | `#2a1f14` ink         |
| elegant   | `#c9a45c` gold       | `#8fae9a` sage    | `#e8dcc2` cream  | `#6f8f7f` green      | `#a07f4a` bronze    | `#5c6b64` slate       |

Guidance:

- Series 1 should be the brand's main color; series 2 its strongest contrast. Order matters because most charts use only the first two or three.
- To stress one bar, slice or point, use `data-highlight` (the others fade) rather than a special color.
- One series can take its own color in `data-series` (`"color": "#e8590c"`).
- With brand colors, give all six: `"charts"` in `brand.json`, or `--chart-1` ... `--chart-6` in the style block. Mix light and dark values so neighbors stay distinct, and don't make red against green the only difference between two series.

---

## Fonts

- Each theme's fonts come from Google Fonts through the `<link ... data-theme-fonts="theme">` that `new-deck.mjs` writes. `scripts/bundle.mjs` downloads them into the single-file deck (Latin only unless `--all-fonts`), so the bundle works offline.
- Brand fonts from `--brand` get their own link (`data-brand-fonts`) with weights 400 and 700. Heavier heading weights (800 in corporate, minimal and pitch) then show at 700; add the weight to the link's `wght@` list, or set `--head-weight: 700`.
- Any other Google font: add a link and point a token at it.

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;700;800&display=swap"
  data-brand-fonts
/>
<style>
  html[data-theme] {
    --font-head: "Inter Tight", system-ui, sans-serif;
  }
</style>
```

- A font file of your own: put it in `assets/` and declare it with `@font-face` in the deck's `<style>`; `bundle.mjs` inlines local `url(...)` files from style blocks.
- Office fonts (Calibri, Arial...) are not downloaded: they show only where they are installed.
- PowerPoint export: `scripts/export-pptx.mjs` embeds the deck's Google Fonts by default (`--fonts embed`); `--fonts office` swaps to Calibri, Georgia and Consolas.

---

## Worked examples

### "Make it look like a consulting deck"

Corporate, calm motion, footers with source lines, action titles.

```bash
node scripts/new-deck.mjs --title "Q3 business review" --theme corporate --motion subtle
```

```html
<main
  class="deck"
  data-transition="fade"
  data-footer="Acme · Q3 business review · Confidential"
></main>
```

Write every title as the conclusion ("Margin fell because shipping costs doubled"), end chart slides with a `.source` line, and use `.invert` only for section breaks.

### "Our brand is navy and orange"

Navy carries the text and the dark slides; orange is the highlight. Start from corporate for a structured look, or pitch for a bolder one.

```html
<style>
  html[data-theme] {
    --accent: #f26b21; /* orange: kickers, bullets, numbers, highlights */
    --accent-2: #1b2a4a; /* navy as the second color (sweeps, decorations) */
    --accent-ink: #1b2a4a; /* navy text on orange fills reads better than white */
    --ink: #1b2a4a; /* navy headings and text */
    --inv-bg: #1b2a4a; /* .invert slides are navy */
    --inv-accent: #ff8a4c; /* lighter orange on navy */
    --mg-3: #1b2a4a;
    --chart-1: #1b2a4a;
    --chart-2: #f26b21;
    --chart-3: #5b7db1;
    --chart-4: #f5a623;
    --chart-5: #2ba59a;
    --chart-6: #9aa5b8;
  }
  [data-theme="corporate"] .layout-title::before {
    background:
      radial-gradient(
          circle at 1px 1px,
          rgba(255, 255, 255, 0.22) 1.5px,
          transparent 0
        )
        0 0 / 28px 28px,
      linear-gradient(160deg, var(--accent), var(--inv-bg) 70%);
  }
</style>
```

### "Use our fonts and colors from this PowerPoint"

```bash
node scripts/reference.mjs brand-template.pptx --out "<Documents>/Launch plan/.reference"
node scripts/new-deck.mjs --title "Launch plan" --theme corporate --brand "<Documents>/Launch plan/.reference/brand-template/brand.json"
```

Reading it into the deck's own folder keeps the template's notes with the deck.

Then open `deck.html`, check the brand block, and add the tokens `--brand` leaves alone (`--accent-ink`, `--inv-*`) as above.

### "Dark and dramatic, but in our green"

```html
<html lang="en" data-theme="keynote" data-motion="heavy">
  ...
  <style>
    html[data-theme] {
      --accent: #2fd27a;
      --accent-2: #2ee6d6;
      --inv-accent: #0f8a4b;
      --chart-1: #2fd27a;
    }
  </style>
</html>
```

Keynote's glows and gradient `<mark>` follow `--accent` and `--accent-2`, so they turn green too.
