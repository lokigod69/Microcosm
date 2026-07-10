import { describe, expect, it } from "vitest";
import { createWorld } from "../src/sim/engine";
import { borrowWord, coin, driftLanguages } from "../src/sim/language";
import type { Phonology } from "../src/sim/types";

function soundsOf(word: string, phonology: Phonology): string[] | null {
  const inventory = phonology.consonants.concat(phonology.vowels).sort((a, b) => b.length - a.length);
  const lower = word.toLowerCase();
  const sounds: string[] = [];
  let cursor = 0;
  while (cursor < lower.length) {
    const sound = inventory.find((candidate) => lower.startsWith(candidate, cursor));
    if (sound === undefined) return null;
    sounds.push(sound);
    cursor += sound.length;
  }
  return sounds;
}

describe("language", () => {
  it("generates valid phonologies and pronounceable coinages", () => {
    const world = createWorld(12);
    for (const tribe of world.tribes.values()) {
      expect(tribe.phonology.consonants.length).toBeGreaterThanOrEqual(7);
      expect(tribe.phonology.consonants.length).toBeLessThanOrEqual(12);
      expect(tribe.phonology.vowels.length).toBeGreaterThanOrEqual(3);
      expect(tribe.phonology.vowels.length).toBeLessThanOrEqual(5);
      expect(tribe.phonology.patterns.length).toBeGreaterThanOrEqual(2);
      expect(tribe.phonology.patterns.length).toBeLessThanOrEqual(4);
      const entry = coin(world, tribe, "test-concept", "test concept");
      expect(soundsOf(entry.word, tribe.phonology)).not.toBeNull();
    }
  });

  it("preserves old forms during drift", () => {
    const world = createWorld(18);
    const tribe = [...world.tribes.values()][0];
    for (let i = 0; i < 40; i++) coin(world, tribe, `drift-${i}`, `drift ${i}`);
    for (const id of tribe.memberIds) {
      const kin = world.kin.get(id);
      if (kin !== undefined) kin.genome.voice = 1;
    }
    for (let year = 0; year < 20; year++) driftLanguages(world);
    expect(Object.values(tribe.lexicon).some((entry) => entry.oldForms.length > 0)).toBe(true);
  });

  it("adapts borrowed words to the receiving phonology", () => {
    const world = createWorld(27);
    const tribes = [...world.tribes.values()].sort((a, b) => a.id - b.id);
    expect(tribes.length).toBeGreaterThanOrEqual(2);
    const lender = tribes[0];
    const borrower = tribes[1];
    coin(world, lender, "foreign-test", "foreign test");
    const borrowed = borrowWord(world, borrower, lender, "foreign-test");
    expect(borrowed).not.toBeNull();
    expect(borrowed?.borrowedFrom).toBe(lender.id);
    expect(soundsOf(borrowed?.word ?? "", borrower.phonology)).not.toBeNull();
  });
});
