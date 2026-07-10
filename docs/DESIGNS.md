# MICROCOSM — Design Specification (binding)

One interface, three complete visual designs. The layout, interaction grammar, and
motion rules are shared; each theme changes materials, type, color — including the
**map palette** (the canvas reads the active theme's palette object, not CSS).
Theme cycles live via the top-bar theme button or `T`. Choice persists in
localStorage. Default: Observatory.

## Shared layout

```
┌──────────────────────────────────────────────────────────┐
│ topbar: world name · seed · date/season · time controls · theme │
├─────────────────────────────┬────────────────────────────┤
│                             │  tabs: Chronicle | Inspect │
│        world canvas         │        | Almanac | Lexicon │
│   (pan: drag, zoom: wheel)  │  panel content (scrolls)   │
│                             │                            │
└─────────────────────────────┴────────────────────────────┘
```

- **Topbar** is a translucent material layer; the canvas runs full-bleed underneath
  (scroll-edge fade, no hard 1px divider — Observatory/Field Journal; Illuminated may
  use a ruled border, that's in-theme).
- **Time controls:** pause/play, speeds 1× 4× 16× 60×, current date "Year 12 · High
  Sun · Day 34". Keyboard: space = pause, 1/2/3/4 = speeds, T = theme.
- **Panel** (right, ~380px, collapsible): Chronicle (the book, newest chapter on top,
  Observer/Myth voice toggle or interleaved), Inspect (click a tile/kin/settlement/
  tribe on the map → its card), Almanac (population & tribe sparklines, gods list,
  heroes, tech), Lexicon (per-tribe dictionary: concept → word, with drift history).
- **New-world overlay** at load: name, seed field, shuffle, Begin.

## Interaction grammar (all themes)

- Feedback on pointer-down; `:active` scale 0.97, 100ms ease-out.
- Map pan is 1:1 with pointer capture + release momentum (projection, deceleration
  0.998) and rubber-band at world edges. Zoom to cursor.
- Panel/tab transitions: springs, critically damped (damping 1.0, response ~0.3);
  bounce (~0.8) only on flick-driven things (map momentum). Implemented with rAF
  springs (no CSS keyframe motion for gesture-driven pieces).
- Selection: clicking a kin/settlement softly pulses a ring on the canvas and opens
  Inspect; the card's `transform-origin` is toward the clicked point.
- New chronicle chapter: subtle materialize (blur+scale together) of the chapter
  header; a small badge on the Chronicle tab if it's not active. No confetti — the
  text is the event.
- `prefers-reduced-motion`: cross-fades only, no springs/parallax; map momentum off.
- `prefers-reduced-transparency` / `prefers-contrast`: solid chrome variants.

## Theme 1 — Observatory (default; dark glass)

*You are a scientist watching a terrarium universe.*

- **Mood:** deep-space; the world glows like a specimen in the dark.
- **Chrome:** near-black blue (#0b0e16 family), panels `rgba(16,20,32,.55)` +
  `backdrop-filter: blur(20px) saturate(160%)`, 1px bright top edges
  (`rgba(255,255,255,.08)`), soft deep shadows.
- **Type:** system-ui/SF stack throughout; headings tight (-0.02em); numbers tabular.
- **Accents:** cyan #6ee7ff (interactive), amber #ffb454 (omens/salience), text
  #e8ecf5 / #8b93a7 secondary.
- **Map palette:** saturated-but-deep naturals — ink ocean #0a1a2e, biome greens
  desaturated toward teal, snow slightly blue; settlements as warm light dots (like
  cities from orbit); event pulses in accent cyan/amber.
- **Chronicle:** Observer voice in mono-ish caption style; Myth voice in italic serif
  (New York/Georgia) — the one serif allowed in this theme.

## Theme 2 — Field Journal (light paper)

*You are a naturalist sketching what you find.*

- **Mood:** daylight, paper, ink; calm and scientific-romantic.
- **Chrome:** warm paper #f6f2e9, panels solid paper with faint grain, hairline ink
  borders (#2a2620 at 12%), almost no shadows — hierarchy by hairlines and spacing.
- **Type:** serif body (Charter/Georgia) for chronicle & cards, system-ui for
  controls/labels (small caps labels, +0.06em tracking); ink #2a2620, faded ink
  #7a7364.
- **Accents:** botanical green #3f6d4e, ochre #c98a2d, specimen red #b4443c
  (sparingly: war/death).
- **Map palette:** watercolor — pale washes, ocean #cfe0dd, desert #ead9b0, forest
  #9dbb8f; settlements as ink ring-stamps; events as small ink annotations.
- **Chronicle:** Observer voice as numbered field notes; Myth voice inset as quoted
  passages with a vertical rule.

## Theme 3 — Illuminated (parchment manuscript)

*You are a medieval monk copying the world's scripture.*

- **Mood:** candlelit scriptorium; the chronicle is the hero.
- **Chrome:** aged parchment #e8d9b5 with vignette, deep burgundy #571f26 chrome
  band, gold #b98a2f rules and ornaments (CSS borders/pseudo-elements, no image
  assets), ruled double-line borders instead of shadows.
- **Type:** serif everywhere (Iowan/Palatino/Georgia stack); chapter titles with
  drop caps (::first-letter, gold); ink #3b2f1e.
- **Accents:** burgundy (interactive), gold (highlights), verdigris #4a6b5d
  (secondary).
- **Map palette:** mappa mundi — parchment land tones, ocean in muted verdigris with
  slightly darker edge ring (here-be-dragons energy), mountains dark-ink hatched
  tone, settlements as tiny keep icons (drawn glyphs), event marks in burgundy/gold.
- **Chronicle:** Myth voice leads, Observer voice follows as small marginalia-style
  gray text. Drop cap on each chapter.

## Craft bar

Every spacing/timing value deliberate; tabular numerals for all stats; dark↔light
theme switch eased (brief global crossfade, ~200ms, skipped under reduced-motion);
no layout shift between themes (identical geometry, different skin); focus-visible
rings in every theme; hit targets ≥ 32px.
