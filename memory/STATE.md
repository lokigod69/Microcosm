# Current State
Last updated: 2026-07-12 (finalize session: identity rewrite + pinch-zoom)

## What this is
A browser-native deterministic world simulator (Vite + vanilla TypeScript + Canvas 2D)
whose civilizations write their own mythology. Zero backend, zero API keys. v1 complete.

## Working now
- Full engine (src/sim/, ~3.5k lines): worldgen (noise/biomes/rivers/glimmer), kin with
  8-gene genomes + needs + memory, tribes/settlements/chiefs/splits, per-tribe generated
  languages (coinage/drift/borrowing), tech ladder, wars/trade/alliances, plagues/omens
  (eclipse 587d, comet 1733d, aurora), gods born from unexplained events, myth
  instantiation. Verified: 11 tests green incl. same-seed determinism (3600 ticks) and
  emergence for seeds 1–5 (≥2 tribes, ≥1 god, ≥1 myth, ≥30 concepts in 25y).
- Chronicler (src/chronicle/): dual voice (Observer/Myth), texture-kind exclusion,
  repeat-collapse, per-kind templates, in-word gloss pattern (*khin*, the sky-fire),
  scribe register after `writing`. Rewritten by Fable after codex draft (see LOG).
- UI: canvas map (pan momentum/rubber-band/zoom-to-cursor, pinch-zoom on touch —
  midpoint-anchored, flows into drag when a finger lifts — per-theme palettes, event
  pulses, selection), panels (Chronicle/Inspect/Almanac/Lexicon), time controls
  (pause/1/4/16/60×, Space+1–4+T keys), genesis overlay. 3 themes: Observatory (default,
  dark glass), Field Journal (paper/ink), Illuminated (parchment/drop caps).
- Verified end-to-end headless: 23 in-world years live in browser, 60 chapters, 0 page
  errors; screenshots in docs/screenshots/. Build: 29 kB gzip JS.

## In progress
- (nothing — v1 shipped)

## Known problems
- Long-horizon population decay (measured 2026-07-10, baseline-confirmed pre-existing):
  seed 7 holds ~38 kin through year 25 but decays to 4 by year 75. Plateaus low even
  mid-game (~35–50 from 40 genesis). Birth/food balance is the #1 tuning target.
- Repo state until the human approves the force-push: GitHub history still shows the old
  auto-derived committer identity and lacks the pinch-zoom commit (72360c1). Command:
  `git fetch origin && git push --force-with-lease origin main`.
- Late-game seasons often "quiet" (chapter says so gracefully, but pacing could be richer:
  more inter-tribe drama at peace).
- Illuminated theme: mountain shading forms dark square clusters (reads as peak shading,
  arguably fine).
- Chronicle DOM capped at 60 chapters (older ones drop from panel; still in world.chronicle).

## Open questions
- LLM "deep chronicle" re-render mode behind ChronicleBackend (designed, not built).
- Family-tree view in Inspect; myth browser tab (myths currently surface via chronicle).

## Next actions
1. Human approves the force-push (see Known problems) — one command, then repo is final.
2. Play-test taste pass with the human: pacing, god abundance, population balance.
3. Tune long-horizon decay (seed 7 → 4 kin by yr 75) + fertility/food so towns (pop 40)
   appear in a typical run.
4. Consider a "Myths" tab listing world.myths with origin links.
