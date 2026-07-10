import { emit } from "./events";
import { coin, makeName } from "./language";
import { biomeAt, GENES, WORLD_H, WORLD_W, type Genome, type Kin, type KinAction, type World } from "./types";

const SOFT_CAP = 240;
const GESTATION_DAYS = 270;
const HERO_THRESHOLD = 12;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function distance(a: Kin, b: Kin): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function livingPopulation(world: World): number {
  let count = 0;
  for (const kin of world.kin.values()) if (kin.alive) count++;
  return count;
}

export function decayNeeds(world: World): void {
  const winter = world.weather.harshWinter ? 0.009 : 0;
  for (const kin of world.kin.values()) {
    if (!kin.alive) continue;
    kin.ageDays++;
    kin.needs.food = clamp01(kin.needs.food - (0.006 + (1 - kin.genome.vigor) * 0.002));
    kin.needs.rest = clamp01(kin.needs.rest - 0.0035);
    kin.needs.warmth = clamp01(kin.needs.warmth - winter);
    kin.needs.belonging = clamp01(kin.needs.belonging - 0.0025);
  }
}

function utilityAction(world: World, kin: Kin): KinAction {
  const biome = biomeAt(world.map, kin.x, kin.y);
  const foodNeed = 1 - kin.needs.food;
  const scores: [KinAction, number][] = [
    ["forage", foodNeed * 2.1 + world.map.vegetation[kin.y * WORLD_W + kin.x]],
    ["hunt", foodNeed * 1.55 + kin.genome.boldness * 0.6 + (biome === "forest" ? 0.25 : 0)],
    ["rest", (1 - kin.needs.rest) * 1.9],
    ["seek-warmth", (1 - kin.needs.warmth) * 2.2],
    ["socialize", (1 - kin.needs.belonging) * 1.7 + kin.genome.empathy * 0.35],
    ["migrate", kin.genome.curiosity * 0.28 + kin.genome.vigor * 0.12],
    ["build", kin.genome.craft * 0.42],
    ["explore", kin.genome.curiosity * 0.48],
    ["rite", kin.genome.faith * 0.31],
  ];
  let best = scores[0];
  for (let i = 1; i < scores.length; i++) {
    if (scores[i][1] > best[1]) best = scores[i];
  }
  return best[0];
}

function setTravelTarget(world: World, kin: Kin, radius: number): void {
  const rng = world.streams.agents;
  kin.targetX = Math.max(0, Math.min(WORLD_W - 1, kin.x + rng.int(radius * 2 + 1) - radius));
  kin.targetY = Math.max(0, Math.min(WORLD_H - 1, kin.y + rng.int(radius * 2 + 1) - radius));
}

function moveOneStep(world: World, kin: Kin): void {
  const dx = Math.sign(kin.targetX - kin.x);
  const dy = Math.sign(kin.targetY - kin.y);
  const choices: [number, number][] = dx !== 0 && dy !== 0
    ? [[kin.x + dx, kin.y], [kin.x, kin.y + dy]]
    : [[kin.x + dx, kin.y + dy]];
  const first = choices.length === 1 ? choices[0] : choices[world.streams.agents.int(choices.length)];
  if (first[0] < 0 || first[0] >= WORLD_W || first[1] < 0 || first[1] >= WORLD_H) return;
  const biome = biomeAt(world.map, first[0], first[1]);
  if (biome !== "ocean") {
    kin.x = first[0];
    kin.y = first[1];
  }
}

function findCompatiblePartner(world: World, kin: Kin): Kin | null {
  let best: Kin | null = null;
  let bestScore = -1;
  for (const other of world.kin.values()) {
    if (!other.alive || other.id === kin.id || other.tribeId !== kin.tribeId || other.partnerId !== null) continue;
    if (other.sex === kin.sex || other.ageDays < 16 * 360 || kin.ageDays < 16 * 360) continue;
    if (distance(kin, other) > 5) continue;
    const score = 1 - Math.abs(kin.genome.empathy - other.genome.empathy) + (kin.genome.empathy + other.genome.empathy) * 0.25;
    if (score > bestScore || (score === bestScore && best !== null && other.id < best.id)) {
      best = other;
      bestScore = score;
    }
  }
  return best;
}

