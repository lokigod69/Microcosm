import { emit } from "./events";
import { borrowWord, generatePhonology, makeName } from "./language";
import {
  DAYS_PER_YEAR,
  type Culture,
  type Kin,
  type Settlement,
  type SettlementTier,
  type Tribe,
  type World,
  type WorldEvent,
} from "./types";

const ADULT_AGE = 16 * DAYS_PER_YEAR;
const CULTURE_DRIFT = 0.0025;
const SPLIT_POPULATION = 72;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function livingMembers(world: World, tribeId: number): Kin[] {
  const members: Kin[] = [];
  for (const kin of world.kin.values()) {
    if (kin.alive && kin.tribeId === tribeId) members.push(kin);
  }
  members.sort((a, b) => a.id - b.id);
  return members;
}

function cultureFrom(members: readonly Kin[]): Culture {
  let boldness = 0;
  let faith = 0;
  let craft = 0;
  let curiosity = 0;
  let empathy = 0;
  for (const kin of members) {
    boldness += kin.genome.boldness;
    faith += kin.genome.faith;
    craft += kin.genome.craft;
    curiosity += kin.genome.curiosity;
    empathy += kin.genome.empathy;
  }
  const n = members.length || 1;
  return {
    aggression: boldness / n,
    spirituality: faith / n,
    craft: craft / n,
    wanderlust: curiosity / n,
    openness: empathy / n,
  };
}

function centroid(members: readonly Kin[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const kin of members) {
    x += kin.x;
    y += kin.y;
  }
  const n = members.length || 1;
  return { x: Math.round(x / n), y: Math.round(y / n) };
}

function copyLexicon(tribe: Tribe): Tribe["lexicon"] {
  const copy: Tribe["lexicon"] = {};
  for (const concept of Object.keys(tribe.lexicon).sort()) {
    const entry = tribe.lexicon[concept];
    copy[concept] = { ...entry, oldForms: entry.oldForms.slice() };
  }
  return copy;
}

function foundTribe(world: World, members: Kin[]): Tribe {
  const id = world.counters.tribe++;
  const home = centroid(members);
  const tribe: Tribe = {
    id,
    name: "",
    color: (id * 137 + world.seed * 29) % 360,
    foundedTick: world.tick,
    phonology: generatePhonology(world.streams),
    lexicon: {},
    culture: cultureFrom(members),
    memberIds: members.map((kin) => kin.id),
    settlementIds: [],
    chiefId: null,
    godIds: [],
    relations: {},
    techs: [],
    homeX: home.x,
    homeY: home.y,
    extinct: false,
  };
  tribe.name = makeName(world, tribe, "tribe");
  for (const kin of members) kin.tribeId = id;
  world.tribes.set(id, tribe);
  emit(world, "tribe.formed", {
    tribeIds: [id],
    agentIds: tribe.memberIds.slice(),
    pos: home,
    data: { name: tribe.name, population: members.length },
  });
  return tribe;
}

/** Turn genesis bands (kin whose tribe id has no Tribe yet) into stable tribes. */
function formBands(world: World): void {
  const bands = new Map<number, Kin[]>();
  for (const kin of world.kin.values()) {
    if (!kin.alive || world.tribes.has(kin.tribeId)) continue;
    const band = bands.get(kin.tribeId);
    if (band) band.push(kin);
    else bands.set(kin.tribeId, [kin]);
  }
  const keys = [...bands.keys()].sort((a, b) => a - b);
  for (const key of keys) {
    const members = bands.get(key)!;
    members.sort((a, b) => a.id - b.id);
    if (members.length >= 8) foundTribe(world, members);
  }
}

function updateCulture(tribe: Tribe, members: readonly Kin[], fresh: readonly WorldEvent[]): void {
  const target = cultureFrom(members);
  const cultureKeys: (keyof Culture)[] = [
    "aggression",
    "spirituality",
    "craft",
    "wanderlust",
    "openness",
  ];
  for (const key of cultureKeys) {
    tribe.culture[key] += (target[key] - tribe.culture[key]) * CULTURE_DRIFT;
  }

  // Shocks are intentionally small and applied exactly once per event: `fresh`
  // is the slice past the culture cursor, so events emitted by systems that run
  // after this one (contact, religion) land here on the following tick.
  for (const event of fresh) {
    if (!event.tribeIds.includes(tribe.id)) continue;
    if (event.kind === "raid" || event.kind === "war.start") {
      tribe.culture.aggression = clamp01(tribe.culture.aggression + 0.006);
      tribe.culture.openness = clamp01(tribe.culture.openness - 0.004);
    } else if (event.kind.startsWith("omen.") || event.kind === "god.born") {
      tribe.culture.spirituality = clamp01(tribe.culture.spirituality + 0.004);
    } else if (event.kind === "trade.opened" || event.kind === "alliance.formed") {
      tribe.culture.openness = clamp01(tribe.culture.openness + 0.004);
    }
  }
}

