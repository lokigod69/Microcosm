import { emit } from "./events";
import { killKin } from "./kin";
import { borrowWord, coin } from "./language";
import {
  BIOMES,
  DAYS_PER_YEAR,
  WORLD_H,
  WORLD_W,
  idx,
  type Kin,
  type Tribe,
  type War,
  type World,
} from "./types";

const ADULT_AGE = 16 * DAYS_PER_YEAR;

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

function livingMembers(world: World, tribeId: number): Kin[] {
  const result: Kin[] = [];
  for (const kin of world.kin.values()) {
    if (kin.alive && kin.tribeId === tribeId) result.push(kin);
  }
  result.sort((a, b) => a.id - b.id);
  return result;
}

function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

function eventHasPair(eventTribes: readonly number[], a: number, b: number): boolean {
  return eventTribes.includes(a) && eventTribes.includes(b);
}

function hasEver(world: World, kind: string, a: number, b: number): boolean {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i];
    if (event.kind === kind && eventHasPair(event.tribeIds, a, b)) return true;
  }
  return false;
}

function allianceActive(world: World, a: number, b: number): boolean {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i];
    if (!eventHasPair(event.tribeIds, a, b)) continue;
    if (event.kind === "alliance.formed") return true;
    if (event.kind === "alliance.broken") return false;
  }
  return false;
}

function relation(a: Tribe, b: Tribe): number {
  return ((a.relations[b.id] ?? 0) + (b.relations[a.id] ?? 0)) * 0.5;
}

function changeRelation(a: Tribe, b: Tribe, delta: number): void {
  a.relations[b.id] = clamp((a.relations[b.id] ?? 0) + delta, -1, 1);
  b.relations[a.id] = clamp((b.relations[a.id] ?? 0) + delta, -1, 1);
}

function ensureAutonym(world: World, tribe: Tribe): string {
  const concept = `tribe:${tribe.id}`;
  if (!tribe.lexicon[concept]) {
    const word = tribe.name.toLowerCase();
    tribe.lexicon[concept] = {
      word,
      coinedTick: world.tick,
      oldForms: [],
      borrowedFrom: null,
    };
    emit(world, "language.coin", {
      tribeIds: [tribe.id],
      agentIds: [],
      pos: { x: tribe.homeX, y: tribe.homeY },
      data: { concept, word, gloss: tribe.name },
    });
  }
  return concept;
}

function rangeRadius(world: World, tribe: Tribe): number {
  let radius = 7;
  for (const kin of world.kin.values()) {
    if (!kin.alive || kin.tribeId !== tribe.id) continue;
    const dx = kin.x - tribe.homeX;
    const dy = kin.y - tribe.homeY;
    radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy) + 3);
  }
  return Math.min(22, radius);
}

function rangesOverlap(world: World, a: Tribe, b: Tribe): boolean {
  const dx = a.homeX - b.homeX;
  const dy = a.homeY - b.homeY;
  const reach = rangeRadius(world, a) + rangeRadius(world, b);
  return dx * dx + dy * dy <= reach * reach;
}

function openTrade(world: World, a: Tribe, b: Tribe): void {
  changeRelation(a, b, 0.12);
  const aName = ensureAutonym(world, a);
  const bName = ensureAutonym(world, b);
  borrowWord(world, b, a, aName);
  borrowWord(world, a, b, bName);
  emit(world, "trade.opened", {
    tribeIds: [a.id, b.id],
    agentIds: [],
    pos: { x: Math.round((a.homeX + b.homeX) / 2), y: Math.round((a.homeY + b.homeY) / 2) },
    data: { traders: `${a.name}/${b.name}` },
  });
}

