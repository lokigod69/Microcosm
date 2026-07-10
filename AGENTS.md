# MICROCOSM — AGENTS

## Project Memory (Second Brain Protocol)

This project keeps its living memory in `memory/`. Markdown is the source of truth; agents maintain it.

**On session start (before touching code):**
1. Read `memory/INDEX.md` (the map) and `memory/STATE.md` (current truth).
2. Open other memory files only when relevant: `DECISIONS.md` for why, `ARCHITECTURE.md` for how, `LOG.md` for what happened recently, `notes/` for deep topics, `raw/` only to hunt an original source.
3. Never sweep the whole `memory/` tree. For big cross-cutting questions, send a subagent and take back only its conclusions.

**After meaningful work (before ending the session) — this is part of the task, not optional:**
1. `memory/LOG.md` — prepend a dated entry: what changed, files touched, commits, bugs fixed, open questions.
2. `memory/STATE.md` — refresh current truth and Next actions; delete lines that stopped being true.
3. `memory/DECISIONS.md` — append any decision made, with the why. Mark superseded decisions, never erase them.
4. `memory/ARCHITECTURE.md` — only if structure changed.
5. If new files landed in `memory/raw/`, compile their durable insights into the right pages and link back to the source.

Trivial work (typos, tiny tweaks) needs no save.

**Writing rules:** update, don't duplicate. Date everything (YYYY-MM-DD). Mark wrong or doubtful content visibly (`⚠️ superseded`, `⚠️ stale?`, `⚠️ unverified`) instead of leaving it looking current. Never edit `memory/raw/`. Keep STATE.md under ~100 lines. Link notes with `[[wikilinks]]`.

## Engine invariants (break these and the product is broken)
- Same seed ⇒ identical world, events, names, chronicle. Guarded by test/determinism.test.ts.
- No `Math.random`, no `Date.now()` inside `src/sim/` or `src/chronicle/`.
- In-world proper names come from tribe phonology only.
