---
name: html-slides
description: Makes presentation decks from a prompt as ONE self-contained interactive HTML file (its own slide engine with click builds, motion-graphic transitions, presenter view, live data and clickable app demos) and/or a PowerPoint (.pptx) that plays the same slides, steps and transitions. Use it whenever someone asks for slides, a deck, a presentation, a talk, a pitch, a keynote, a training or onboarding deck, a product walkthrough or demo, "turn this into slides", or a PowerPoint made from notes, data, a document or an older deck, even when they don't say HTML. Also use it for decks that are regenerated from a data or source file, slides with interactive app mockups or charts, and decks with animated or motion-graphic transitions.
---

# HTML slides

One deck folder gives two outputs that run the same show:

- **A single `.html` file**: the engine, icons, fonts, images and data are inlined, so it works offline, by email or from a USB stick. Builds, transitions, presenter view, laser and pen, interactive app mockups and charts all run in it.
- **A `.pptx`**: editable text in the deck's fonts, native charts, click builds, Morph, the nearest PowerPoint transitions, speaker notes and slide links.

Requirements: Node 22+ (the scripts drive the browser with Node's built-in WebSocket) and Chrome, Edge, Chromium or Brave (`DECK_BROWSER` points at another). The first run installs its npm packages (pptxgenjs, react-icons…) into `~/.cache/html-slides` (`HTML_SLIDES_CACHE`), so it needs the network once. `--preview` on the PowerPoint export needs Windows with PowerPoint.

<!-- agent: claude, codex -->
Paths below are relative to this skill's folder; run the scripts with `node`.
<!-- /agent -->
<!-- agent: gemini -->
Paths below are relative to this skill's folder (Gemini adds it to the workspace and lists its files when the skill activates); run the scripts with `node` through `run_shell_command`.

**Gemini and the deck folder.** `read_file`, `write_file` and `replace` only reach the workspace's folders, and every deck lives in the user's Documents folder (section 2), which usually isn't one of them. After `new-deck.mjs` makes the folder, check it's in the workspace before writing slides. If it isn't, ask the user to run `/directory add "<deck folder>"`, or, once for every deck, to add their Documents folder to `context.includeDirectories` in `~/.gemini/settings.json` (or start Gemini with `--include-directories "<Documents>"`). Don't get around it by making the deck somewhere else. The scripts themselves run from any folder.
<!-- /agent -->
<!-- agent: codex -->

**Codex and the deck folder.** Codex's sandbox writes only inside the folder it was started in (and folders added with `--add-dir`), and every deck lives in the user's Documents folder (section 2). If writing to the deck folder is refused, ask the user to approve it or to start Codex with `--add-dir "<Documents>"`. Don't get around it by making the deck somewhere else.
<!-- /agent -->

## 1. Interview first

Before writing anything, ask what the request doesn't already answer: one round of <!-- agent: claude -->`AskUserQuestion`, at most four questions, each with a recommended option<!-- /agent --><!-- agent: gemini -->`ask_user`, at most four `choice` questions, each with your recommended option first. If `ask_user` isn't available, ask them in one message as a numbered list with your recommendation for each, and wait for the answers<!-- /agent --><!-- agent: codex -->questions in one message, at most four, as a numbered list with your recommended answer for each; then wait for the answers<!-- /agent -->. Skip the ones the prompt settles and state your assumptions instead.

1. **Output**: a single HTML file, a PowerPoint, or both (recommend both: they come from the same folder at no extra cost).
2. **Style**: one of the eight themes, chosen from the audience (references/styles.md, "Pick a theme from what the user says"), or their brand. If they have a deck, PDF or logo colors to match, read it with `reference.mjs` (section 9).
3. **Length**: slide count or talk length. Plan on 1 to 2 minutes a slide.
4. **Motion and extras**: the motion level (`none`, `subtle`, `moderate`, `heavy`), and whether they want motion-graphic transitions, an interactive app demo, charts from data, a source file to regenerate the deck from, a logo on every slide, or speaker notes. Offer to show `assets/transitions.html` (every transition, one per slide) if they want to pick.

When the deck is about an app, a product or a process whose code you can't open, also ask what to build it from (screenshots, a screen recording of the steps, a user guide, the web address, an older deck): section 9 reads all of them. Fold it into question 4 to stay within four.

## 2. Where the deck lives

Everything a deck is made of (deck.html, its source file and build script, its images, the finished files) lives in one folder named after it in the user's Documents folder:

```sh
node scripts/new-deck.mjs --title "Q3 business review" --theme corporate --motion moderate
# -> <Documents>/Q3 business review/  (deck.html, engine/, assets/); outputs go to its dist/
```

`new-deck.mjs` finds Documents itself (Windows may have moved it, e.g. to `D:\Documents`); `HTML_SLIDES_HOME` names another parent when the user wants one. Never put a deck, or any part of one, in a temp or session scratchpad folder (they get cleared) or inside a code repository, even when the deck is about that code: read the project, and copy what the deck needs (screenshots, data, icons) into the deck folder. `new-deck.mjs` refuses those places; `--anywhere` is only for a place the user names. Tell the user the folder and the two file paths at the end.

## 3. Workflow

1. **Scaffold** with `new-deck.mjs` (above). `--presenter "Sam Lee"`, `--data data.json` (merged into the data list), `--brand brand.json` (colors and fonts).
2. **Write the slides** in `deck.html`. Read what you need first:
   - references/layouts.md: the layout classes, components and how much fits on a 1920×1080 slide.
   - references/styles.md: themes, tokens, brand overrides, fonts.
   - references/motion.md: entrances, builds, transitions, Morph, motion levels.
   - references/engine.md: the data list and `{{values}}`, repeats, builds, charts, icons, presenting, the `window.deck` API.
   - references/interactive.md: device frames, mockups, screenshots with hotspots, state, tours.
   - references/libraries.md: Chart.js, Mermaid, maps and the other vetted libraries (`add-lib.mjs`).
3. **Check**: `node scripts/check.mjs <deck>` screenshots every slide in its final state into `<deck>/.check/` and audits overflow, cut-off and tiny text, crowding, broken images, missing `{{values}}`, unknown icons and script errors. Fix what it reports, then **look at the PNGs**<!-- agent: gemini --> with `read_file`<!-- /agent --><!-- agent: codex --> with `view_image`<!-- /agent --> (`sheet.png` first): the audit can't judge design. Repeat until it's clean. `--transitions` freezes each transition for a look.
4. **Bundle**: `node scripts/bundle.mjs <deck>` writes `dist/<title>.html`, named like the deck folder. It turns JPEG and PNG images into WebP when that makes them smaller (scaling any over 2560 px down), stores an image shown on several slides once, and prints a size warning when the file is too big to email (about 15 MB fits Outlook.com once email encodes it) or to publish as one page (16 MB). Tell the user about a size warning and its heaviest parts.
5. **PowerPoint**: `node scripts/export-pptx.mjs <deck>` writes `dist/<title>.pptx`. On Windows with PowerPoint add `--preview` and read the `.check/pptx/compare-N.png` sheets (browser left, PowerPoint right). It opens only its own file and leaves PowerPoint running if it already was; a .pptx that's open in PowerPoint can't be overwritten, so ask the user to close it.
6. **Report**: the folder, both files, how to present (section 8), and anything you couldn't verify.

| Script            | Does                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `new-deck.mjs`    | Makes a deck folder from `assets/template.html`                                                                     |
| `check.mjs`       | Screenshots + audit (`--slides 3,5-7`, `--pdf`, `--theme`, `--transitions`, `--hotspots`)                           |
| `bundle.mjs`      | One self-contained HTML file (`--out`, `--keep-media`, `--no-fonts`, `--quality 0.8`, `--max-px 2560`, `--no-webp`) |
| `export-pptx.mjs` | PowerPoint (`--fonts embed\|keep\|office`, `--flatten`, `--scale 1.5`, `--no-builds`, `--preview`, `--out`)         |
| `icons.mjs`       | `--search chart line` finds react-icons names; check and bundle collect the deck's icons                            |
| `add-lib.mjs`     | Adds a vetted library (`--list` shows the catalog)                                                                  |
| `reference.mjs`   | Reads source materials: decks, documents, screenshots, screen recordings, web pages (section 9)                     |

## 4. Writing slides that work

- One idea per slide; under about 70 words; text 22px or larger on the 1920×1080 canvas. check.mjs flags slides over 70 words and text under 20px (13px inside app mockups, or anywhere marked `data-small-ok`). Speaker notes in `<aside class="notes">` on every slide.
- Put names, numbers and dates in the data list (`<script type="application/json" id="deck-data">`) and refer to them with `{{path | filter}}`; repeat with `data-each`. Pressing E while presenting edits the data live.
- Icons are react-icons names: `<span class="icon" data-icon="MdOutlineSavings"></span>` is the theme's filled icon chip; a bare `<span data-icon="LuRocket"></span>` is a plain 1em glyph. Find names with `icons.mjs --search`.
- An image or video whose path comes from the data uses `data-src="{{photo}}"`, never `src`: the browser fetches `src` before the value is filled in.
- Don't give your own pieces the engine's component class names (`.card`, `.icon`, `.stat`, `.pill`, `.timeline` and the rest in references/layouts.md, "Components"): they bring padding, backgrounds and layout you didn't ask for. Prefix your own (`.ill-card`).
- Decorations that are meant to spill out of their box (glows, blobs) get `data-decor` or `aria-hidden="true"`, so the audit ignores them.
- To show one of several variants (an illustration per section, say), render only the one you need with an empty-or-one-item list (`data-each="_ in only.chart"`) rather than hiding the others with CSS: hidden parts still count as words and add bundle weight.
- The deck's `engine/` folder is a copy made at scaffold time. To give an older deck engine fixes, copy `assets/engine/deck.js`, `deck.css` and `themes.css` over it.

## 5. Motion and transitions

- `<html data-motion>`: `none`, `subtle`, `moderate` (default) or `heavy`. M cycles it while presenting; the PowerPoint export follows the deck's level.
- Per slide `data-transition`: `fade`, `slide`, `zoom`, `wipe`, `rise`, `morph`, the reveals `iris`, `diagonal`, `split`, `blinds`, `cube`, and the motion-graphic sweeps `panels`, `stripes`, `shutter`, `circle`, `tiles`, `wave` (color bands from `--mg-1..3`). `data-transition-origin="78% 50%"` sets where a reveal or circle starts.
- `data-transition="auto"` on `main.deck` lets the theme pick per slide: its signature sweep for section slides, its reveal for big moments, its content transition otherwise (`--mg-signature`, `--mg-reveal`, `--mg-content`).
- `data-morph="name"` on matching elements of neighbouring slides animates them between positions (and becomes PowerPoint Morph).
- Entrances: `data-anim` (`rise`, `fade`, `pop`, `left`, `right`, `zoom`, `blur`, `draw`, `type`, `wipe`, `grow`, `grow-up`, `flip`, `spin`, `drop`, `reveal`), with `data-delay`, `data-stagger` and `data-split="words|chars"`. Your own keyframes work too: `[data-anim="push"] { --anim: my-push; }`.
- Builds: `data-step`, `data-exit`, `data-steps="focus"`. Loops: `data-loop="float|pulse|spin|drift"`.
- Illustration animations are plain CSS keyframes on the slide's own elements; stop them in `html.is-static` (print, PDF, screenshots) so the final frame is clean.

`assets/transitions.html` is a ready deck that shows every transition: copy it next to an engine (or open the copy in `<Documents>/Slide transitions/` if one was made) to let the user choose. Details: references/motion.md.

## 6. Interactive slides and app walkthroughs

references/interactive.md covers phone, tablet and browser frames, a mockup UI kit, state (`data-interactive`, `data-state`, `data-set`, `data-when`), typed input, tours and screenshot hotspots. Use a library (references/libraries.md) when it's easier than hand-building: Chart.js for charts beyond the built-in ones, Mermaid for diagrams, SortableJS for drag and drop.

For teaching an app step by step, use real screenshots as build layers and make the app's buttons clickable:

- Each screen is a layer in the phone frame with `data-step="{{n}}"`; the first is `data-step="0"` (showing when the slide opens). A custom `--anim` (push, back, tab) makes each arrive like the app's own navigation.
- A `<button class="hotspot" data-goto-step="N">` over each app button (placed with `--x`, `--y`, `--w`, `--h`) jumps to the step it leads to; add `hint` to the one to press next for a pulsing ring. The phone gets `class="no-advance"` so a stray click on it doesn't advance. Example: references/engine.md, "Jumping to a step".
- The list of steps beside it uses `data-steps="focus"` with `data-goto-step` on each item.
- In PowerPoint the same layers become click builds, so the show is identical; only the hotspot jumps are HTML-only.

The app's code isn't needed. With only screenshots, a screen recording, a guide or the app's web address, section 9 gives you the screens and the button positions; `check.mjs <deck> --hotspots` shows every step with each hotspot outlined, so you can see they sit on the right buttons. Use the screens the materials show: when a step's screen is missing, ask for it, or draw it with the mockup kit (references/interactive.md) and say that you did.

## 7. Decks built from a source file

When the user wants to change the content later and regenerate "the same slideshow", keep the content out of the HTML. All of it lives in the deck's folder in Documents (section 2), never in a project's repository:

- **A source file** (JSON) holds every word and number, with references to their data (`"{facts.total}"`) where values repeat.
- **`deck.html`** holds only templates and styles: `{{tokens}}`, `data-each`, and `<template data-each="lesson in lessons">` around slides that repeat per item (engine.md, "Whole slides from the data").
- **A build script** (`build.mjs` in the deck folder, Node) reads the source, works out derived values, writes the result as the deck's data list (replace the `<script type="application/json" id="deck-data">` block), and runs `bundle.mjs` and `export-pptx.mjs`, which write `dist/<title>.html` and `.pptx`. It finds the skill with `--skill <dir>`, `HTML_SLIDES_DIR`, or the first install folder that exists: <!-- as-is -->`~/.claude/skills/html-slides` (Claude Code), `~/.gemini/skills/html-slides` (Gemini CLI), `~/.gemini/config/skills/html-slides` (Antigravity), `~/.codex/skills/html-slides` (Codex), `~/.agents/skills/html-slides`<!-- /as-is -->, so the deck rebuilds under any of them. Give it `--html` and `--pptx` switches.
- **Data from a project** (an app's demo data, captured screens, numbers from a codebase): give the build script an `--import <project>` step that copies a snapshot into the deck folder (`app/`, say), so the deck rebuilds without the project and the project holds no deck files.
- **A logo or other image used across the deck** is one entry in the source file (`"logo": "assets/logo.svg"`) that reaches every slide through `data-logo="{{deck.logo}}"` on the deck and `data-src="{{deck.logo}}"` on title slides (engine.md, "Footer, slide number and logo"). Swapping the file or the entry and rebuilding changes it everywhere.
- Fail loudly on a reference that doesn't exist, pin "today" if the slides quote dates, and write a README in the deck folder that says how to edit and rebuild.

## 8. Presenting (tell the user)

| Key                     | Does                                                     |
| ----------------------- | -------------------------------------------------------- |
| → Space PageDown, click | Next step, then next slide                               |
| ← PageUp                | Back a step                                              |
| P                       | Presenter window: notes, next slide, timer (two screens) |
| F                       | Full screen                                              |
| O                       | Overview; click a slide to go there                      |
| A number, then Enter    | Go to that slide (hidden ones too)                       |
| L / D                   | Laser pointer / pen                                      |
| T                       | Next theme                                               |
| M                       | Next motion level                                        |
| E                       | Edit the data list                                       |
| B / W                   | Black / white screen                                     |
| ?                       | All shortcuts                                            |

URL options: `#/id` or `#/3` opens a slide, `?static` shows everything without motion, `?print` prints one slide per page. Details: references/engine.md, "Presenting".

## 9. Source materials: documents, screenshots, recordings, web pages, older decks

When the deck is about something you can't open as code (an app, a product, a process), build it from what the user has, and ask for it in the interview: screenshots, a screen recording of the steps, a user guide or notes, the app's web address, an older deck to follow.

```sh
node scripts/reference.mjs recording.mp4 guide.docx screens/ https://app.example.com --deck "<deck folder>"
```

For each source it writes `<deck>/.reference/<name>/reference.md` (read it first) and puts the pictures in `<deck>/assets/ref/<name>/`, ready for slides:

| Source                                          | What you get                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Older deck (.pptx, .pdf, HTML deck)             | Each slide's title, text, tables, charts and notes; its pictures; from a .pptx a `brand.json` (colors, fonts) for `new-deck.mjs --brand`; `--render` slide pictures |
| Document (.docx, .pdf, .md, .txt)               | The text with its headings, lists and tables, and the document's pictures                                                                                           |
| Screenshots (.png, .jpg, .webp)                 | Each picture and its size, plus a grid copy (lines every 10%) to read hotspot boxes off                                                                             |
| Screen recording (.mp4, .mov, .webm)            | Each distinct screen the video settles on, with its time and a grid copy (`--min-change 1` also catches small changes such as a toggle)                             |
| Web page or web app (`https://…`, a .html page) | A screenshot at `--device desktop`, `tablet` or `phone` size, and every button, link and field with its exact box in % (`--wait 4` for slow apps). It can't sign in |
| A folder                                        | Every file in it by type, in one outline                                                                                                                            |

For an app walkthrough from these:

1. Pick each step's screen from the outline and the pictures (<!-- agent: claude -->look at them<!-- /agent --><!-- agent: gemini -->open them with `read_file`<!-- /agent --><!-- agent: codex -->open them with `view_image`<!-- /agent -->).
2. Put the screens in the phone or browser frame as layers (section 6), using their `assets/ref/...` paths.
3. Place each hotspot from the screen's grid picture, or the element table for a web page: `--x` and `--y` are the button's left and top edges, `--w` and `--h` its size, in % of the screen.
4. Run `node scripts/check.mjs <deck> --hotspots` and look at `.check/hotspots/`: every step, each clickable spot a click can reach (`.hotspot` areas and buttons with `data-goto-step`, `data-goto` or `data-set`) outlined and labeled with where it goes. Nudge any that miss.
5. Keep to what the materials show (section 6).

Keynote and old .ppt or .doc files need saving as .pptx, .docx or PDF first. A recording Chrome can't play (some iPhone HEVC files) is converted with ffmpeg when it's installed; otherwise ask for an H.264 .mp4 or screenshots. Pages behind a sign-in need screenshots or a recording from the user.

## 10. PowerPoint export notes

- Every heading, paragraph, bullet and table cell is an editable text box at the browser's position and line breaks. Bar, line, area, pie and donut charts are native charts. Everything else (backgrounds, shapes, icons, mockups, photos) is a picture; `--scale 1.5` sharpens them.
- Builds become click animations in the same order, `data-morph` becomes Morph, transitions map to the nearest PowerPoint one, hidden slides stay hidden, section slides start sections, and `data-goto` links become clickable areas. Interactive mockups are exported in the state they open in.
- The deck's colors become the PowerPoint theme, so shapes the user adds later match.
- Fonts: `--fonts embed` (default) embeds the deck's Google Fonts; `keep` names them only; `office` swaps in Calibri, Georgia and Consolas. System fonts such as Segoe UI are named with their real weight names (Segoe UI Semibold). Viewers that ignore embedded fonts substitute their own, and embedding hasn't been verified in every PowerPoint version, so open the file on the computer it will be shown on before the day.
- `--flatten` keeps the text inside the pictures: exact look anywhere, but not editable.
