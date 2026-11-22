# Tesserae Server look ("Paper" design)

How to recreate the Tesserae Server admin UI (the "New design" / `data-ui="paper"` theme, as seen on `/history`). Derived from the server's own `paper-tokens.css`, `paper.css`, `chips.css`, `dx-history.css` (v0.514).

**Rules of the look:** warm off-white paper, ink text, one red accent. 1px hairlines only, **no shadows**, **2px corners** everywhere, monochrome navigation, no gradients, no serif. Round things stay round: status dots, switches, radios, the battery pill.

## 1. Tokens

Drop these into `:root` (Tailwind v4: put them in `@theme` or plain `:root` and reference with `var()`).

```css
:root {
  /* Surfaces */
  --bg: #eeeae1;            /* page ground (one step darker than cards) */
  --surface: #fffdf8;       /* cards, sidebar, inputs */
  --surface-soft: #faf7f0;
  --surface-sunk: #f1ece1;  /* chips, tiles, code */
  --sheet-edge: #e2dccf;    /* card outline */
  --hover: #f7f3ea;
  --selected: #e6e0d2;      /* active nav item */
  --subnav: #f6f3ec;

  /* Ink */
  --fg: #1c1b19;
  --fg-soft: #55524b;
  --muted: #7a766c;         /* lede text, counts */

  /* Lines */
  --border: #e0dacd;
  --border-strong: #cfc8b8; /* inputs, dividers */

  /* Accent: the single splash of colour */
  --accent: #b8352a;
  --accent-hover: #9e2c22;
  --accent-soft: #f3dcd6;
  --accent-ink: #7e231b;
  --accent-fg: #fffdf8;

  /* Status */
  --ok: #3d7a3a;     --ok-bg: #e3ebdd;
  --warn: #9a6f0c;   --warn-bg: #f2e7cc;   --warn-fg: #7a570a;
  --danger: #b8352a; --danger-bg: #f3dcd6; --danger-fg: #9e2c22;

  --focus: #2b4e9b;         /* focus ring is blue, not red */
  --chart-1: #2b4e9b; --chart-2: #b8352a; --chart-3: #c9971c; --chart-other: #8f8a7e;

  --radius: 2px;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --sidebar-w: 248px;       /* 64px when collapsed */

  --font: "Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "Martian Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Spacing: 4px base */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 20px; --s6: 24px; --s7: 32px; --s8: 48px;
}

/* Dark (follows the device by default; toggle sets data-theme) */
:root[data-theme="dark"] {
  --bg: #151412;  --surface: #22211e;  --surface-soft: #262421;  --surface-sunk: #1e1d1b;
  --sheet-edge: #35332e;  --hover: #262421;  --selected: #2f2d29;  --subnav: #1b1a18;
  --fg: #ede9df;  --fg-soft: #a8a397;  --muted: #8a857a;
  --border: #35332e;  --border-strong: #45423c;
  --accent: #d0493c;  --accent-hover: #e05a4c;  --accent-soft: #3b211d;  --accent-ink: #f0a497;  --accent-fg: #fff;
  --ok: #8dbf7f;  --ok-bg: #24301f;
  --warn: #d9b45a;  --warn-bg: #3a311b;  --warn-fg: #d9b45a;
  --danger: #e58474;  --danger-bg: #3b211d;  --danger-fg: #e58474;
  --focus: #7c9be0;
}
```

Browser chrome colours: `theme-color` `#F4F1E9` light / `#191816` dark.

## 2. Type

- **UI:** Archivo (weights 400/500 → regular, 600/700 → bold, 800 for display). Inter 700 is only preloaded, not the main face.
- **Mono:** Martian Mono 400/700. Used for timestamps, counts, IDs, event text, the battery pill. Use `font-variant-numeric: tabular-nums`.
- Fonts are OFL; get them from Fontsource (`@fontsource/archivo`, `@fontsource/martian-mono`).
- Icons: **Phosphor** (regular for nav/controls, bold for small inline, fill for active/emphasis). 19px in the sidebar, 12–15px inside chips and buttons.

| Use | Size / weight | Notes |
|---|---|---|
| Page title `h1` | 28px / 700 | letter-spacing -0.02em, line-height 1.15 |
| Section/card title `h2` | 20px / 700 | letter-spacing -0.015em, with 8×8 red square before it (see below) |
| Group title ("Today") | 15px / 700 | followed by a mono 11.5px muted count |
| Lede (under h1) | 13.5px / 400 | `--muted`, line-height 1.55 |
| Body / controls | 14px | |
| Nav item | 14px / 500 (active 600) | |
| Chips / tags | 12px / 600 | mono counts 11px |
| Small hint text | 12px | `--muted` |

