// The shared vocabulary of the simulation. This file is the contract between the
// engine (src/sim/), the chronicler (src/chronicle/), and the UI (src/ui/).
// Changing a public shape here requires updating memory/ARCHITECTURE.md.

import type { Streams } from "./rng";

// ---------- space & time ----------

export const WORLD_W = 120;
export const WORLD_H = 80;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 360
export const DAYS_PER_SEASON = 90;
export const ECLIPSE_PERIOD = 587;
export const COMET_PERIOD = 1733;

export type Season = "Thaw" | "High Sun" | "Fall" | "Long Dark";
export const SEASONS: Season[] = ["Thaw", "High Sun", "Fall", "Long Dark"];

export const BIOMES = [
  "ocean",
  "coast",
  "river",
  "grassland",
  "forest",
  "jungle",
  "savanna",
  "desert",
  "marsh",
  "hills",
  "mountain",
  "snow",
] as const;
export type Biome = (typeof BIOMES)[number];
export type BiomeId = number; // index into BIOMES

/** Struct-of-arrays tile storage, length WORLD_W * WORLD_H, index = y * WORLD_W + x */
export interface WorldMap {
  biome: Uint8Array;
  elevation: Float32Array; // 0..1
  moisture: Float32Array; // 0..1
  temperature: Float32Array; // base annual mean, 0..1 (season adjusts at read time)
  fertility: Float32Array; // 0..1 capacity
  vegetation: Float32Array; // current stock 0..1, regrows toward fertility
  wood: Float32Array;
  stone: Float32Array;
  glimmer: Uint8Array; // 0/1 deposit flag
}

// ---------- kin ----------

export const GENES = [
  "vigor",
  "boldness",
  "empathy",
  "curiosity",
  "fertility",
  "voice",
  "faith",
  "craft",
] as const;
export type Gene = (typeof GENES)[number];
export type Genome = Record<Gene, number>; // each 0..1

export type NeedName = "food" | "rest" | "warmth" | "belonging";
export type Needs = Record<NeedName, number>; // 0 (desperate) .. 1 (sated)

export type KinAction =
  | "idle"
  | "forage"
  | "hunt"
  | "rest"
  | "seek-warmth"
  | "socialize"
  | "migrate"
  | "build"
  | "explore"
  | "rite"
  | "raid";

export interface MemoryEntry {
  eventId: number;
  weight: number; // emotional weight 0..1
}

export interface Kin {
  id: number;
  name: string;
  tribeId: number;
  x: number;
  y: number;
  ageDays: number;
  sex: "f" | "m";
  genome: Genome;
  needs: Needs;
  health: number; // 0..1
  renown: number;
  hero: boolean;
  epithet: string | null;
  alive: boolean;
  deathTick: number | null;
  deathCause: string | null;
  parents: [number, number] | null;
  partnerId: number | null;
  childIds: number[];
  pregnantUntil: number | null; // tick when due (females)
  pregnantBy: number | null;
  memory: MemoryEntry[]; // max ~12, salience-pruned
  action: KinAction;
  targetX: number;
  targetY: number;
}

// ---------- tribes ----------

export interface Phonology {
  consonants: string[];
  vowels: string[];
  patterns: string[]; // e.g. ["CV","CVC"]
}

export interface LexEntry {
  word: string;
  coinedTick: number;
  oldForms: string[]; // drift history, oldest first
  borrowedFrom: number | null; // tribeId
}

export interface Culture {
  aggression: number;
  spirituality: number;
  craft: number;
  wanderlust: number;
  openness: number;
}

export const TECHS = [
  "fire",
  "tools",
  "shelter",
  "fishing",
  "boats",
  "weaving",
  "pottery",
  "herbal-lore",
  "bronze",
  "writing",
  "astronomy",
] as const;
export type Tech = (typeof TECHS)[number];

export interface Tribe {
  id: number;
  name: string;
  color: number; // stable hue index for the UI
  foundedTick: number;
  phonology: Phonology;
  lexicon: Record<string, LexEntry>; // concept -> entry
  culture: Culture;
  memberIds: number[];
  settlementIds: number[];
  chiefId: number | null;
  godIds: number[];
  relations: Record<number, number>; // tribeId -> -1..1
  techs: Tech[];
  homeX: number;
  homeY: number;
  extinct: boolean;
}

export type SettlementTier = "camp" | "village" | "town";

export interface Settlement {
  id: number;
  name: string;
  tribeId: number;
  x: number;
  y: number;
  tier: SettlementTier;
  foundedTick: number;
  sacked: boolean;
}

