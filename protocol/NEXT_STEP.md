# NEXT STEP — MICROCOSM/main — updated 2026-07-10 (v1 published + review pass)

## DONE THIS SESSION
- Published: https://github.com/lokigod69/Microcosm (human created repo; agent pushed).
- Four-agent adversarial review (3× Opus + Codex): 29 raw findings, every one verified
  against the code before fixing. All confirmed findings fixed; 13 tests green.
- Big ones: almanac spark crash on long runs; war victor decided from stale populations;
  culture shocks from contact/religion events never applied; one chief heading two tribes
  after a split; sack/tech-spread chronicle templates naming the wrong tribe; MIT LICENSE
  added; seed parser (0, text seeds, negatives) fixed; event-log scans replaced with
  incremental caches — per-tick cost no longer grows with world age (3.6× faster by yr 75).

## FOR YOU
1. Play it: `cd ~/Coding/MICROCOSM && npm run dev` — pick a seed, hit Begin, set 60×,
   read the Chronicle as it writes itself. Press `T` to cycle the three designs.
2. Tell the next session your taste verdict: pacing? god abundance? population feel?
   Known + now measured: seed 7 holds ~38 kin through year 25 but decays to 4 by year 75
   (pre-existing, verified unchanged by this session's fixes) — long-horizon population
   balance is the top tuning target.

## PASTE THIS
Resume MICROCOSM/main under protocol-os.
Read protocol/PROTOCOL.md and this file, plus memory/INDEX.md and memory/STATE.md.
Verify: run `npm test` in ~/Coding/MICROCOSM — expect 13 tests green (4 files).
Then: taste-tuning pass from STATE.md "Next actions" (long-horizon population decay
first: seed 7 → 4 kin by year 75), incorporating the human's play-test feedback. Mode 1.
Work in long runs; checkpoint and Status Block only per protocol-os Iron Rules.
