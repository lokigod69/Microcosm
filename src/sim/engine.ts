import { chronicleSeason } from "../chronicle/chronicler";
import { updateWeather, regrowVegetation } from "./climate";
import { updateContact } from "./contact";
import { updateDiscovery } from "./discovery";
import { decayNeeds, updateKinActions, updateLifecycle } from "./kin";
import { coin, driftLanguages, makeName } from "./language";
import { makeStreams } from "./rng";
import { updateReligion } from "./religion";
import { isSeasonBoundary, isYearBoundary, seasonOf, yearOf } from "./time";
import { updateTribes } from "./tribes";
import {
  BIOMES,
  GENES,
  WORLD_H,
  WORLD_W,
  type Genome,
  type Kin,
  type StatSample,
  type Tribe,
  type World,
} from "./types";
import { generateMap } from "./worldgen";

const GENESIS_POPULATION = 40;
const GENESIS_CONCEPTS = ["people", "water", "home", "food", "fire", "sky", "earth", "kin"] as const;

function randomGenome(world: World): Genome {
  const genome = {} as Genome;
  for (const gene of GENES) genome[gene] = Math.max(0.08, Math.min(0.92, 0.5 + world.streams.agents.jitter(0.16)));
  return genome;
}

function waterAdjacent(world: World, x: number, y: number): boolean {
  const tile = y * WORLD_W + x;
  const biome = BIOMES[world.map.biome[tile]];
  if (biome === "coast" || biome === "river") return true;
  if (x > 0 && BIOMES[world.map.biome[tile - 1]] === "ocean") return true;
  if (x + 1 < WORLD_W && BIOMES[world.map.biome[tile + 1]] === "ocean") return true;
  if (y > 0 && BIOMES[world.map.biome[tile - WORLD_W]] === "ocean") return true;
  return y + 1 < WORLD_H && BIOMES[world.map.biome[tile + WORLD_W]] === "ocean";
}

function genesisCenters(world: World, count: number): { x: number; y: number }[] {
  const candidates: number[] = [];
  for (let y = 1; y < WORLD_H - 1; y++) {
    for (let x = 1; x < WORLD_W - 1; x++) {
      const biome = BIOMES[world.map.biome[y * WORLD_W + x]];
      if (biome !== "ocean" && biome !== "mountain" && biome !== "snow" && waterAdjacent(world, x, y)) candidates.push(y * WORLD_W + x);
    }
  }
  if (candidates.length === 0) {
    for (let i = 0; i < world.map.biome.length; i++) if (BIOMES[world.map.biome[i]] !== "ocean") candidates.push(i);
  }
  const centers: { x: number; y: number }[] = [];
  while (candidates.length > 0 && centers.length < count) {
    const pick = world.streams.worldgen.int(candidates.length);
    const chosen = candidates[pick];
    candidates[pick] = candidates[candidates.length - 1];
    candidates.pop();
    const x = chosen % WORLD_W;
    const y = Math.floor(chosen / WORLD_W);
    let separated = true;
    for (const center of centers) if (Math.abs(center.x - x) + Math.abs(center.y - y) < 14) separated = false;
    if (separated) centers.push({ x, y });
  }
  while (centers.length < count) centers.push(centers[centers.length % Math.max(1, centers.length)] ?? { x: 60, y: 40 });
  return centers;
}

function nearbyLand(world: World, center: { x: number; y: number }): { x: number; y: number } {
  for (let attempt = 0; attempt < 32; attempt++) {
    const x = Math.max(0, Math.min(WORLD_W - 1, center.x + world.streams.agents.int(7) - 3));
    const y = Math.max(0, Math.min(WORLD_H - 1, center.y + world.streams.agents.int(7) - 3));
    if (BIOMES[world.map.biome[y * WORLD_W + x]] !== "ocean") return { x, y };
  }
  return center;
}