function maybePair(world: World, kin: Kin): void {
  if (kin.partnerId !== null || kin.ageDays < 16 * 360) return;
  const partner = findCompatiblePartner(world, kin);
  if (partner === null || !world.streams.agents.chance(0.22 + kin.genome.empathy * 0.18)) return;
  kin.partnerId = partner.id;
  partner.partnerId = kin.id;
  kin.needs.belonging = 1;
  partner.needs.belonging = 1;
  emit(world, "pairing", { tribeIds: [kin.tribeId], agentIds: [kin.id, partner.id], pos: { x: kin.x, y: kin.y }, data: {} });
}

function maybeConceive(world: World, kin: Kin): void {
  if (kin.sex !== "f" || kin.partnerId === null || kin.pregnantUntil !== null || kin.ageDays < 16 * 360 || kin.ageDays > 46 * 360) return;
  const partner = world.kin.get(kin.partnerId);
  if (partner === undefined || !partner.alive || distance(kin, partner) > 7) return;
  const capFactor = Math.max(0.025, 1 - livingPopulation(world) / SOFT_CAP);
  const chance = 0.008 * kin.genome.fertility * capFactor;
  if (world.streams.agents.chance(chance)) {
    kin.pregnantUntil = world.tick + GESTATION_DAYS;
    kin.pregnantBy = partner.id;
  }
}

function performAction(world: World, kin: Kin): void {
  const tile = kin.y * WORLD_W + kin.x;
  switch (kin.action) {
    case "forage": {
      const gathered = Math.min(world.map.vegetation[tile], 0.18 + kin.genome.vigor * 0.12);
      world.map.vegetation[tile] -= gathered;
      kin.needs.food = clamp01(kin.needs.food + gathered * 1.8);
      if (gathered > 0.2) kin.renown += 0.004;
      break;
    }
    case "hunt":
      if (world.streams.agents.chance(0.12 + kin.genome.boldness * 0.22)) {
        kin.needs.food = clamp01(kin.needs.food + 0.55);
        kin.renown += 0.05;
      } else {
        kin.needs.rest = clamp01(kin.needs.rest - 0.08);
      }
      break;
    case "rest":
      kin.needs.rest = clamp01(kin.needs.rest + 0.42);
      kin.health = clamp01(kin.health + 0.012);
      break;
    case "seek-warmth":
      kin.needs.warmth = clamp01(kin.needs.warmth + (world.tribes.get(kin.tribeId)?.techs.includes("fire") ? 0.55 : 0.3));
      break;
    case "socialize":
      kin.needs.belonging = clamp01(kin.needs.belonging + 0.4);
      maybePair(world, kin);
      maybeConceive(world, kin);
      break;
    case "migrate":
      if (kin.targetX === kin.x && kin.targetY === kin.y) setTravelTarget(world, kin, 12);
      moveOneStep(world, kin);
      break;
    case "explore":
      if (kin.targetX === kin.x && kin.targetY === kin.y) setTravelTarget(world, kin, 7);
      moveOneStep(world, kin);
      kin.renown += 0.003;
      if (world.map.glimmer[kin.y * WORLD_W + kin.x] === 1) {
        const tribe = world.tribes.get(kin.tribeId);
        if (tribe !== undefined && tribe.lexicon.glimmer === undefined) {
          coin(world, tribe, "glimmer", "glimmer");
          emit(world, "glimmer.found", { tribeIds: [tribe.id], agentIds: [kin.id], pos: { x: kin.x, y: kin.y }, data: {} });
          kin.renown += 3;
        }
      }
      break;
    case "build":
      kin.needs.rest = clamp01(kin.needs.rest - 0.035);
      kin.renown += 0.006 * kin.genome.craft;
      break;
    case "rite":
      if (world.gods.size > 0 && world.streams.agents.chance(0.025)) {
        emit(world, "rite.held", { tribeIds: [kin.tribeId], agentIds: [kin.id], pos: { x: kin.x, y: kin.y }, data: {} });
        kin.needs.belonging = clamp01(kin.needs.belonging + 0.32);
        kin.renown += 0.25;
      }
      break;
    case "idle":
    case "raid":
      break;
  }
}

export function updateKinActions(world: World): void {
  for (const kin of world.kin.values()) {
    if (!kin.alive) continue;
    if (world.tick % 3 === kin.id % 3) kin.action = utilityAction(world, kin);
    performAction(world, kin);
  }
}

