# MICROCOSM — Simulation Specification (binding)

Everything below is deterministic: the world is a pure function of `(seed, tickCount)`.
All randomness comes from named sfc32 PRNG streams derived from the master seed
(`worldgen`, `climate`, `agents`, `events`, `language`, `myth`, `chronicle`), so adding
a system never perturbs the randomness of another. Constants marked ~ are tunable;
structure, determinism rules, and system order are not.

**Forbidden inside `src/sim/` and `src/chronicle/`:** `Math.random`, `Date`, and any
iteration whose order depends on object-key insertion where results are affected —
use arrays or sorted keys. Invariant test: two worlds from the same seed run 3600
ticks → identical event-log JSON and identical chronicle text.

## Time

- 1 tick = 1 day. 12 months × 30 days = 360-day year. 4 seasons of 90 days:
  Thaw, High Sun, Fall, Long Dark.
- Celestial cycles: solar eclipse every 587 days (offset by seed), comet every 1,733
  days, aurora on cold clear winter nights. These exist to give religions something
  to see. All emit `omen` events.

## Space

- Grid: 120 × 80 tiles, toroidal wrap disabled (world has edges — edges matter to myth).
- Per tile: elevation, moisture, temperature (base + season), biome, fertility,
  vegetation stock, wood, stone, `glimmer` (rare mythic mineral, 5–9 deposits per world).
- Biomes from (elevation, moisture, temperature): ocean, coast, river, grassland,
  forest, jungle, savanna, desert, marsh, hills, mountain, snow.
- Terrain: layered value noise (seeded), then a rain-shadow pass, then 2–4 rivers
  traced downhill from mountain sources.
- Seasons scale vegetation regrowth (~High Sun 1.3, Thaw 1.0, Fall 0.8, Long Dark
  0.35). Weather from the `climate` stream: drought (halves regrowth for weeks),
  storms, harsh winters.

## Kin (agents)

Population ~40 at genesis, soft cap ~240 (fertility falls as cap nears; keeps 60 fps).

- **Genome** (8 genes, 0–1, mutate ±0.05 on birth, child = parent mean + mutation):
  vigor, boldness, empathy, curiosity, fertility, voice (language innovation),
  faith (myth susceptibility), craft.
- **Needs:** food, rest, warmth, belonging. Needs drive a utility-scored action pick:
  forage / hunt / rest / seek-warmth / socialize / migrate / build / explore / rite.
  Needs decay every tick; full decision re-evaluation may stagger (~every 3 ticks
  per kin) for performance.
- **Memory:** each kin keeps up to 12 salient memories (event refs with emotional
  weight); memories bias behavior (a famine survivor hoards; a war orphan fears the
  killer tribe) and feed the myth system.
- **Lifecycle:** child → adult (16y) → elder (52y); natural death by hazard curve;
  death causes: age, hunger, cold, beast, war, plague. Lineage tracked
  (parents/children). Pairing via socialize + compatibility; gestation ~270 ticks.
- **Renown:** deeds accumulate renown (first discovery, kills in defense, rite
  leadership, surviving a disaster). Renown > threshold ⇒ the kin becomes a *Hero* —
  a named character eligible for myth and chronicle roles.

## Tribes

- Genesis kin start in 2–4 bands seeded near water. Bands become **tribes** when ≥ 8
  members share a home range.
