import { emit } from "./events";
import { coin } from "./language";
import { BIOMES, TECHS, idx, type Tech, type Tribe, type World } from "./types";

const PREREQUISITES: Record<Tech, readonly Tech[]> = {
  fire: [],
  tools: ["fire"],
  shelter: ["tools"],
  fishing: ["tools"],
  boats: ["fishing"],
  weaving: ["tools"],
  pottery: ["fire", "tools"],
  "herbal-lore": ["tools"],
  bronze: ["fire", "tools", "pottery"],
  writing: ["pottery", "weaving"],
  astronomy: ["writing"],
};

const RELATED_CONCEPT: Record<Tech, string> = {
  fire: "flame",
  tools: "making",
  shelter: "home",
  fishing: "fish",
  boats: "voyage",
  weaving: "cloth",
  pottery: "vessel",
  "herbal-lore": "healing",
  bronze: "metal",
  writing: "mark",
  astronomy: "star",
};

function members(world: World, tribeId: number) {
  const result = [];
  for (const kin of world.kin.values()) {
    if (kin.alive && kin.tribeId === tribeId) result.push(kin);
  }
  result.sort((a, b) => a.id - b.id);
  return result;
}

function nextAvailable(tribe: Tribe): Tech[] {
  const unlocked = new Set<Tech>(tribe.techs);
  const available: Tech[] = [];
  for (const tech of TECHS) {
    if (unlocked.has(tech)) continue;
    if (PREREQUISITES[tech].every((required) => unlocked.has(required))) available.push(tech);
  }
  return available;
}

function unlockChance(world: World, tribe: Tribe, tech: Tech): number {
  const people = members(world, tribe.id);
  if (people.length === 0) return 0;
  let curiosity = 0;
  let craft = 0;
  let cold = 0;
  let hunger = 0;
  let coastal = 0;
  for (const kin of people) {
    curiosity += kin.genome.curiosity;
    craft += kin.genome.craft;
    cold += 1 - kin.needs.warmth;
    hunger += 1 - kin.needs.food;
    const biome = BIOMES[world.map.biome[idx(Math.round(kin.x), Math.round(kin.y))]];
    if (biome === "coast" || biome === "river" || biome === "ocean") coastal++;
  }
  const n = people.length;
  let pressure = (cold + hunger) / (2 * n);
  if (tech === "fire" || tech === "shelter") pressure += cold / n;
  if (tech === "fishing" || tech === "boats") pressure += coastal / n;
  if (tech === "herbal-lore") pressure += people.filter((kin) => kin.health < 0.65).length / n;
  // About one discovery per 1–3 years for an average early tribe. Sequential
  // prerequisites still make the complete ladder a generational achievement.
  const populationFactor = Math.min(1.8, 0.75 + n / 40);
  return (0.00075 + (curiosity / n) * 0.0007 + (craft / n) * 0.00065 + pressure * 0.00035) * populationFactor;
}

function unlock(world: World, tribe: Tribe, tech: Tech, spreadFrom: Tribe | null): void {
  if (tribe.techs.includes(tech)) return;
  tribe.techs.push(tech);
  tribe.techs.sort((a, b) => TECHS.indexOf(a) - TECHS.indexOf(b));
  coin(world, tribe, tech, tech);
  coin(world, tribe, RELATED_CONCEPT[tech], RELATED_CONCEPT[tech]);
  emit(world, spreadFrom ? "tech.spread" : "discovery", {
    tribeIds: spreadFrom ? [spreadFrom.id, tribe.id] : [tribe.id],
    agentIds: tribe.chiefId === null ? [] : [tribe.chiefId],
    pos: { x: tribe.homeX, y: tribe.homeY },
    data: { tech, from: spreadFrom?.name ?? null, tribe: tribe.name },
  });
}

function spreadFriendlyTech(world: World, tribes: readonly Tribe[]): void {
  for (let i = 0; i < tribes.length; i++) {
    const a = tribes[i];
    for (let j = i + 1; j < tribes.length; j++) {
      const b = tribes[j];
      const relation = ((a.relations[b.id] ?? 0) + (b.relations[a.id] ?? 0)) * 0.5;
      if (relation < 0.3) continue;
      if (!world.streams.events.chance(0.0008 * (0.5 + relation))) continue;
      const aOnly = a.techs.filter((tech) => !b.techs.includes(tech) && PREREQUISITES[tech].every((p) => b.techs.includes(p)));
      const bOnly = b.techs.filter((tech) => !a.techs.includes(tech) && PREREQUISITES[tech].every((p) => a.techs.includes(p)));
      if (aOnly.length > 0 && (bOnly.length === 0 || world.streams.events.chance(0.5))) {
        unlock(world, b, world.streams.events.pick(aOnly), a);
      } else if (bOnly.length > 0) {
        unlock(world, a, world.streams.events.pick(bOnly), b);
      }
    }
  }
}

/** Pressure-driven independent invention, followed by friendly diffusion. */
export function updateDiscovery(world: World): void {
  const tribes = [...world.tribes.values()]
    .filter((tribe) => !tribe.extinct)
    .sort((a, b) => a.id - b.id);
  for (const tribe of tribes) {
    const available = nextAvailable(tribe);
    if (available.length === 0) continue;
    const weights = available.map((tech) => unlockChance(world, tribe, tech));
    let chance = 0;
    for (const weight of weights) chance += weight;
    if (world.streams.events.chance(chance)) {
      unlock(world, tribe, available[world.streams.events.weighted(weights)], null);
    }
  }
  spreadFriendlyTech(world, tribes);
}

export const tickDiscovery = updateDiscovery;
