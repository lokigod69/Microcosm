# MICROCOSM — agent guide

Read [AGENTS.md](AGENTS.md) and follow its **Project Memory** section before touching code.

Quick facts:
- Vite + vanilla TypeScript + Canvas 2D. No runtime deps, no backend, no API keys.
- `npm run dev` / `npm test` (vitest) / `npm run build`.
- Determinism is sacred: all randomness via named PRNG streams (`src/sim/rng.ts`);
  the same-seed determinism test must never break.
- Sim (`src/sim/`) is DOM-free; UI (`src/ui/`) never mutates world state directly.
- Full sim spec: [docs/SIMULATION.md](docs/SIMULATION.md). Design language of the three
  themes: [docs/DESIGNS.md](docs/DESIGNS.md). Board: [PROJECT_BOARD.md](PROJECT_BOARD.md).
## Protocol
This project runs under protocol-os (global skill). At session start read protocol/PROTOCOL.md,
then the active workstream's NEXT_STEP.md, verify state, then work. Iron Rules apply.
