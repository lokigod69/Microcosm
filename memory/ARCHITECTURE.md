# Architecture
Last verified: 2026-07-10

## Overview
A single-page static app. A pure-TypeScript simulation core advances a `World` value one
tick (= one in-world day) through a fixed pipeline of systems; systems read/write world
state and append typed `WorldEvent`s to an event log. Randomness comes only from named
seeded PRNG streams, so the universe is a pure function of `(seed, tickCount)`. Each
season the Chronicler scores logged events for salience and renders a chapter in two
voices (Observer / Myth) using template grammars fed by tribe lexicons. The UI is
vanilla TS: a Canvas 2D map renderer plus DOM panels; it reads sim state, never mutates
it (all interaction goes through a small `SimController`).

## Key components
| Area | Where | Notes |
|---|---|---|
| PRNG & determinism | src/sim/rng.ts | sfc32; streams derived from seed + name hash |
| World generation | src/sim/worldgen.ts | value-noise elevation/moisture → biomes, rivers, fertility |
| Core types | src/sim/types.ts | World, Agent, Tribe, Settlement, WorldEvent, etc. |
| Tick pipeline | src/sim/engine.ts | fixed system order; see docs/SIMULATION.md |
| Agent behavior | src/sim/agents.ts | needs, utility-based action choice, genome inheritance |
| Tribes & culture | src/sim/tribes.ts | formation, leadership, splits, culture vectors, settlements |
| Language | src/sim/language.ts | phonology gen, coinage, drift, borrowing; per-tribe lexicon |
| Discovery/tech | src/sim/discovery.ts | fire→…→writing ladder, spread by contact |
| Conflict & diplomacy | src/sim/conflict.ts | raids, wars, alliances driven by culture + pressure |
| Religion & myth | src/sim/myth.ts | god genesis from unexplained events, myth instantiation |
| Chronicler | src/chronicle/ | salience scoring + template grammar, two voices |
| UI shell | src/ui/ | app.ts (wiring), renderer.ts (canvas), panels/ (DOM) |
| Themes | src/ui/themes.ts + styles/ | 3 CSS-variable themes + per-theme canvas palettes |
| Entry | index.html, src/main.ts | Vite |

## Data flow
seed → worldgen → World → engine.tick() loop → systems mutate World + append events →
Chronicler consumes events per season → chapters stored on World.chronicle →
UI reads World each animation frame → renderer paints map; panels render on change/interval.
User input → SimController (pause/speed/seed/select) → engine or UI state only.

## External services & dependencies that matter
- None at runtime. Dev-deps only: vite, typescript, vitest.
- Deploy target: any static host (GitHub Pages).

## Conventions
- Sim code never touches DOM/canvas; UI code never mutates World directly.
- Every random draw goes through a named stream: `world.rng("agents")` etc.
- All events are typed members of the `WorldEvent` union with `tick`, `kind`, `salience` inputs.
- IDs are numeric, allocated from World counters; names are always generated from a
  tribe's phonology (never hardcoded English names for in-world things).
- Tests live in test/, run with vitest; the determinism test (same seed twice → identical
  event log hash) must always pass.
