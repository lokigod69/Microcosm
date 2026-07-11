# Session Log
Newest first. Append-only — entries are never rewritten.
When this file exceeds ~300 lines, move the oldest half to `archive/log-2026.md`.

## 2026-07-12 — Finalize: git identity rewrite + pinch-zoom (Fable, kept — taste-sensitive gesture)
- **Changed:** All 4 commits rewritten from auto-derived `Quan Do <saya@Quans-Mac-mini.local>`
  to `lokigod69 <laqy69@gmail.com>` (git filter-branch; identity also set in global git
  config — it had never been set). Pinch-zoom added to the map camera
  (src/ui/renderer.ts): two fingers zoom around their moving midpoint (pan+zoom in one
  gesture), lifting one finger hands the camera to the survivor as a 1:1 drag, a pinch
  never registers as a tap; map hint now says "pinch or wheel to zoom".
- **Verified:** 13/13 vitest green; build clean; headless CDP touch-event run against the
  built bundle: pinch-out magnifies ~4.4× (terrain color-run length 5.4→23.6), pinch-in
  returns to baseline (5.7), single-finger pan works after a pinch, 0 page errors.
  Harness gotcha: touch points must land inside #map (480px wide) or Chrome delivers only
  one pointerdown — first FAIL was the test's fault, not the app's.
- **Open:** force-push of rewritten history blocked by permission classifier — human must
  approve `git fetch origin && git push --force-with-lease origin main`. Until then GitHub
  still shows the old identity and lacks the pinch commit.

## 2026-07-10 (later) — Published + four-agent adversarial review (recorded retroactively; that session updated NEXT_STEP but skipped this log)
- Pushed v1 to github.com/lokigod69/Microcosm after human created the repo. 3× Opus +
  codex review: 29 raw findings, all verified before fixing. Headliners: almanac sparkline
  RangeError on long runs froze the whole rAF loop; culture shocks never applied (event
  ordering); war victors judged from pre-casualty populations; event-log rescans replaced
  with incremental caches (flat ~20 µs/tick vs degrading 44→73). Tests 11→13. Baseline
  75-year worktree re-run proved fixes changed no world trajectory.

## 2026-07-10 — v1 built end-to-end in one session (Fable orchestrating, codex executing)
- **Changed:** Everything. Specs (docs/SIMULATION.md, docs/DESIGNS.md) + contract files
  (types/rng/time) by Fable; engine + chronicler draft + tests by codex (GPT-5.x, 14 min,
  16 files, all tests green first try); UI/themes/renderer/panels by Fable in parallel.
  Fable review found chronicle voice below bar (3 generic templates, repetition,
  language.coin spam, inverted gloss) → chronicler.ts + templates.ts fully rewritten by
  Fable; religion.ts patched (godId/trigger in events, witness-concept coinage).
- **Files:** src/sim/* (13), src/chronicle/* (2), src/ui/* (5), styles/* (2), test/* (4),
  index.html, docs/*, memory/*, protocol/*
- **Fixed:** god.born events missing godId (observer fell to generic line); god myths
  rendered through wrong tribe's lens; omen concepts never coined (glosses instead of
  in-world words); "A aurora" grammar; title-case in gloss titles; absolute asset paths
  (would break GH Pages).
- **Verified:** tsc clean; 11/11 vitest (determinism 3600 ticks, emergence seeds 1–5);
  headless browser run 23 in-world years, 60 chapters, 0 console errors; screenshots of
  all 3 themes reviewed visually. Codex bench: ~8000 ticks/s for 240 kin (budget: 60).
- **Decided:** see [[DECISIONS]] (chronicle selection rules; delegation split).
- **Open:** population plateau tuning; Myths tab; LLM deep-chronicle mode.

## 2026-07-10 — Project born: brain installed, build begins
- **Changed:** Created MICROCOSM at ~/Coding/MICROCOSM by autonomous choice (human gave
  full freedom; see [[DECISIONS]] "Project chosen autonomously"). Installed Second Brain
  memory layer + Protocol OS board. Wrote README, docs/SIMULATION.md, docs/DESIGNS.md.
- **Files:** README.md, memory/*, docs/*, CLAUDE.md, AGENTS.md, PROJECT_BOARD.md
- **Commits:** (first commit lands at end of build session)
- **Decided:** template-grammar chronicle (no LLM), vanilla TS + Canvas, sfc32 streams —
  all in [[DECISIONS]]
- **Open:** GitHub Pages auto-publish or not; future LLM "deep chronicle" mode.