function chooseChief(members: readonly Kin[]): Kin | null {
  let winner: Kin | null = null;
  let best = -1;
  for (const kin of members) {
    if (kin.ageDays < ADULT_AGE) continue;
    const score = kin.renown * kin.genome.empathy;
    if (score > best || (score === best && winner !== null && kin.id < winner.id)) {
      winner = kin;
      best = score;
    }
  }
  return winner;
}

function updateChief(world: World, tribe: Tribe, members: readonly Kin[]): boolean {
  const oldChief = tribe.chiefId === null ? null : world.kin.get(tribe.chiefId);
  if (oldChief?.alive && oldChief.tribeId === tribe.id) return false;
  const candidates = members
    .filter((kin) => kin.ageDays >= ADULT_AGE)
    .sort((a, b) => {
      const bs = b.renown * b.genome.empathy;
      const as = a.renown * a.genome.empathy;
      return bs - as || a.id - b.id;
    });
  const chief = chooseChief(members);
  tribe.chiefId = chief?.id ?? null;
  if (!chief) return false;

  const rival = candidates[1];
  const contested = oldChief !== null && rival !== undefined &&
    rival.genome.boldness > 0.62 &&
    rival.renown * rival.genome.empathy >=
      chief.renown * chief.genome.empathy * 0.78;
  emit(world, contested ? "chief.contested" : "chief.crowned", {
    tribeIds: [tribe.id],
    agentIds: rival ? [chief.id, rival.id] : [chief.id],
    pos: { x: tribe.homeX, y: tribe.homeY },
    data: { chief: chief.name, rival: rival?.name ?? null },
  });
  return contested;
}

function desiredTier(population: number): SettlementTier {
  return population >= 40 ? "town" : population >= 16 ? "village" : "camp";
}

function updateSettlement(world: World, tribe: Tribe, members: readonly Kin[]): void {
  if (members.length === 0) return;
  let settlement: Settlement | undefined;
  for (const id of tribe.settlementIds.slice().sort((a, b) => a - b)) {
    const candidate = world.settlements.get(id);
    if (candidate && !candidate.sacked) {
      settlement = candidate;
      break;
    }
  }
  if (!settlement) {
    const id = world.counters.settlement++;
    settlement = {
      id,
      name: makeName(world, tribe, "settlement"),
      tribeId: tribe.id,
      x: tribe.homeX,
      y: tribe.homeY,
      tier: desiredTier(members.length),
      foundedTick: world.tick,
      sacked: false,
    };
    world.settlements.set(id, settlement);
    tribe.settlementIds.push(id);
    emit(world, "settlement.founded", {
      tribeIds: [tribe.id],
      agentIds: [],
      pos: { x: settlement.x, y: settlement.y },
      data: { settlement: settlement.name, tier: settlement.tier, population: members.length },
    });
    return;
  }
  const tier = desiredTier(members.length);
  if (tier !== settlement.tier && (tier === "town" || settlement.tier === "camp")) {
    settlement.tier = tier;
    emit(world, "settlement.grown", {
      tribeIds: [tribe.id],
      agentIds: [],
      pos: { x: settlement.x, y: settlement.y },
      data: { settlement: settlement.name, tier, population: members.length },
    });
  }
}

