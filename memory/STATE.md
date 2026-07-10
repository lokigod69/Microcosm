# Current State
Last updated: 2026-07-10 (end of build session)

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
- UI: canvas map (pan momentum/rubber-band/zoom-to-cursor, per-theme palettes, event
  pulses, selection), panels (Chronicle/Inspect/Almanac/Lexicon), time controls
  (pause/1/4/16/60×, Space+1–4+T keys), genesis overlay. 3 themes: Observatory (default,
  dark glass), Field Journal (paper/ink), Illuminated (parchment/drop caps).
- Verified end-to-end headless: 23 in-world years live in browser, 60 chapters, 0 page
  errors; screenshots in docs/screenshots/. Build: 29 kB gzip JS.

## In progress
- (nothing — v1 shipped)

## Known problems
- Population plateaus low (~35–50 kin from 40 genesis) — worlds survive but feel sparse
  late-game; birth/food balance is the #1 tuning target.
- Late-game seasons often "quiet" (chapter says so gracefully, but pacing could be richer:
  more inter-tribe drama at peace).
- Illuminated theme: mountain shading forms dark square clusters (reads as peak shading,
  arguably fine).
- Chronicle DOM capped at 60 chapters (older ones drop from panel; still in world.chronicle).

## Open questions
- LLM "deep chronicle" re-render mode behind ChronicleBackend (designed, not built).
- Family-tree view in Inspect; myth browser tab (myths currently surface via chronicle).

## Next actions
1. Play-test taste pass with the human: pacing, god abundance, population balance.
2. Consider a "Myths" tab listing world.myths with origin links.
3. Tune fertility/food so towns (pop 40) actually appear in a typical run.