- **Culture vector** (drifts from members' mean genome + event shocks): aggression,
  spirituality, craft, wanderlust, openness.
- Tribes found **settlements** (camp → village at pop 16 → town at pop 40), split
  when overcrowded or after leadership disputes, and can be destroyed (their words
  and gods may be inherited by conquerors — cultural absorption).
- **Leadership:** highest renown × empathy adult; succession on death can be smooth
  or contested (boldness of rivals); contested succession can split the tribe.

## Language (the heart)

Each tribe owns a **phonology**: 7–12 consonants, 3–5 vowels, 2–4 syllable patterns
(CV, CVC, CVV…), all drawn from seeded streams. From it, words are generated as
1–3 syllables.

- **Coinage:** the first time a tribe *saliently* encounters a concept (fire, death,
  river, star, bear, enemy-tribe, eclipse, sea, glimmer…) it coins a word. Concepts
  carry a salience trigger (e.g. `death` coins on first witnessed death, not existence).
- **Drift:** each year every word has a small mutation chance (vowel shift, consonant
  lenition, syllable loss) scaled by the tribe's mean `voice` gene. Old forms are
  recorded so the chronicle can say "in the old tongue…".
- **Borrowing:** trade contact copies words the borrower lacks (with phonological
  adaptation into the borrower's inventory); war borrows the enemy's name only.
- **Naming:** kin names, settlement names, god names, and myth titles are all built
  from the tribe's own phonology, so each culture *sounds* different and related
  names sound related. No in-world proper name is ever hardcoded English.

## Discovery

Tech tree (each unlock is an event, most coin a word): fire, tools, shelter, fishing,
boats, weaving, pottery, herbal-lore, bronze, writing, astronomy. Unlock chance scales
with mean curiosity/craft, settlement size, and need pressure (cold winters push fire
and shelter; coastal tribes push fishing and boats). Friendly contact can spread a
tech. `writing` upgrades the Chronicle voice for that tribe (see below).

## Conflict & contact

- Contact when ranges overlap: openness × empathy ⇒ trade route (word borrowing,
  goods, occasional intermarriage) or raids ⇒ war (casualties, hero deeds, settlement
  sacking). Wars end by exhaustion, decisive sack, or a peace rite.
- Beasts: wolves/bears (forest), sea-serpent sightings (deep water, rare, mostly myth
  fuel), plagues after overcrowding + bad harvests.

## Religion & myth

- **Attribution:** when a high-impact event lacks a visible cause (eclipse, plague,
  comet, earthquake, miraculous survival), a tribe with sufficient spirituality
  attributes it to a **spirit**, naming it in its own language and assigning a domain
  (sun, sea, death, harvest, storm, moon, beasts, glimmer).
- **Promotion:** repeated attributions to the same domain promote a spirit to a
  **god**: it gains epithets, a mood (wrathful/generous/trickster), rites (tribes
  perform `rite` actions at it after disasters), and a genesis myth.
- **Syncretism & rivalry:** allied tribes may adopt each other's gods (adapted name);
  enemy gods get demonized (same domain, hostile framing). A conquered tribe's gods
  may survive inside the conqueror's pantheon — renamed.
- **Myths:** instantiated from template families (`origin, trickster, flood,
  sky-omen, hero-deed, fall`) when a god is born, a hero crosses a renown threshold,
  or a war/disaster ends. Slots are filled with in-world names and the tribe's own
  words. Myths are stored on the world and quoted by the Chronicle.

## Events & salience

- `WorldEvent` union; every member: `{ id, tick, kind, tribeIds, agentIds?, pos?,
  data }`. Kinds: birth, death, pairing, hero.deed, settlement.founded/grown/sacked,
  tribe.formed/split/absorbed, chief.crowned/contested, discovery, tech.spread,
  raid, war.start/end, peace.rite, alliance.formed/broken, trade.opened, omen
  (eclipse/comet/aurora/storm/drought/earthquake), plague.start/end, beast.attack,
  god.born, god.promoted, myth.born, rite.held, language.coin/borrow/drift,
  glimmer.found.
- **Salience** = base weight by kind × scale (casualties, population affected) ×
  novelty (first-of-kind multiplier) × max renown of participants. Used by kin
  memory and by the Chronicler.

## The Chronicler (`src/chronicle/`)

Every season boundary, take the season's events, score by salience, keep the top ~7
(always keep god.*, myth.born, war.*, tribe.*, discovery), render a **Chapter**
`{ year, season, title, observer: Paragraph[], myth: Paragraph[] }`:

- **Observer voice:** precise, dated, quantified. "Day 214. The drought entered its
  third week; four foragers of the Okku starved on the west plain."
- **Myth voice:** the same facts through the dominant affected tribe's lens: their
  words for concepts (glossed on first use — "the hunger-wind (*surkha*)"), their
  gods as causes, formulaic epithets, parallelism. After a tribe unlocks `writing`,
  its myth voice shifts from oral formulas to scribe register ("It is written…").
- All phrasing choices draw from the `chronicle` stream — deterministic.
- `ChronicleBackend` interface isolates rendering so a future LLM re-renderer can
  plug in without touching the engine (explicitly NOT in v1).

## System order per tick (engine.ts)

1. calendar/celestial → 2. climate/weather → 3. vegetation regrowth →
4. kin needs decay → 5. kin decisions/actions/movement (staggered) →
6. births/deaths → 7. tribe dynamics (formation, splits, chiefs, settlements) →
8. language drift check (yearly; coinage happens inline wherever triggered) →
9. discovery → 10. contact/conflict/diplomacy → 11. religion/myth →
12. event-log flush; on season boundary → Chronicler.

## Performance budget

240 kin × utility AI must sustain ≥ 60 ticks/s at max speed on a laptop: staggered
decisions, per-tile scalar fields as typed arrays, no avoidable per-tick allocations
in hot loops. Sim runs on the main thread with a per-frame tick budget.
