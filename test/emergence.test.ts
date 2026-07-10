import { describe, expect, it } from "vitest";
import { createWorld, tickWorld } from "../src/sim/engine";

describe("emergent worlds", () => {
  for (let seed = 1; seed <= 5; seed++) {
    it(`keeps seed ${seed} alive for twenty-five years`, () => {
      const world = createWorld(seed);
      for (let tick = 0; tick < 9000; tick++) tickWorld(world);
      const tribes = [...world.tribes.values()].filter((tribe) => !tribe.extinct);
      let concepts = 0;
      for (const tribe of world.tribes.values()) concepts += Object.keys(tribe.lexicon).length;
      let population = 0;
      for (const kin of world.kin.values()) if (kin.alive) population++;
      const mythChapters = world.chronicle.filter((chapter) => chapter.myth.some((paragraph) => paragraph.trim().length > 0));

      expect(tribes.length).toBeGreaterThanOrEqual(2);
      expect(world.gods.size).toBeGreaterThanOrEqual(1);
      expect(world.myths.length).toBeGreaterThanOrEqual(1);
      expect(concepts).toBeGreaterThanOrEqual(30);
      expect(population).toBeGreaterThanOrEqual(30);
      expect(mythChapters.length).toBeGreaterThanOrEqual(3);

      // invariants: bounded growth, finite in-range vitals, no dead kin acting,
      // no chief serving a tribe they no longer belong to
      expect(population).toBeLessThanOrEqual(2000);
      for (const kin of world.kin.values()) {
        if (!kin.alive) {
          expect(kin.deathTick).not.toBeNull();
          continue;
        }
        expect(kin.health).toBeGreaterThanOrEqual(0);
        expect(kin.health).toBeLessThanOrEqual(1);
        for (const need of Object.values(kin.needs)) {
          expect(Number.isFinite(need)).toBe(true);
          expect(need).toBeGreaterThanOrEqual(0);
          expect(need).toBeLessThanOrEqual(1);
        }
        for (const gene of Object.values(kin.genome)) {
          expect(Number.isFinite(gene)).toBe(true);
        }
      }
      for (const tribe of world.tribes.values()) {
        if (tribe.extinct || tribe.chiefId === null) continue;
        const chief = world.kin.get(tribe.chiefId);
        if (chief?.alive) expect(chief.tribeId).toBe(tribe.id);
      }
    }, 30_000);
  }
});
