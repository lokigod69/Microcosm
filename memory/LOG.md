# Session Log
Newest first. Append-only — entries are never rewritten.
When this file exceeds ~300 lines, move the oldest half to `archive/log-2026.md`.

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