function inheritedGenome(world: World, mother: Kin, father: Kin): Genome {
  const genome = {} as Genome;
  for (const gene of GENES) genome[gene] = clamp01((mother.genome[gene] + father.genome[gene]) / 2 + world.streams.agents.jitter(0.025));
  return genome;
}

function birth(world: World, mother: Kin): void {
  const father = mother.pregnantBy === null ? undefined : world.kin.get(mother.pregnantBy);
  mother.pregnantUntil = null;
  mother.pregnantBy = null;
  if (father === undefined || !father.alive) return;
  const tribe = world.tribes.get(mother.tribeId);
  if (tribe === undefined) return;
  const id = world.counters.kin++;
  const child: Kin = {
    id,
    name: makeName(world, tribe, "kin"),
    tribeId: tribe.id,
    x: mother.x,
    y: mother.y,
    ageDays: 0,
    sex: world.streams.agents.chance(0.5) ? "f" : "m",
    genome: inheritedGenome(world, mother, father),
    needs: { food: 0.9, rest: 0.9, warmth: 0.9, belonging: 1 },
    health: 1,
    renown: 0,
    hero: false,
    epithet: null,
    alive: true,
    deathTick: null,
    deathCause: null,
    parents: [mother.id, father.id],
    partnerId: null,
    childIds: [],
    pregnantUntil: null,
    pregnantBy: null,
    memory: [],
    action: "idle",
    targetX: mother.x,
    targetY: mother.y,
  };
  mother.childIds.push(id);
  father.childIds.push(id);
  world.kin.set(id, child);
  tribe.memberIds.push(id);
  emit(world, "birth", { tribeIds: [tribe.id], agentIds: [id, mother.id, father.id], pos: { x: child.x, y: child.y }, data: { population: livingPopulation(world) } });
}

export function killKin(world: World, kin: Kin, cause: "age" | "hunger" | "cold" | "beast" | "war" | "plague"): void {
  if (!kin.alive) return;
  kin.alive = false;
  kin.deathTick = world.tick;
  kin.deathCause = cause;
  if (kin.partnerId !== null) {
    const partner = world.kin.get(kin.partnerId);
    if (partner !== undefined) partner.partnerId = null;
  }
  const tribe = world.tribes.get(kin.tribeId);
  if (tribe !== undefined) coin(world, tribe, "death", "death");
  emit(world, "death", { tribeIds: [kin.tribeId], agentIds: [kin.id], pos: { x: kin.x, y: kin.y }, data: { cause } });
}

function maybePromoteHero(world: World, kin: Kin): void {
  if (kin.hero || kin.renown < HERO_THRESHOLD) return;
  const tribe = world.tribes.get(kin.tribeId);
  if (tribe === undefined) return;
  kin.hero = true;
  kin.epithet = makeName(world, tribe, "epithet");
  emit(world, "hero.risen", { tribeIds: [tribe.id], agentIds: [kin.id], pos: { x: kin.x, y: kin.y }, data: { epithet: kin.epithet } });
}

export function updateLifecycle(world: World): void {
  const living: Kin[] = [];
  for (const kin of world.kin.values()) if (kin.alive) living.push(kin);
  for (const kin of living) {
    if (kin.pregnantUntil !== null && world.tick >= kin.pregnantUntil) birth(world, kin);
    if (!kin.alive) continue;
    if (kin.needs.food <= 0.03) kin.health -= 0.012;
    if (kin.needs.warmth <= 0.03) kin.health -= 0.006;
    else if (kin.needs.food > 0.35) kin.health = clamp01(kin.health + 0.002);
    const ageYears = kin.ageDays / 360;
    const ageHazard = ageYears < 52 ? 0 : ageYears < 70 ? (ageYears - 52) * 0.000001 : 0.00004 + (ageYears - 70) * 0.000012;
    if (kin.health <= 0) killKin(world, kin, kin.needs.food <= 0.03 ? "hunger" : "cold");
    else if (world.streams.agents.chance(ageHazard)) killKin(world, kin, "age");
    else maybePromoteHero(world, kin);
  }
}

export { GESTATION_DAYS, HERO_THRESHOLD, SOFT_CAP };