Brand lockup: "Tesserae" 17px / 700, letter-spacing -0.015em, followed by a tiny `SERVER` tag (solid ink background `--fg`, text `--bg`, uppercase 700, ~9–10px, letter-spacing 0.06em, 2px radius).

## 3. Logo

Ink tile (never follows theme), red quarter top-right, paper quarter bottom-left:

```svg
<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="72" fill="#1C1B19"/>
  <path d="M128 55H174A27 27 0 0 1 201 82V128H128Z" fill="#D0493C"/>
  <path d="M55 128H128V201H82A27 27 0 0 1 55 174Z" fill="#FFFDF8"/>
</svg>
```

Shown at ~28px beside the name. On hover it rotates `-6deg` (220ms, `--ease`).

## 4. Layout

- `body { padding-left: var(--sidebar-w); background: var(--bg); }`. Plain colour, no dotted grid.
- **Sidebar:** fixed, left, full height, 248px, `background: var(--surface)`, `border-right: 1px solid var(--border)`, padding `20px 12px 16px`, scrolls independently.
  - Brand at top (padding-bottom 20px).
  - Nav items: flex, `gap 12px`, **height 40px**, padding `0 12px`, **radius 0**, 14px/500, icon 19px in `--fg-soft`, background transparent. Hover `--hover`. **Active:** background `--selected`, text and icon `--fg`, weight 600. No accent bar or underline.
  - Groups with a chevron (Widgets, Settings) open inline: children indented `margin-left 21px`, `border-left: 1px solid var(--border)`, `padding-left 8px`, links 13px, 8px/10px padding.
  - Footer block (pushed down with `margin-top: auto`): theme row ("Theme: follows the device", 13px `--fg-soft`, 40px high), a **"New design" switch**, and "Collapse" toggle. Same 40px row style.
  - Collapsed state: 64px wide, 44px square icon buttons, labels hidden, tooltips on hover.
- **Top-right battery pill:** fixed `top 16px; right 20px`, height 36px, padding `0 12px 0 10px`, 1px `--border`, **radius 999px**, `--surface` background, mono 12px/600 `--fg-soft`, battery icon 18px. Turns `--warn` when low, `--danger` when critical. Pages get `padding-top: 68px` so content starts below it.
- **Main content:** left-aligned column starting ~130px inside the sheet (≈ 40px page padding + page head), content width about 1390px in the screenshot; cards fill the column. Page head margin-bottom 24px.
- **Mobile (≤900px):** sidebar becomes a bottom tab bar (5 columns, 64px, `--surface`, top hairline, 11px labels, 22px icons, active = `--fg` 600) plus a bottom sheet for the rest. Drawer/sheet corners 2px.

## 5. Components

### Card ("sheet")
```css
.card { background: var(--surface); border: 1px solid var(--sheet-edge); border-radius: 2px; padding: 24px 28px; box-shadow: none; }
.card + .card { margin-top: 16px; }
```
Rows inside a card are separated by hairlines (`1px solid var(--border)`), never boxed. Hover row = `--hover`.

### Section title marker
Every card/section `h2` is prefixed by an 8×8 **square** in `--accent` (`margin-right 10px`, vertically centred, nudged up 2px). Section icons are hidden.

### Buttons & inputs
- All controls: **height 40px** (44px on touch, 32px for compact in-row ones), `border-radius: 2px`, 14px, `inline-flex` centred, `gap 6–8px`.
- Default/ghost: `--surface` background, `1px solid var(--border-strong)`, `--fg` text. Hover `--hover`.
- Primary: `background/border: --accent`, text `--accent-fg`; hover `--accent-hover`. No shadow, no lift.
- Destructive (the "Delete" button): ghost with `--danger` text and trash icon, slight `--danger-bg` tint.
- Inputs/selects: `--surface`, `1px solid var(--border-strong)`, 2px radius, search field has a leading magnifier icon in `--muted`. Selects use the native arrow.
- Focus ring: `outline: 2px solid var(--focus); outline-offset: 2px` (blue).

### Tags / chips (`.tg`)
Borderless tinted blocks, **26px high**, padding `0 9px`, 12px/600, `gap 6px`, radius 2px (the paper theme caps the 5px of the base chips to 2px). Tint = `color-mix(in oklab, TONE 16–20%, var(--surface))` with text `color-mix(in oklab, TONE 70–78%, var(--fg))`.

| Tone | Base colour | Seen as |
|---|---|---|
| neutral | `color-mix(in oklab, var(--fg) 7%, var(--surface))`, text `--fg-soft` | display name chip "E1001sim" (with small device icon) |
| ochre | `#c08a18` | **Rotation step** (tan/yellow) |
| terracotta | `#c95d2e` | |
| slate | `#5e7186` | |
| ok | `--ok` | **pushed** (green) |
| warn | `--warn` | |
| bad | `--danger` | failures |
| ink | solid `--fg` on `--bg` | SERVER tag |
| accent | solid `--accent` | |