function exchangeWord(world: World, a: Tribe, b: Tribe): void {
  const aWords = Object.keys(a.lexicon).sort().filter((concept) => !b.lexicon[concept]);
  const bWords = Object.keys(b.lexicon).sort().filter((concept) => !a.lexicon[concept]);
  if (aWords.length > 0 && (bWords.length === 0 || world.streams.events.chance(0.5))) {
    borrowWord(world, b, a, world.streams.events.pick(aWords));
  } else if (bWords.length > 0) {
    borrowWord(world, a, b, world.streams.events.pick(bWords));
  }
}

function intermarry(world: World, a: Tribe, b: Tribe): void {
  const eligibleA = livingMembers(world, a.id).filter((kin) => kin.ageDays >= ADULT_AGE && kin.partnerId === null);
  const eligibleB = livingMembers(world, b.id).filter((kin) => kin.ageDays >= ADULT_AGE && kin.partnerId === null);
  const pairs: [Kin, Kin][] = [];
  for (const first of eligibleA) {
    for (const second of eligibleB) {
      if (first.sex !== second.sex) pairs.push([first, second]);
    }
  }
  if (pairs.length === 0) return;
  const [first, second] = world.streams.events.pick(pairs);
  first.partnerId = second.id;
  second.partnerId = first.id;
  changeRelation(a, b, 0.04);
  emit(world, "pairing", {
    tribeIds: [a.id, b.id],
    agentIds: [first.id, second.id],
    pos: { x: Math.round((first.x + second.x) / 2), y: Math.round((first.y + second.y) / 2) },
    data: { first: first.name, second: second.name, intermarriage: true },
  });
}

function activeWar(world: World, a: number, b: number): boolean {
  return world.wars.some((war) =>
    (war.attackerId === a && war.defenderId === b) ||
    (war.attackerId === b && war.defenderId === a));
}

function startWar(world: World, attacker: Tribe, defender: Tribe): void {
  if (activeWar(world, attacker.id, defender.id)) return;
  const war: War = {
    id: world.counters.war++,
    attackerId: attacker.id,
    defenderId: defender.id,
    startTick: world.tick,
    attackerLosses: 0,
    defenderLosses: 0,
    exhaustion: 0,
  };
  world.wars.push(war);
  changeRelation(attacker, defender, -0.25);
  const enemyName = ensureAutonym(world, defender);
  borrowWord(world, attacker, defender, enemyName);
  emit(world, "raid", {
    tribeIds: [attacker.id, defender.id],
    agentIds: attacker.chiefId === null ? [] : [attacker.chiefId],
    pos: { x: defender.homeX, y: defender.homeY },
    data: { attacker: attacker.name, defender: defender.name },
  });
  emit(world, "war.start", {
    tribeIds: [attacker.id, defender.id],
    agentIds: [],
    pos: { x: defender.homeX, y: defender.homeY },
    data: { warId: war.id, attacker: attacker.name, defender: defender.name },
  });
}

function killInWar(world: World, tribe: Tribe, war: War): boolean {
  const victims = livingMembers(world, tribe.id);
  if (victims.length === 0) return false;
  const victim = world.streams.events.pick(victims);
  killKin(world, victim, "war");
  return true;
}

function sackSettlement(world: World, attacker: Tribe, defender: Tribe, war: War): boolean {
  for (const id of defender.settlementIds.slice().sort((a, b) => a - b)) {
    const settlement = world.settlements.get(id);
    if (!settlement || settlement.sacked) continue;
    settlement.sacked = true;
    emit(world, "settlement.sacked", {
      tribeIds: [attacker.id, defender.id],
      agentIds: [],
      pos: { x: settlement.x, y: settlement.y },
      data: { settlement: settlement.name, attacker: attacker.name, warId: war.id },
    });
    return true;
  }
  return false;
}

