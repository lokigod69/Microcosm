# Decisions
Newest first. Never delete a decision — mark it `⚠️ superseded → [[#the newer one]]` instead.
Wrong turns are part of the memory.

## 2026-07-10 — Chronicle selection: texture kinds never lead a chapter
**Status:** active
**Decision:** births, pairings, language bookkeeping, routine rites and hero.deed are
excluded from chapter selection; repeats of (kind × tribe-set) collapse to one line with
a "repeated N times" note; myth voice caps at 5 lines and only renders mythworthy kinds.
**Why:** First codex draft let language.coin spam and repeated aurora lines fill entire
chapters — chronicle read as noise. History is the exception, not the bookkeeping.
**Rejected:** pure salience top-7 (what codex shipped — high-frequency low-weight events
still won quiet seasons).

## 2026-07-10 — Delegation split: codex types the engine, Fable owns the voice
**Status:** active
**Decision:** Codex implemented the sim systems + tests to Fable's binding spec against
frozen contract files; Fable kept specs, UI, themes, and rewrote the chronicle voice
layer after review.
**Why:** Engine systems are spec-followable; the chronicle's prose quality is the
product's soul and needed taste-level authorship. Review confirmed the split: codex's
engine passed all gates untouched, its prose did not.
**Rejected:** codex writing everything (voice quality), Fable typing everything (wasteful).

## 2026-07-10 — Chronicle is template-grammar generated, not LLM generated
**Status:** active
**Decision:** The Chronicler renders chapters with deterministic template grammars fed by
tribe lexicons. No LLM calls anywhere in v1.
**Why:** Determinism is the product ("same seed → same gods"). Offline-first, free to run,
and the myth voice using the tribes' own coined words is more impressive than generic LLM
prose. An optional LLM re-render can be layered later behind the `ChronicleBackend`
interface without touching the engine.
**Rejected:** LLM-written chronicle (breaks determinism, needs keys, hides the emergence).

## 2026-07-10 — Vanilla TypeScript + Canvas 2D, no UI framework
**Status:** active
**Decision:** Vite + TypeScript, hand-rolled UI, Canvas 2D for the map, CSS custom
properties for theming. Only dev-deps: vite, vitest, typescript.
**Why:** The sim is the complexity budget; React adds nothing to a canvas-centric app and
one DOM sidebar. Three full visual themes are trivial with CSS variables. Differentiates
from Dreamloom (React/Supabase, built the same week).
**Rejected:** React/Next (overhead, no benefit), WebGL (2D tiles don't need it), Web
Worker for the sim (population ≤ ~600 keeps a tick well under a frame; simpler to stay
on the main thread — revisit only if profiling says otherwise).

## 2026-07-10 — One PRNG algorithm (sfc32), named per-domain streams
**Status:** active
**Decision:** All randomness flows from `Rng` instances derived from the world seed with
a stream name hash: `worldgen`, `agents`, `events`, `language`, `myth`, `chronicle`.
**Why:** Whole-universe reproducibility AND stability: adding a new consumer of
randomness in one system must not reshuffle every other system's rolls.
**Rejected:** Single shared stream (fragile ordering), Math.random (non-reproducible).

## 2026-07-10 — Project chosen autonomously: MICROCOSM
**Status:** active
**Decision:** Of all possible autonomous-build projects, build an emergence engine whose
output is mythology, named MICROCOSM, at ~/Coding/MICROCOSM.
**Why:** Human gave full freedom ("otherworldly, complex, deep, fun for you"). Portfolio
scan showed games, OS-tools, AI apps — but no simulation/emergence project. Zero-key,
static-deployable fits the lokigod69 GitHub Pages pattern (game-theory-arena).
**Rejected:** Another AI-API app (Dreamloom just filled that slot), multiplayer game
(needs infra the human would have to babysit).