The `button` kind chip is neutral; the outcome chip (`pushed`) is `ok`. Small variant `.tg--sm` = 22px high / 11px text.

### Segmented tabs (filter bars)
Track: inline-flex, `gap 3px`, `padding 3px`, min-height 34px, background `color-mix(in oklab, var(--fg) 9%, var(--surface))`, radius 2px.
Item: height 28px, padding `0 11px`, 12.5px/600, `--fg-soft`, icon 14px + label + **mono count** (11px, 500, opacity .7). Selected item: `--surface` background, `--fg` text, tiny shadow `0 1px 2px rgba(0,0,0,.12)` (the one allowed exception). Used for the "All 68 / Send page 3 / Schedule 9 …" row, the "Show skipped / Show background / Split presses / Newest first / By dashboard" row, and the "All displays / E1001sim" row. A 1px × 26px `--border-strong` vertical divider separates groups of tabs. Filter rows are `flex-wrap` with `gap 10px`, stacked with `gap 8px`, container margin-bottom 18px.

### History page specifics
- Title "History" + lede ("Every push, newest first. …").
- Filter rows as above, then the **"Clear history"** control right-aligned (`margin-left:auto`): 13px label, select (30px, 12.5px, `--border`), red Delete button.
- Big card (`padding: 8px 22px 12px`) containing: toolbar (search input ~320px wide, "Any outcome" select, "Newest first" select, right-aligned mono "48 pushes" count), a 12px muted hint line, then day groups.
- Group head: "Today" (15px/700) + mono muted "48 pushes", baseline-aligned, `gap 10px`.
- **Timeline rail:** `ul` with `::before` 2px vertical line `--border` at `left: 21px`. Each row has a **10px round dot** in `--accent` (`--danger` for failures) with a `0 0 0 3px var(--surface)` halo to knock out the line.
- **Row grid:** `24px 16px auto 64px minmax(0,1fr) auto 52px auto`, `gap 14px`, `padding 10px`, bottom hairline at 70% border. Columns: checkbox (square, 2px), dot, mono bold time (e.g. `11:37:21`, ~15px/700), 64px rendered-frame thumbnail with `1px` border and 2px radius, main text block, kind/outcome chips right-aligned, a 34px square icon button (retry ↻, 1px border), and a `…` overflow button.
- Main text block: line 1 = chips (display, kind) + bold display name; line 2 = **mono 12–13px** muted description, e.g. `button left → deck:e1001sim_lineup:welcome pushed Welcome`.
- Failed row: background `--danger-bg`, radius 8px→2px in Paper.
- Follow-up sub-rows (page finished rendering): small 8px dots on the same rail, 12.5px `--fg-soft`.

### Switch
"New design" toggle: pill track, ON = `--accent` fill with a white round knob; sits in the sidebar foot, label 13px `--fg-soft`.

### Notices / banners
`border-left: 3px solid var(--warn)`; background `color-mix(in srgb, var(--warn) 10%, transparent)`; 13px/600 title with a 12px `--fg-soft` sub line. Flash/notice boxes: 1px `--border`, `--surface`, 2px radius, min-height 48px.

### Stat tiles / dashboards
Container `--surface` with `--sheet-edge` border, padding `16px 12px`. Tiles transparent, separated by 1px left borders, padding `4px 16px`. Value 22px/700 (-0.02em) mono-ish, label 11px `--fg-soft`. Inner tiles (when opened) `--surface-sunk`, no border, padding `14px 16px`. Table heads 11px/500 `--fg-soft`; row names 15px/700; hover `--hover`; open row `--surface-sunk`.

## 6. Motion

- Hover/background transitions: `180ms ease-out`.
- Sidebar collapse slide: `200ms var(--ease)`; mobile sheet `240ms var(--ease)`.
- Battery pill expands from its own shape with a `clip-path` reveal (`260–300ms var(--ease)`).
- Honour `prefers-reduced-motion: reduce` (no transitions).

## 7. Quick checklist

1. Page ground `#eeeae1`, surfaces `#fffdf8`, ink `#1c1b19`, accent `#b8352a`.
2. Archivo for UI, Martian Mono for times/counts/ids, Phosphor icons.
3. Every radius 2px (except dots/switches/battery pill); every shadow `none`.
4. Hairline 1px borders `#e0dacd`; cards outlined `#e2dccf`.
5. Left sidebar 248px, 40px rows, active row shaded `#e6e0d2`, no colour in nav.
6. Red appears only as: section-title square, timeline dots, primary buttons, delete, logo.
7. Counts always mono, muted, next to the label.