function processWars(world: World): void {
  world.wars.sort((a, b) => a.id - b.id);
  for (let i = world.wars.length - 1; i >= 0; i--) {
    const war = world.wars[i];
    const attacker = world.tribes.get(war.attackerId);
    const defender = world.tribes.get(war.defenderId);
    if (!attacker || !defender) {
      world.wars.splice(i, 1);
      continue;
    }
    const attackerPop = livingMembers(world, attacker.id).length;
    const defenderPop = livingMembers(world, defender.id).length;
    if (attackerPop > 0 && world.streams.events.chance(0.006 + defender.culture.aggression * 0.003)) {
      if (killInWar(world, attacker, war)) war.attackerLosses++;
    }
    if (defenderPop > 0 && world.streams.events.chance(0.007 + attacker.culture.aggression * 0.004)) {
      if (killInWar(world, defender, war)) war.defenderLosses++;
    }
    war.exhaustion = clamp(
      war.exhaustion + 0.0025 + (war.attackerLosses + war.defenderLosses) * 0.0008,
      0,
      1,
    );
    const decisive = attackerPop === 0 || defenderPop === 0 ||
      (war.defenderLosses >= 4 && war.defenderLosses > war.attackerLosses * 2);
    if (!decisive && war.exhaustion < 1) continue;
    const attackerWon = attackerPop > 0 && (defenderPop === 0 || war.defenderLosses > war.attackerLosses);
    const sacked = attackerWon && sackSettlement(world, attacker, defender, war);
    emit(world, "war.end", {
      tribeIds: [attacker.id, defender.id],
      agentIds: [],
      pos: { x: defender.homeX, y: defender.homeY },
      data: {
        warId: war.id,
        attackerLosses: war.attackerLosses,
        defenderLosses: war.defenderLosses,
        victor: attackerWon ? attacker.name : defender.name,
        sacked,
      },
    });
    if (!decisive && world.streams.events.chance(0.65)) {
      emit(world, "peace.rite", {
        tribeIds: [attacker.id, defender.id],
        agentIds: [],
        pos: { x: Math.round((attacker.homeX + defender.homeX) / 2), y: Math.round((attacker.homeY + defender.homeY) / 2) },
        data: { warId: war.id },
      });
      changeRelation(attacker, defender, 0.12);
    }
    world.wars.splice(i, 1);
  }
}

function updatePairContact(world: World, a: Tribe, b: Tribe): void {
  if (!rangesOverlap(world, a, b)) return;
  const warmth = (a.culture.openness + b.culture.openness) * 0.35 + relation(a, b) * 0.3;
  const hostility = (a.culture.aggression + b.culture.aggression) * 0.4 - warmth;
  if (!hasEver(world, "trade.opened", a.id, b.id) && warmth >= hostility) openTrade(world, a, b);
  const traded = hasEver(world, "trade.opened", a.id, b.id);
  if (traded && world.tick % 90 === (a.id * 31 + b.id * 17) % 90) {
    changeRelation(a, b, 0.006);
    if (world.streams.events.chance(0.45)) exchangeWord(world, a, b);
  }
  if (traded && relation(a, b) > 0.35 && world.tick % DAYS_PER_YEAR === (a.id + b.id * 7) % DAYS_PER_YEAR && world.streams.events.chance(0.2)) {
    intermarry(world, a, b);
  }
  if (relation(a, b) > 0.62 && !allianceActive(world, a.id, b.id)) {
    emit(world, "alliance.formed", {
      tribeIds: [a.id, b.id],
      agentIds: [],
      pos: null,
      data: { first: a.name, second: b.name },
    });
  } else if (relation(a, b) < 0.05 && allianceActive(world, a.id, b.id)) {
    emit(world, "alliance.broken", {
      tribeIds: [a.id, b.id],
      agentIds: [],
      pos: null,
      data: { first: a.name, second: b.name },
    });
  }
  if (!activeWar(world, a.id, b.id) && hostility > 0.18 && world.streams.events.chance(0.00018 + hostility * 0.00032)) {
    const attacker = a.culture.aggression > b.culture.aggression ||
      (a.culture.aggression === b.culture.aggression && a.id < b.id) ? a : b;
    startWar(world, attacker, attacker.id === a.id ? b : a);
  }
}