function splitTribe(world: World, parent: Tribe, members: Kin[], contested = false): Tribe | null {
  if (members.length < (contested ? 20 : SPLIT_POPULATION)) return null;
  const ordered = members.slice().sort((a, b) => {
    const ad = (a.x - parent.homeX) ** 2 + (a.y - parent.homeY) ** 2;
    const bd = (b.x - parent.homeX) ** 2 + (b.y - parent.homeY) ** 2;
    return bd - ad || a.id - b.id;
  });
  const migrants = ordered.slice(0, Math.floor(ordered.length * 0.38));
  if (migrants.length < 8) return null;
  const id = world.counters.tribe++;
  const home = centroid(migrants);
  const child: Tribe = {
    id,
    name: "",
    color: (parent.color + 43 + id * 17) % 360,
    foundedTick: world.tick,
    phonology: {
      consonants: parent.phonology.consonants.slice(),
      vowels: parent.phonology.vowels.slice(),
      patterns: parent.phonology.patterns.slice(),
    },
    lexicon: copyLexicon(parent),
    culture: { ...parent.culture, wanderlust: clamp01(parent.culture.wanderlust + 0.08) },
    memberIds: migrants.map((kin) => kin.id),
    settlementIds: [],
    chiefId: null,
    godIds: parent.godIds.slice(),
    relations: { [parent.id]: 0.1 },
    techs: parent.techs.slice(),
    homeX: home.x,
    homeY: home.y,
    extinct: false,
  };
  child.name = makeName(world, child, "tribe");
  parent.relations[id] = 0.1;
  const migrantIds = new Set(child.memberIds);
  for (const kin of migrants) kin.tribeId = id;
  parent.memberIds = parent.memberIds.filter((memberId) => !migrantIds.has(memberId));
  if (parent.chiefId !== null && migrantIds.has(parent.chiefId)) parent.chiefId = null;
  world.tribes.set(id, child);
  emit(world, "tribe.split", {
    tribeIds: [parent.id, id],
    agentIds: child.memberIds.slice(),
    pos: home,
    data: { parent: parent.name, child: child.name, population: migrants.length },
  });
  return child;
}

function absorbExtinct(world: World, extinct: Tribe): void {
  if (extinct.extinct) return;
  extinct.extinct = true;
  let heir: Tribe | null = null;
  let best = -Infinity;
  const tribes = [...world.tribes.values()].sort((a, b) => a.id - b.id);
  for (const candidate of tribes) {
    if (candidate.id === extinct.id || candidate.extinct) continue;
    const dx = candidate.homeX - extinct.homeX;
    const dy = candidate.homeY - extinct.homeY;
    const relation = candidate.relations[extinct.id] ?? 0;
    const score = relation * 20 - Math.sqrt(dx * dx + dy * dy);
    if (score > best) {
      best = score;
      heir = candidate;
    }
  }
  if (!heir) return;
  for (const concept of Object.keys(extinct.lexicon).sort()) {
    if (!heir.lexicon[concept]) borrowWord(world, heir, extinct, concept);
  }
  for (const godId of extinct.godIds.slice().sort((a, b) => a - b)) {
    if (!heir.godIds.includes(godId)) heir.godIds.push(godId);
    const god = world.gods.get(godId);
    if (god && !god.adoptedByTribeIds.includes(heir.id)) god.adoptedByTribeIds.push(heir.id);
  }
  emit(world, "tribe.absorbed", {
    tribeIds: [extinct.id, heir.id],
    agentIds: [],
    pos: { x: extinct.homeX, y: extinct.homeY },
    data: { absorbed: extinct.name, heir: heir.name },
  });
}

/** Per-tick band formation, cultural drift, settlement, leadership and split system. */
export function updateTribes(world: World): void {
  formBands(world);
  const fresh = world.events.slice(world.caches.cultureCursor);
  world.caches.cultureCursor = world.events.length;
  const tribeIds = [...world.tribes.keys()].sort((a, b) => a - b);
  for (const id of tribeIds) {
    const tribe = world.tribes.get(id)!;
    const members = livingMembers(world, id);
    tribe.memberIds = members.map((kin) => kin.id);
    if (members.length === 0) {
      absorbExtinct(world, tribe);
      continue;
    }
    tribe.extinct = false;
    const home = centroid(members);
    tribe.homeX += (home.x - tribe.homeX) * 0.01;
    tribe.homeY += (home.y - tribe.homeY) * 0.01;
    updateCulture(tribe, members, fresh);
    const contested = updateChief(world, tribe, members);
    updateSettlement(world, tribe, members);
    if (members.length >= SPLIT_POPULATION || (contested && members.length >= 20)) {
      splitTribe(world, tribe, members, contested);
    }
  }
}

export const tickTribes = updateTribes;
