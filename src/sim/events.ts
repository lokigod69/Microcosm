import type { EventKind, Kin, World, WorldEvent } from "./types";

export interface EmitPartial {
  tribeIds?: number[];
  agentIds?: number[];
  pos?: { x: number; y: number } | null;
  data?: Record<string, string | number | boolean | null>;
}

/** Relative narrative importance before scale, novelty, and participant renown. */
export const EVENT_BASE_WEIGHT: Record<EventKind, number> = {
  birth: 0.8,
  death: 2.8,
  pairing: 0.7,
  "hero.deed": 5.2,
  "hero.risen": 7,
  "settlement.founded": 5.5,
  "settlement.grown": 4.5,
  "settlement.sacked": 8,
  "tribe.formed": 6,
  "tribe.split": 7,
  "tribe.absorbed": 7.5,
  "chief.crowned": 4,
  "chief.contested": 5.5,
  discovery: 6,
  "tech.spread": 3.5,
  raid: 4.5,
  "war.start": 8,
  "war.end": 8,
  "peace.rite": 5.5,
  "alliance.formed": 5,
  "alliance.broken": 5,
  "trade.opened": 3.5,
  "omen.eclipse": 7,
  "omen.comet": 7,
  "omen.aurora": 3.5,
  "omen.storm": 3,
  "omen.drought": 5,
  "omen.earthquake": 8,
  "plague.start": 8,
  "plague.end": 5,
  "beast.attack": 4,
  "god.born": 8,
  "god.promoted": 8.5,
  "rite.held": 3.5,
  "myth.born": 7,
  "language.coin": 1.2,
  "language.borrow": 1,
  "language.drift": 0.8,
  "glimmer.found": 6,
};

function numeric(data: EmitPartial["data"], key: string): number {
  const value = data?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function eventScale(partial: EmitPartial): number {
  const explicit = numeric(partial.data, "scale");
  if (explicit > 0) return Math.min(5, Math.max(0.25, explicit));
  const opposingLosses = numeric(partial.data, "attackerLosses") +
    numeric(partial.data, "defenderLosses");
  const magnitude = Math.max(
    numeric(partial.data, "casualties"),
    numeric(partial.data, "populationAffected"),
    numeric(partial.data, "affected"),
    numeric(partial.data, "population"),
    numeric(partial.data, "losses"),
    opposingLosses,
  );
  return Math.min(4, 1 + Math.log2(1 + magnitude) * 0.25);
}

function renownMultiplier(world: World, agentIds: readonly number[]): number {
  let maximum = 0;
  for (let i = 0; i < agentIds.length; i++) {
    const kin = world.kin.get(agentIds[i]);
    if (kin !== undefined && kin.renown > maximum) maximum = kin.renown;
  }
  // Unknown people still have a neutral multiplier; renowned heroes can quadruple it.
  return 1 + Math.min(3, maximum / 25);
}

function remember(kin: Kin, eventId: number, weight: number): void {
  kin.memory.push({ eventId, weight });
  if (kin.memory.length <= 12) return;
  let weakest = 0;
  for (let i = 1; i < kin.memory.length; i++) {
    const candidate = kin.memory[i];
    const current = kin.memory[weakest];
    if (candidate.weight < current.weight ||
        (candidate.weight === current.weight && candidate.eventId < current.eventId)) {
      weakest = i;
    }
  }
  kin.memory.splice(weakest, 1);
}

function witnesses(world: World, tribeIds: readonly number[], agentIds: readonly number[]): number[] {
  const ids = new Set<number>();
  for (let i = 0; i < agentIds.length; i++) ids.add(agentIds[i]);
  for (let i = 0; i < tribeIds.length; i++) {
    const tribe = world.tribes.get(tribeIds[i]);
    if (tribe === undefined) continue;
    for (let m = 0; m < tribe.memberIds.length; m++) ids.add(tribe.memberIds[m]);
  }
  return Array.from(ids).sort((a, b) => a - b);
}

/** Compute salience, append the event, and place it in affected kin memories. */
export function emit(world: World, kind: EventKind, partial: EmitPartial = {}): WorldEvent {
  const tribeIds = (partial.tribeIds ?? []).slice();
  const agentIds = (partial.agentIds ?? []).slice();
  const novelty = world.caches.seenKinds.has(kind) ? 1 : 1.75;
  world.caches.seenKinds.add(kind);
  const salience = EVENT_BASE_WEIGHT[kind] * eventScale(partial) * novelty *
    renownMultiplier(world, agentIds);
  const event: WorldEvent = {
    id: world.counters.event++,
    tick: world.tick,
    kind,
    tribeIds,
    agentIds,
    pos: partial.pos === undefined || partial.pos === null
      ? null
      : { x: partial.pos.x, y: partial.pos.y },
    data: partial.data === undefined ? {} : { ...partial.data },
    salience,
  };
  world.events.push(event);

  const memoryWeight = Math.min(1, salience / 20);
  const witnessIds = witnesses(world, tribeIds, agentIds);
  for (let i = 0; i < witnessIds.length; i++) {
    const kin = world.kin.get(witnessIds[i]);
    if (kin !== undefined && kin.alive) remember(kin, event.id, memoryWeight);
  }
  return event;
}
