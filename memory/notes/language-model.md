# Language model
2026-07-10 · compiled from docs/SIMULATION.md §Language (source of truth — read that first)

Per-tribe phonology (7–12 consonants, 3–5 vowels, 2–4 syllable patterns) → all words,
names, god names, myth titles generated from it. Coinage is lazy + salience-gated
(death coins on first *witnessed* death). Yearly drift scaled by mean `voice` gene,
old forms kept for "in the old tongue". Borrowing on trade with phonological
adaptation; war borrows only the enemy's name. Design intent: cultures must *sound*
distinct, related names must sound related, zero hardcoded English proper names.
Implementation: src/sim/language.ts, stream `language`.
