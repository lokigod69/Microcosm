import { describe, expect, it } from "vitest";
import { makeStreams } from "../src/sim/rng";
import { BIOMES, WORLD_H, WORLD_W } from "../src/sim/types";
import { generateMap } from "../src/sim/worldgen";

describe("world generation", () => {
  it("creates sane terrain, resources, rivers, and glimmer", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const map = generateMap(makeStreams(seed));
      expect(map.biome).toHaveLength(WORLD_W * WORLD_H);
      let land = 0;
      let rivers = 0;
      let glimmer = 0;
      const seenBiomes = new Set<string>();
      for (let i = 0; i < map.biome.length; i++) {
        const biome = BIOMES[map.biome[i]];
        seenBiomes.add(biome);
        if (biome !== "ocean") land++;
        if (biome === "river") rivers++;
        if (map.glimmer[i] === 1) {
          glimmer++;
          expect(biome).not.toBe("ocean");
        }
        expect(map.elevation[i]).toBeGreaterThanOrEqual(0);
        expect(map.elevation[i]).toBeLessThanOrEqual(1);
        expect(map.fertility[i]).toBeGreaterThanOrEqual(0);
        expect(map.fertility[i]).toBeLessThanOrEqual(1);
      }
      expect(land / map.biome.length).toBeGreaterThan(0.28);
      expect(land / map.biome.length).toBeLessThan(0.82);
      expect(seenBiomes.has("ocean")).toBe(true);
      expect(seenBiomes.has("mountain")).toBe(true);
      expect(rivers).toBeGreaterThan(2);
      expect(glimmer).toBeGreaterThanOrEqual(5);
      expect(glimmer).toBeLessThanOrEqual(9);

      const riverId = BIOMES.indexOf("river");
      const oceanId = BIOMES.indexOf("ocean");
      const coastId = BIOMES.indexOf("coast");
      const visited = new Uint8Array(map.biome.length);
      for (let start = 0; start < map.biome.length; start++) {
        if (map.biome[start] !== riverId || visited[start] === 1) continue;
        const queue = [start];
        visited[start] = 1;
        let reachesWater = false;
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const current = queue[cursor];
          const x = current % WORLD_W;
          const y = Math.floor(current / WORLD_W);
          const neighbors: number[] = [];
          if (x > 0) neighbors.push(current - 1);
          if (x + 1 < WORLD_W) neighbors.push(current + 1);
          if (y > 0) neighbors.push(current - WORLD_W);
          if (y + 1 < WORLD_H) neighbors.push(current + WORLD_W);
          for (const next of neighbors) {
            if (map.biome[next] === oceanId || map.biome[next] === coastId) reachesWater = true;
            if (map.biome[next] === riverId && visited[next] === 0) {
              visited[next] = 1;
              queue.push(next);
            }
          }
        }
        expect(reachesWater).toBe(true);
      }
    }
  });
});
