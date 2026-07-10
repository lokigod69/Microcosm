# Chronicler
2026-07-10 · compiled from docs/SIMULATION.md §Chronicler (source of truth)

Season-boundary batch job: score season events (kind weight × scale × novelty ×
participant renown), keep top ~7 + always-keep kinds, render Chapter with two voices:
Observer (dated, quantified, cold) and Myth (dominant tribe's lens: their lexicon
with first-use glosses, their gods as causes, epithets, parallelism; `writing` tech
shifts register to "It is written…"). All phrasing from `chronicle` stream —
chronicle text is part of the determinism invariant. `ChronicleBackend` interface
reserved for future LLM re-render (explicitly out of v1, see [[DECISIONS]]).
Implementation: src/chronicle/, tests must hash chronicle text.
