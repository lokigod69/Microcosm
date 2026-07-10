import { BIOMES, WORLD_H, WORLD_W, idx, type Biome, type WorldMap } from "./types";
import type { Rng, Streams } from "./rng";

const TILE_COUNT = WORLD_W * WORLD_H;
const SEA_LEVEL = 0.34;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function biomeId(biome: Biome): number {
  return BIOMES.indexOf(biome);
}

interface NoiseLayer {
  width: number;
  height: number;
  values: Float32Array;
}

function makeNoiseLayer(rng: Rng, width: number, height: number): NoiseLayer {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = rng.next();
  return { width, height, values };
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

/** Bilinearly interpolated deterministic value noise over a finite lattice. */
function sampleLayer(layer: NoiseLayer, x: number, y: number): number {
  const gx = (x / (WORLD_W - 1)) * (layer.width - 1);
  const gy = (y / (WORLD_H - 1)) * (layer.height - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(x0 + 1, layer.width - 1);
  const y1 = Math.min(y0 + 1, layer.height - 1);
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);
  const a = layer.values[y0 * layer.width + x0];
  const b = layer.values[y0 * layer.width + x1];
  const c = layer.values[y1 * layer.width + x0];
  const d = layer.values[y1 * layer.width + x1];
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function layeredNoise(layers: readonly NoiseLayer[], x: number, y: number): number {
  let value = 0;
  let amplitude = 1;
  let total = 0;
  for (let i = 0; i < layers.length; i++) {
    value += sampleLayer(layers[i], x, y) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  return value / total;
}

function isOcean(map: WorldMap, x: number, y: number): boolean {
  return map.biome[idx(x, y)] === biomeId("ocean");
}

function isBesideOcean(map: WorldMap, x: number, y: number): boolean {
  if (x > 0 && isOcean(map, x - 1, y)) return true;
  if (x + 1 < WORLD_W && isOcean(map, x + 1, y)) return true;
  if (y > 0 && isOcean(map, x, y - 1)) return true;
  return y + 1 < WORLD_H && isOcean(map, x, y + 1);
}

function classify(elevation: number, moisture: number, temperature: number): Biome {
  if (elevation < SEA_LEVEL) return "ocean";
  if (elevation > 0.88 || (elevation > 0.76 && temperature < 0.25)) return "snow";
  if (elevation > 0.78) return "mountain";
  if (elevation > 0.67) return "hills";
  if (moisture > 0.82 && elevation < 0.48) return "marsh";
  if (temperature > 0.7 && moisture > 0.65) return "jungle";
  if (moisture > 0.61) return "forest";
  if (temperature > 0.62 && moisture > 0.34) return "savanna";
  if (moisture < 0.23) return "desert";
  return "grassland";
}

function fertilityFor(biome: Biome, moisture: number): number {
  let base: number;
  switch (biome) {
    case "ocean": base = 0.05; break;
    case "coast": base = 0.5; break;
    case "river": base = 0.82; break;
    case "grassland": base = 0.7; break;
    case "forest": base = 0.72; break;
    case "jungle": base = 0.76; break;
    case "savanna": base = 0.53; break;
    case "desert": base = 0.09; break;
    case "marsh": base = 0.68; break;
    case "hills": base = 0.4; break;
    case "mountain": base = 0.14; break;
    case "snow": base = 0.04; break;
  }
  return clamp01(base * (0.55 + moisture * 0.65));
}

/** Manhattan distance to the nearest ocean tile, used to make rivers escape basins. */
function oceanDistances(map: WorldMap): Uint16Array {
  const unreachable = 0xffff;
  const distance = new Uint16Array(TILE_COUNT);
  distance.fill(unreachable);
  const queue = new Int32Array(TILE_COUNT);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < TILE_COUNT; i++) {
    if (map.biome[i] === biomeId("ocean")) {
      distance[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const current = queue[head++];
    const x = current % WORLD_W;
    const y = Math.floor(current / WORLD_W);
    const nextDistance = distance[current] + 1;
    if (x > 0 && distance[current - 1] === unreachable) {
      distance[current - 1] = nextDistance; queue[tail++] = current - 1;
    }
    if (x + 1 < WORLD_W && distance[current + 1] === unreachable) {
      distance[current + 1] = nextDistance; queue[tail++] = current + 1;
    }
    if (y > 0 && distance[current - WORLD_W] === unreachable) {
      distance[current - WORLD_W] = nextDistance; queue[tail++] = current - WORLD_W;
    }
    if (y + 1 < WORLD_H && distance[current + WORLD_W] === unreachable) {
      distance[current + WORLD_W] = nextDistance; queue[tail++] = current + WORLD_W;
    }
  }
  return distance;
}

function neighborIndices(index: number, out: Int32Array): number {
  const x = index % WORLD_W;
  const y = Math.floor(index / WORLD_W);
  let count = 0;
  if (x > 0) out[count++] = index - 1;
  if (x + 1 < WORLD_W) out[count++] = index + 1;
  if (y > 0) out[count++] = index - WORLD_W;
  if (y + 1 < WORLD_H) out[count++] = index + WORLD_W;
  return count;
}

function traceRivers(map: WorldMap, rng: Rng): void {
  const distance = oceanDistances(map);
  const candidates: number[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    if (map.elevation[i] > 0.72 && distance[i] > 5 && map.biome[i] !== biomeId("snow")) {
      candidates.push(i);
    }
  }
  // Snowy sources are valid if this world has few temperate mountains.
  if (candidates.length < 4) {
    for (let i = 0; i < TILE_COUNT; i++) {
      if (map.elevation[i] > 0.68 && distance[i] > 4 && map.biome[i] !== biomeId("ocean")) {
        candidates.push(i);
      }
    }
  }

  const desired = 2 + rng.int(3);
  const sources: number[] = [];
  while (candidates.length > 0 && sources.length < desired) {
    const pick = rng.int(candidates.length);
    const source = candidates[pick];
    candidates[pick] = candidates[candidates.length - 1];
    candidates.pop();
    let separated = true;
    const sx = source % WORLD_W;
    const sy = Math.floor(source / WORLD_W);
    for (let i = 0; i < sources.length; i++) {
      const ox = sources[i] % WORLD_W;
      const oy = Math.floor(sources[i] / WORLD_W);
      if (Math.abs(sx - ox) + Math.abs(sy - oy) < 12) separated = false;
    }
    if (separated) sources.push(source);
  }

  const neighbors = new Int32Array(4);
  const visited = new Uint8Array(TILE_COUNT);
  for (let river = 0; river < sources.length; river++) {
    visited.fill(0);
    let current = sources[river];
    for (let step = 0; step < TILE_COUNT; step++) {
      visited[current] = 1;
      if (map.biome[current] !== biomeId("ocean") && map.biome[current] !== biomeId("coast")) {
        map.biome[current] = biomeId("river");
        map.moisture[current] = Math.max(map.moisture[current], 0.78);
      }
      if (distance[current] <= 1) break;

      const count = neighborIndices(current, neighbors);
      let chosen = -1;
      let bestElevation = Number.POSITIVE_INFINITY;
      const currentElevation = map.elevation[current];
      // Natural downhill flow takes precedence.
      for (let n = 0; n < count; n++) {
        const next = neighbors[n];
        if (visited[next] !== 0 || map.biome[next] === biomeId("ocean")) continue;
        const elevation = map.elevation[next];
        if (elevation < currentElevation - 0.00001 && elevation < bestElevation) {
          chosen = next;
          bestElevation = elevation;
        }
      }
      // Escape a local basin along the shortest route to the sea, carving a tiny grade.
      if (chosen < 0) {
        let bestDistance = 0xffff;
        for (let n = 0; n < count; n++) {
          const next = neighbors[n];
          if (visited[next] !== 0) continue;
          const nextDistance = distance[next];
          if (nextDistance < bestDistance ||
              (nextDistance === bestDistance && map.elevation[next] < bestElevation)) {
            chosen = next;
            bestDistance = nextDistance;
            bestElevation = map.elevation[next];
          }
        }
        if (chosen >= 0 && map.biome[chosen] !== biomeId("ocean")) {
          map.elevation[chosen] = Math.max(SEA_LEVEL + 0.001, currentElevation - 0.001);
        }
      }
      if (chosen < 0 || map.biome[chosen] === biomeId("ocean")) break;
      current = chosen;
    }
  }
}

function finishResources(map: WorldMap): void {
  for (let i = 0; i < TILE_COUNT; i++) {
    const biome = BIOMES[map.biome[i]];
    const fertility = fertilityFor(biome, map.moisture[i]);
    map.fertility[i] = fertility;
    map.vegetation[i] = fertility * (0.72 + map.moisture[i] * 0.28);
    map.wood[i] = biome === "forest" || biome === "jungle" ? 0.9
      : biome === "savanna" ? 0.38
      : biome === "marsh" ? 0.3
      : biome === "grassland" ? 0.14
      : 0.04;
    map.stone[i] = biome === "mountain" ? 0.96
      : biome === "hills" ? 0.72
      : biome === "river" ? 0.4
      : biome === "snow" ? 0.55
      : 0.18;
  }
}

function placeGlimmer(map: WorldMap, rng: Rng): void {
  const candidates: number[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    const biome = BIOMES[map.biome[i]];
    if (biome !== "ocean" && biome !== "coast" && biome !== "river") candidates.push(i);
  }
  const count = 5 + rng.int(5);
  for (let n = 0; n < count && candidates.length > 0; n++) {
    const weightedPick = rng.int(candidates.length);
    const chosen = candidates[weightedPick];
    map.glimmer[chosen] = 1;
    candidates[weightedPick] = candidates[candidates.length - 1];
    candidates.pop();
  }
}

/** Generate the immutable terrain fields and initial renewable stocks. */
export function generateMap(streams: Streams): WorldMap {
  const rng = streams.worldgen;
  const elevationLayers = [
    makeNoiseLayer(rng, 5, 4),
    makeNoiseLayer(rng, 10, 7),
    makeNoiseLayer(rng, 20, 14),
  ];
  const moistureLayers = [
    makeNoiseLayer(rng, 4, 4),
    makeNoiseLayer(rng, 9, 7),
    makeNoiseLayer(rng, 18, 13),
  ];
  // Broad noise does not guarantee a high summit for every seed. A handful of
  // noise-shaped interior uplifts ensure every world has headwaters without
  // replacing the value-noise terrain itself.
  const uplifts: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    uplifts.push({
      x: 14 + rng.int(WORLD_W - 28),
      y: 16 + rng.int(WORLD_H - 32),
    });
  }
  const map: WorldMap = {
    biome: new Uint8Array(TILE_COUNT),
    elevation: new Float32Array(TILE_COUNT),
    moisture: new Float32Array(TILE_COUNT),
    temperature: new Float32Array(TILE_COUNT),
    fertility: new Float32Array(TILE_COUNT),
    vegetation: new Float32Array(TILE_COUNT),
    wood: new Float32Array(TILE_COUNT),
    stone: new Float32Array(TILE_COUNT),
    glimmer: new Uint8Array(TILE_COUNT),
  };

  for (let y = 0; y < WORLD_H; y++) {
    let carriedMoisture = 0.72;
    for (let x = 0; x < WORLD_W; x++) {
      const tile = idx(x, y);
      const nx = (x / (WORLD_W - 1)) * 2 - 1;
      const ny = (y / (WORLD_H - 1)) * 2 - 1;
      const edge = Math.max(Math.abs(nx), Math.abs(ny));
      const terrain = layeredNoise(elevationLayers, x, y);
      let broad = 0.56 + (terrain - 0.5) * 0.92 - Math.pow(edge, 3.2) * 0.48;
      for (let peak = 0; peak < uplifts.length; peak++) {
        const dx = x - uplifts[peak].x;
        const dy = y - uplifts[peak].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 9) broad = Math.max(broad, 0.84 - distance * 0.035);
      }
      const elevation = clamp01(broad);
      map.elevation[tile] = elevation;

      const wetNoise = layeredNoise(moistureLayers, x, y);
      if (elevation < SEA_LEVEL) carriedMoisture = 0.96;
      else {
        carriedMoisture = Math.max(0.12, carriedMoisture - 0.006);
        if (elevation > 0.7) carriedMoisture *= 0.58; // west-to-east rain shadow
      }
      const moisture = clamp01(wetNoise * 0.56 + carriedMoisture * 0.44);
      map.moisture[tile] = moisture;
      const latitudeWarmth = 1 - Math.abs(ny) * 0.72;
      map.temperature[tile] = clamp01(latitudeWarmth - elevation * 0.34 + 0.16);
      map.biome[tile] = biomeId(classify(elevation, moisture, map.temperature[tile]));
    }
  }

  // Low land touching the sea is coast even when its raw climate resembles grassland.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const tile = idx(x, y);
      if (map.biome[tile] !== biomeId("ocean") &&
          (map.elevation[tile] < 0.39 || isBesideOcean(map, x, y))) {
        map.biome[tile] = biomeId("coast");
      }
    }
  }

  traceRivers(map, rng);
  finishResources(map);
  placeGlimmer(map, rng);
  return map;
}
