import { BIOMES, WORLD_H, WORLD_W, idx, type World } from "./types";
import { dayOfSeason, isComet, isEclipse, regrowthFactor, seasonOf } from "./time";
import { emit } from "./events";

function affectedTribes(world: World): number[] {
  return Array.from(world.tribes.values())
    .filter((tribe) => !tribe.extinct)
    .sort((a, b) => a.id - b.id)
    .map((tribe) => tribe.id);
}

function randomLandPosition(world: World): { x: number; y: number } | null {
  const rng = world.streams.climate;
  for (let attempt = 0; attempt < 64; attempt++) {
    const x = rng.int(WORLD_W);
    const y = rng.int(WORLD_H);
    if (BIOMES[world.map.biome[idx(x, y)]] !== "ocean") return { x, y };
  }
  // Deterministic fallback for exceptionally oceanic maps.
  for (let tile = 0; tile < world.map.biome.length; tile++) {
    if (BIOMES[world.map.biome[tile]] !== "ocean") {
      return { x: tile % WORLD_W, y: Math.floor(tile / WORLD_W) };
    }
  }
  return null;
}

/** Advance persistent weather and emit celestial, weather, and seismic omens. */
export function updateWeather(world: World): void {
  const rng = world.streams.climate;
  const season = seasonOf(world.tick);
  const tribes = affectedTribes(world);
  const offset = (world.seed >>> 0) % 1733;

  if (world.weather.drought && world.tick >= world.weather.droughtUntil) {
    world.weather.drought = false;
    world.weather.droughtUntil = 0;
  }

  if (dayOfSeason(world.tick) === 1) {
    if (season === "Long Dark") world.weather.harshWinter = rng.chance(0.24);
    else if (season === "Thaw") world.weather.harshWinter = false;
  }

  const droughtChance = season === "High Sun" ? 0.0028
    : season === "Fall" ? 0.0008
    : 0.00015;
  if (!world.weather.drought && rng.chance(droughtChance)) {
    const duration = 21 + rng.int(43);
    world.weather.drought = true;
    world.weather.droughtUntil = world.tick + duration;
    emit(world, "omen.drought", {
      tribeIds: tribes,
      data: { duration, populationAffected: tribes.length },
    });
  }

  const stormChance = season === "High Sun" ? 0.016
    : season === "Thaw" ? 0.012
    : season === "Fall" ? 0.01
    : 0.006;
  world.weather.stormToday = !world.weather.drought && rng.chance(stormChance);
  if (world.weather.stormToday) {
    emit(world, "omen.storm", {
      tribeIds: tribes,
      data: { harsh: rng.chance(0.18), populationAffected: tribes.length },
    });
  }

  if (isEclipse(world.tick, offset)) {
    emit(world, "omen.eclipse", { tribeIds: tribes, data: { cycle: 587 } });
  }
  if (isComet(world.tick, offset)) {
    emit(world, "omen.comet", { tribeIds: tribes, data: { cycle: 1733 } });
  }
  if (season === "Long Dark" && !world.weather.stormToday && rng.chance(0.012)) {
    emit(world, "omen.aurora", {
      tribeIds: tribes,
      data: { harshWinter: world.weather.harshWinter },
    });
  }

  if (rng.chance(0.00012)) {
    const pos = randomLandPosition(world);
    emit(world, "omen.earthquake", {
      tribeIds: tribes,
      pos,
      data: { populationAffected: tribes.length, magnitude: 4 + rng.int(5) },
    });
  }
}

/** Regrow renewable vegetation stock toward biome fertility. */
export function regrowVegetation(world: World): void {
  let factor = regrowthFactor(seasonOf(world.tick));
  if (world.weather.drought) factor *= 0.5;
  if (world.weather.harshWinter && seasonOf(world.tick) === "Long Dark") factor *= 0.72;
  if (world.weather.stormToday) factor *= 1.08;
  const vegetation = world.map.vegetation;
  const fertility = world.map.fertility;
  const rate = 0.006 * factor;
  for (let i = 0; i < vegetation.length; i++) {
    const next = vegetation[i] + (fertility[i] - vegetation[i]) * rate;
    vegetation[i] = next < 0 ? 0 : next > 1 ? 1 : next;
  }
}

// Clear engine-facing aliases for callers that name systems rather than effects.
export const updateClimate = updateWeather;
export const updateVegetation = regrowVegetation;
