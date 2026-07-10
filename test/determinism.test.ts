import { describe, expect, it } from "vitest";
import { createWorld, tickWorld } from "../src/sim/engine";

function run(seed: number, ticks: number) {
  const world = createWorld(seed);
  for (let i = 0; i < ticks; i++) tickWorld(world);
  return world;
}

describe("simulation determinism", () => {
  it("replays seed 42 with identical events and chronicle text", () => {
    const first = run(42, 3600);
    const second = run(42, 3600);
    expect(first.events).toEqual(second.events);
    expect(first.chronicle).toEqual(second.chronicle);
  });

  it("separates different seeds", () => {
    const first = run(41, 900);
    const second = run(42, 900);
    expect(JSON.stringify(first.events)).not.toBe(JSON.stringify(second.events));
    expect(first.name).not.toBe(second.name);
  });
});