// ---------- religion & myth ----------

export const GOD_DOMAINS = [
  "sun",
  "sea",
  "death",
  "harvest",
  "storm",
  "moon",
  "beasts",
  "glimmer",
] as const;
export type GodDomain = (typeof GOD_DOMAINS)[number];

export type GodMood = "wrathful" | "generous" | "trickster";

export interface God {
  id: number;
  name: string;
  tribeId: number; // origin tribe
  domain: GodDomain;
  mood: GodMood;
  epithets: string[];
  attributions: number; // strength of belief
  promoted: boolean; // spirit -> god
  originEventId: number;
  adoptedByTribeIds: number[];
  demonizedByTribeIds: number[];
}

export type MythFamily =
  | "origin"
  | "trickster"
  | "flood"
  | "sky-omen"
  | "hero-deed"
  | "fall";

export interface Myth {
  id: number;
  title: string; // in-world language
  titleGloss: string; // English gloss
  family: MythFamily;
  tribeId: number;
  godId: number | null;
  heroId: number | null;
  originEventId: number;
  tick: number;
  lines: string[]; // the myth text, already rendered
}

// ---------- events ----------

export type EventKind =
  | "birth"
  | "death"
  | "pairing"
  | "hero.deed"
  | "hero.risen"
  | "settlement.founded"
  | "settlement.grown"
  | "settlement.sacked"
  | "tribe.formed"
  | "tribe.split"
  | "tribe.absorbed"
  | "chief.crowned"
  | "chief.contested"
  | "discovery"
  | "tech.spread"
  | "raid"
  | "war.start"
  | "war.end"
  | "peace.rite"
  | "alliance.formed"
  | "alliance.broken"
  | "trade.opened"
  | "omen.eclipse"
  | "omen.comet"
  | "omen.aurora"
  | "omen.storm"
  | "omen.drought"
  | "omen.earthquake"
  | "plague.start"
  | "plague.end"
  | "beast.attack"
  | "god.born"
  | "god.promoted"
  | "rite.held"
  | "myth.born"
  | "language.coin"
  | "language.borrow"
  | "language.drift"
  | "glimmer.found";

export interface WorldEvent {
  id: number;
  tick: number;
  kind: EventKind;
  tribeIds: number[];
  agentIds: number[];
  pos: { x: number; y: number } | null;
  /** small JSON-safe payload; keys stable per kind (see chronicler templates) */
  data: Record<string, string | number | boolean | null>;
  salience: number; // computed at emit time
}

// ---------- chronicle ----------

export interface Chapter {
  year: number; // 1-based in-world year
  season: Season;
  index: number; // chapter number, 1-based
  title: string;
  observer: string[]; // paragraphs
  myth: string[]; // paragraphs
  eventIds: number[];
}

/** Future LLM re-renderer plugs in here. v1 ships only the template backend. */
export interface ChronicleBackend {
  renderChapter(world: World, events: WorldEvent[], year: number, season: Season): Chapter;
}

// ---------- wars (active state) ----------

export interface War {
  id: number;
  attackerId: number;
  defenderId: number;
  startTick: number;
  attackerLosses: number;
  defenderLosses: number;
  exhaustion: number; // 0..1, war ends near 1
}

// ---------- almanac (UI stats) ----------

export interface StatSample {
  tick: number;
  population: number;
  byTribe: Record<number, number>;
}

// ---------- the world ----------

export interface Weather {
  drought: boolean;
  droughtUntil: number;
  harshWinter: boolean;
  stormToday: boolean;
}

export interface World {
  seed: number;
  name: string; // generated from the first tribe's phonology
  tick: number;
  map: WorldMap;
  kin: Map<number, Kin>;
  tribes: Map<number, Tribe>;
  settlements: Map<number, Settlement>;
  gods: Map<number, God>;
  myths: Myth[];
  wars: War[];
  events: WorldEvent[]; // append-only log
  chapterCursor: number; // index into events where the current season began
  chronicle: Chapter[];
  weather: Weather;
  stats: StatSample[]; // sampled monthly
  streams: Streams;
  counters: {
    kin: number;
    tribe: number;
    settlement: number;
    god: number;
    myth: number;
    event: number;
    war: number;
  };
}

// ---------- misc helpers used across layers ----------

export function idx(x: number, y: number): number {
  return y * WORLD_W + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H;
}

export function biomeAt(map: WorldMap, x: number, y: number): Biome {
  return BIOMES[map.biome[idx(x, y)]];
}