function makeGenesisKin(world: World, bandId: number, center: { x: number; y: number }, ordinal: number): Kin {
  const pos = nearbyLand(world, center);
  const id = world.counters.kin++;
  return {
    id,
    name: "",
    tribeId: bandId,
    x: pos.x,
    y: pos.y,
    ageDays: (14 + world.streams.agents.int(25)) * 360 + world.streams.agents.int(360),
    sex: ordinal % 2 === 0 ? "f" : "m",
    genome: randomGenome(world),
    needs: { food: 0.82, rest: 0.85, warmth: 0.8, belonging: 0.78 },
    health: 1,
    renown: world.streams.agents.range(0, 1.5),
    hero: false,
    epithet: null,
    alive: true,
    deathTick: null,
    deathCause: null,
    parents: null,
    partnerId: null,
    childIds: [],
    pregnantUntil: null,
    pregnantBy: null,
    memory: [],
    action: "idle",
    targetX: pos.x,
    targetY: pos.y,
  };
}

function initializeBands(world: World): void {
  const bandCount = 2 + world.streams.agents.int(3);
  const centers = genesisCenters(world, bandCount);
  for (let i = 0; i < GENESIS_POPULATION; i++) {
    const band = i % bandCount;
    const kin = makeGenesisKin(world, -(band + 1), centers[band], i);
    world.kin.set(kin.id, kin);
  }
  updateTribes(world);
  const tribes = [...world.tribes.values()].sort((a, b) => a.id - b.id);
  for (const kin of world.kin.values()) {
    const tribe = world.tribes.get(kin.tribeId);
    if (tribe !== undefined) kin.name = makeName(world, tribe, "kin");
  }
  for (const tribe of tribes) for (const concept of GENESIS_CONCEPTS) coin(world, tribe, concept, concept);
  const first = tribes[0];
  world.name = first === undefined ? "" : makeName(world, first, "myth");
}

function statSample(world: World): StatSample {
  const byTribe: Record<number, number> = {};
  const tribeIds = [...world.tribes.keys()].sort((a, b) => a - b);
  for (const id of tribeIds) byTribe[id] = 0;
  let population = 0;
  for (const kin of world.kin.values()) {
    if (!kin.alive) continue;
    population++;
    byTribe[kin.tribeId] = (byTribe[kin.tribeId] ?? 0) + 1;
  }
  return { tick: world.tick, population, byTribe };
}

export function createWorld(seed: number): World {
  const streams = makeStreams(seed);
  const world: World = {
    seed,
    name: "",
    tick: 0,
    map: generateMap(streams),
    kin: new Map(),
    tribes: new Map(),
    settlements: new Map(),
    gods: new Map(),
    myths: [],
    wars: [],
    events: [],
    chapterCursor: 0,
    chronicle: [],
    weather: { drought: false, droughtUntil: 0, harshWinter: false, stormToday: false },
    stats: [],
    streams,
    caches: {
      cultureCursor: 0,
      tradedPairs: new Set(),
      alliedPairs: new Set(),
      plagues: new Map(),
      seenKinds: new Set(),
    },
    counters: { kin: 1, tribe: 1, settlement: 1, god: 1, myth: 1, event: 1, war: 1 },
  };
  initializeBands(world);
  world.stats.push(statSample(world));
  return world;
}

/** Advance exactly one in-world day in the binding system order. */
export function tickWorld(world: World): void {
  // 1 calendar/celestial and 2 climate/weather share the climate stream and pass.
  updateWeather(world);
  // 3 vegetation regrowth
  regrowVegetation(world);
  // 4 kin needs decay
  decayNeeds(world);
  // 5 kin decisions, actions, and movement
  updateKinActions(world);
  // 6 births and deaths
  updateLifecycle(world);
  // 7 tribe dynamics
  updateTribes(world);
  // 8 language drift; coinage occurs inline in every system
  if (isYearBoundary(world.tick + 1)) driftLanguages(world);
  // 9 discovery
  updateDiscovery(world);
  // 10 contact, conflict, and diplomacy
  updateContact(world);
  // 11 religion and myth
  updateReligion(world);
  // 12 event log is append-only and therefore already flushed.
  const closedTick = world.tick;
  world.tick++;
  if (world.tick % 30 === 0) world.stats.push(statSample(world));
  if (isSeasonBoundary(world.tick)) {
    const events = world.events.slice(world.chapterCursor);
    world.chronicle.push(chronicleSeason(world, events, yearOf(closedTick), seasonOf(closedTick)));
    world.chapterCursor = world.events.length;
  }
}

export function livingTribes(world: World): Tribe[] {
  return [...world.tribes.values()].filter((tribe) => !tribe.extinct).sort((a, b) => a.id - b.id);
}