function beastEncounters(world: World): void {
  const kinIds = [...world.kin.keys()].sort((a, b) => a - b);
  for (const id of kinIds) {
    const kin = world.kin.get(id)!;
    if (!kin.alive) continue;
    const x = clamp(Math.round(kin.x), 0, WORLD_W - 1);
    const y = clamp(Math.round(kin.y), 0, WORLD_H - 1);
    const biome = BIOMES[world.map.biome[idx(x, y)]];
    if ((biome === "forest" || biome === "jungle") && world.streams.events.chance(0.000018)) {
      const beast = world.streams.events.chance(0.68) ? "wolf" : "bear";
      kin.health = clamp(kin.health - (beast === "bear" ? 0.42 : 0.24), 0, 1);
      const tribe = world.tribes.get(kin.tribeId);
      if (!tribe) continue;
      coin(world, tribe, beast, beast);
      if (kin.health <= 0) killKin(world, kin, "beast");
      emit(world, "beast.attack", {
        tribeIds: [kin.tribeId],
        agentIds: [kin.id],
        pos: { x, y },
        data: { beast, victim: kin.name, survived: kin.health > 0 },
      });
    } else if ((biome === "coast" || biome === "ocean") && world.streams.events.chance(0.0000012)) {
      const tribe = world.tribes.get(kin.tribeId);
      if (!tribe) continue;
      coin(world, tribe, "sea-serpent", "sea serpent");
      emit(world, "beast.attack", {
        tribeIds: [tribe.id],
        agentIds: [kin.id],
        pos: { x, y },
        data: { beast: "sea-serpent", victim: null, survived: true, sighting: true },
      });
    }
  }
}

function latestPlagueStart(world: World, tribeId: number): number | null {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i];
    if (!event.tribeIds.includes(tribeId)) continue;
    if (event.kind === "plague.end") return null;
    if (event.kind === "plague.start") return event.tick;
  }
  return null;
}

function updatePlagues(world: World, tribes: readonly Tribe[]): void {
  for (const tribe of tribes) {
    const people = livingMembers(world, tribe.id);
    if (people.length === 0) continue;
    const started = latestPlagueStart(world, tribe.id);
    if (started !== null) {
      for (const kin of people) {
        if (world.streams.events.chance(0.00022)) {
          killKin(world, kin, "plague");
        }
      }
      if (world.tick - started >= 50 && world.streams.events.chance(0.035)) {
        emit(world, "plague.end", {
          tribeIds: [tribe.id], agentIds: [], pos: { x: tribe.homeX, y: tribe.homeY },
          data: { duration: world.tick - started },
        });
      }
      continue;
    }
    let food = 0;
    for (const kin of people) food += kin.needs.food;
    const overcrowded = people.length > 48 || (tribe.settlementIds.length > 0 && people.length > 38);
    if (overcrowded && food / people.length < 0.42 && world.streams.events.chance(0.0008)) {
      emit(world, "plague.start", {
        tribeIds: [tribe.id], agentIds: [], pos: { x: tribe.homeX, y: tribe.homeY },
        data: { population: people.length },
      });
    }
  }
}

/** Range-overlap contact, diplomacy, conflict, beasts and crowd disease. */
export function updateContact(world: World): void {
  const tribes = [...world.tribes.values()]
    .filter((tribe) => !tribe.extinct)
    .sort((a, b) => a.id - b.id);
  for (let i = 0; i < tribes.length; i++) {
    for (let j = i + 1; j < tribes.length; j++) {
      const [firstId] = orderedPair(tribes[i].id, tribes[j].id);
      const first = tribes[i].id === firstId ? tribes[i] : tribes[j];
      const second = first === tribes[i] ? tribes[j] : tribes[i];
      updatePairContact(world, first, second);
    }
  }
  processWars(world);
  beastEncounters(world);
  updatePlagues(world, tribes);
}

export const tickContact = updateContact;
