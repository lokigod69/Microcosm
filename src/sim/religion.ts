import { emit } from "./events";
import { borrowWord, coin, makeName } from "./language";
import {
  type God,
  type GodDomain,
  type GodMood,
  type Myth,
  type MythFamily,
  type Tribe,
  type World,
  type WorldEvent,
} from "./types";

const MOODS: readonly GodMood[] = ["wrathful", "generous", "trickster"];

function triggeringDomain(event: WorldEvent): GodDomain | null {
  switch (event.kind) {
    case "omen.eclipse": return "sun";
    case "omen.comet":
    case "omen.aurora": return "moon";
    case "omen.storm": return "storm";
    case "omen.drought": return "harvest";
    case "omen.earthquake": return "glimmer";
    case "plague.start":
    case "plague.end":
    case "settlement.sacked":
    case "war.end": return "death";
    case "beast.attack": return "beasts";
    case "glimmer.found": return "glimmer";
    default: return null;
  }
}

function implicatedTribes(world: World, event: WorldEvent): Tribe[] {
  const result: Tribe[] = [];
  if (event.tribeIds.length > 0) {
    for (const id of event.tribeIds.slice().sort((a, b) => a - b)) {
      const tribe = world.tribes.get(id);
      if (tribe && !tribe.extinct) result.push(tribe);
    }
  } else {
    for (const tribe of [...world.tribes.values()].sort((a, b) => a.id - b.id)) {
      if (!tribe.extinct) result.push(tribe);
    }
  }
  return result;
}

function findSpirit(world: World, tribe: Tribe, domain: GodDomain): God | null {
  const ids = tribe.godIds.slice().sort((a, b) => a - b);
  for (const id of ids) {
    const god = world.gods.get(id);
    if (god && god.tribeId === tribe.id && god.domain === domain) return god;
  }
  return null;
}

function birthSpirit(world: World, tribe: Tribe, domain: GodDomain, event: WorldEvent): God {
  const id = world.counters.god++;
  const god: God = {
    id,
    name: "",
    tribeId: tribe.id,
    domain,
    mood: world.streams.myth.pick(MOODS),
    epithets: [],
    attributions: 1,
    promoted: false,
    originEventId: event.id,
    adoptedByTribeIds: [],
    demonizedByTribeIds: [],
  };
  god.name = makeName(world, tribe, "god");
  world.gods.set(id, god);
  tribe.godIds.push(id);
  coin(world, tribe, domain, domain);
  coin(world, tribe, `god:${id}`, god.name);
  emit(world, "god.born", {
    tribeIds: [tribe.id],
    agentIds: [],
    pos: event.pos,
    data: {
      god: god.name,
      godId: id,
      domain,
      trigger: event.kind.startsWith("omen.") ? event.kind.slice(5) : event.kind.replace(".", " "),
      causeEventId: event.id,
    },
  });
  return god;
}

function word(world: World, tribe: Tribe, concept: string, gloss: string = concept): string {
  return coin(world, tribe, concept, gloss).word;
}

function mythFamilyFor(world: World, event: WorldEvent, domain: GodDomain): MythFamily {
  if (event.kind === "hero.risen" || event.kind === "hero.deed") return "hero-deed";
  if (event.kind === "war.end" || event.kind === "settlement.sacked") return "fall";
  if (event.kind === "omen.eclipse" || event.kind === "omen.comet" || event.kind === "omen.aurora") return "sky-omen";
  if (event.kind === "omen.storm" || event.kind === "plague.end") return "flood";
  if (domain === "beasts" || domain === "glimmer") return "trickster";
  return "origin";
}

function mythLines(
  world: World,
  tribe: Tribe,
  family: MythFamily,
  god: God | null,
  heroName: string | null,
): string[] {
  const deity = god?.name ?? tribe.name;
  const mortal = heroName ?? tribe.name;
  const people = tribe.name;
  const fire = word(world, tribe, "fire", "fire");
  const sea = word(world, tribe, "sea", "sea");
  const death = word(world, tribe, "death", "death");
  const sky = word(world, tribe, "sky", "sky");
  const home = word(world, tribe, "home", "home");
  const star = word(world, tribe, "star", "star");
  const lines: Record<MythFamily, readonly string[][]> = {
    origin: [
      [`Before ${people} had a ${home}, ${deity} carried ${fire} beneath the tongue.`, `The tongue opened; the hearth opened; the people became ${people}.`],
      [`First there was ${sky}, and under ${sky} the name ${deity}.`, `${deity} spoke ${fire}; ${people} answered with their own names.`],
    ],
    trickster: [
      [`${deity} hid ${fire} where no hand could close around it.`, `${mortal} followed the false trail twice, and the true trail once.`],
      [`Three shapes wore the name ${deity}; two lied and one laughed.`, `${people} kept the laughter, and called its price ${death}.`],
    ],
    flood: [
      [`The ${sea} rose once for the stones and twice for the living.`, `${deity} barred no wave, but ${mortal} remembered the road to ${home}.`],
      [`Water covered the old ${home}; water covered its name.`, `${people} spoke ${deity}, and the last fire did not drown.`],
    ],
    "sky-omen": [
      [`A wound crossed ${sky}, bright as the first ${star}.`, `${deity} looked down; ${people} looked up; neither turned away.`],
      [`The ${star} walked where stars do not walk.`, `It bore the sign of ${deity}, and its shadow entered every ${home}.`],
    ],
    "hero-deed": [
      [`${mortal} went where ${death} had already counted the living.`, `${mortal} returned once in body and seven times in song.`],
      [`The path refused ${mortal}; the night refused ${mortal}.`, `${deity} did not refuse, and the deed became a name.`],
    ],
    fall: [
      [`The walls said ${home}; the flames answered ${death}.`, `${people} carried the name away when they could carry nothing else.`],
      [`Pride built high, hunger dug low, and ${deity} waited between.`, `What fell in one night was remembered for nine generations.`],
    ],
  };
  return world.streams.myth.pick(lines[family]).slice();
}

/** Instantiate one of the six deterministic myth template families. */
export function instantiateMyth(
  world: World,
  tribe: Tribe,
  family: MythFamily,
  originEvent: WorldEvent,
  god: God | null = null,
  heroId: number | null = null,
): Myth {
  const existing = world.myths.find((myth) =>
    myth.tribeId === tribe.id && myth.originEventId === originEvent.id && myth.family === family);
  if (existing) return existing;
  const hero = heroId === null ? null : world.kin.get(heroId) ?? null;
  const myth: Myth = {
    id: world.counters.myth++,
    title: makeName(world, tribe, "myth"),
    titleGloss: family,
    family,
    tribeId: tribe.id,
    godId: god?.id ?? null,
    heroId,
    originEventId: originEvent.id,
    tick: world.tick,
    lines: mythLines(world, tribe, family, god, hero?.name ?? null),
  };
  world.myths.push(myth);
  emit(world, "myth.born", {
    tribeIds: [tribe.id],
    agentIds: heroId === null ? [] : [heroId],
    pos: originEvent.pos,
    data: { title: myth.title, family, god: god?.name ?? null, hero: hero?.name ?? null },
  });
  return myth;
}

function promote(world: World, tribe: Tribe, god: God, event: WorldEvent): void {
  if (god.promoted) return;
  god.promoted = true;
  god.epithets.push(makeName(world, tribe, "epithet"));
  emit(world, "god.promoted", {
    tribeIds: [tribe.id],
    agentIds: [],
    pos: event.pos,
    data: { god: god.name, godId: god.id, domain: god.domain, epithet: god.epithets[0], attributions: god.attributions },
  });
  instantiateMyth(world, tribe, mythFamilyFor(world, event, god.domain), event, god, null);
}

/** the word a tribe coins for witnessing a phenomenon, per the salience-gated coinage rule */
const WITNESS_CONCEPT: Partial<Record<WorldEvent["kind"], [string, string]>> = {
  "omen.eclipse": ["eclipse", "sun-death"],
  "omen.comet": ["comet", "burning wanderer"],
  "omen.aurora": ["aurora", "sky-fire"],
  "omen.drought": ["drought", "hunger-wind"],
  "omen.storm": ["storm", "breaking sky"],
  "omen.earthquake": ["earthquake", "world-shudder"],
  "plague.start": ["plague", "creeping death"],
  "beast.attack": ["beast", "tooth in the dark"],
  "glimmer.found": ["glimmer", "buried light"],
  "war.start": ["war", "spear-time"],
};

function attributeEvents(world: World, events: readonly WorldEvent[]): void {
  for (const event of events) {
    const witnessed = WITNESS_CONCEPT[event.kind];
    if (witnessed) {
      for (const tribe of implicatedTribes(world, event)) {
        coin(world, tribe, witnessed[0], witnessed[1]);
      }
    }
    const domain = triggeringDomain(event);
    if (domain === null) continue;
    for (const tribe of implicatedTribes(world, event)) {
      const chance = 0.32 + tribe.culture.spirituality * 0.6;
      if (!world.streams.myth.chance(chance)) continue;
      let god = findSpirit(world, tribe, domain);
      if (god) god.attributions++;
      else god = birthSpirit(world, tribe, domain, event);
      if (god.attributions >= 2) promote(world, tribe, god, event);
      else if (event.kind === "war.end" || event.kind === "plague.end" || event.kind === "settlement.sacked") {
        instantiateMyth(world, tribe, mythFamilyFor(world, event, domain), event, god, null);
      }
    }
  }
}

function heroAndDisasterMyths(world: World, events: readonly WorldEvent[]): void {
  for (const event of events) {
    if (event.kind === "hero.risen") {
      const heroId = event.agentIds[0];
      const tribe = event.tribeIds.length > 0 ? world.tribes.get(event.tribeIds[0]) : undefined;
      if (tribe && heroId !== undefined) instantiateMyth(world, tribe, "hero-deed", event, null, heroId);
    } else if (event.kind === "war.end") {
      for (const tribe of implicatedTribes(world, event)) {
        const god = tribe.godIds.map((id) => world.gods.get(id)).find((candidate) => candidate?.promoted) ?? null;
        instantiateMyth(world, tribe, "fall", event, god, null);
      }
    }
  }
}

function recentDisaster(world: World, tribeId: number): boolean {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i];
    if (event.tick < world.tick - 120) return false;
    if (!event.tribeIds.includes(tribeId) && event.tribeIds.length > 0) continue;
    if (triggeringDomain(event) !== null) return true;
  }
  return false;
}

function holdRites(world: World): void {
  const tribes = [...world.tribes.values()].filter((tribe) => !tribe.extinct).sort((a, b) => a.id - b.id);
  for (const tribe of tribes) {
    if (world.tick % 30 !== (tribe.id * 11) % 30 || !recentDisaster(world, tribe.id)) continue;
    const participants = [...world.kin.values()]
      .filter((kin) => kin.alive && kin.tribeId === tribe.id && kin.action === "rite")
      .sort((a, b) => a.id - b.id);
    if (participants.length === 0) continue;
    const gods = tribe.godIds.map((id) => world.gods.get(id)).filter((god): god is God => god !== undefined);
    gods.sort((a, b) => b.attributions - a.attributions || a.id - b.id);
    const god = gods[0] ?? null;
    for (const kin of participants) {
      kin.needs.belonging = Math.min(1, kin.needs.belonging + 0.22);
      kin.health = Math.min(1, kin.health + 0.015);
      kin.renown += 0.04;
    }
    if (god) god.attributions++;
    emit(world, "rite.held", {
      tribeIds: [tribe.id],
      agentIds: participants.map((kin) => kin.id),
      pos: { x: tribe.homeX, y: tribe.homeY },
      data: { god: god?.name ?? null, participants: participants.length },
    });
  }
}

function syncretism(world: World): void {
  if (world.tick === 0 || world.tick % 180 !== 0) return;
  const tribes = [...world.tribes.values()].filter((tribe) => !tribe.extinct).sort((a, b) => a.id - b.id);
  for (let i = 0; i < tribes.length; i++) {
    const a = tribes[i];
    for (let j = i + 1; j < tribes.length; j++) {
      const b = tribes[j];
      const relation = ((a.relations[b.id] ?? 0) + (b.relations[a.id] ?? 0)) * 0.5;
      if (relation > 0.55) {
        const directions: readonly [Tribe, Tribe][] = [[a, b], [b, a]];
        for (const [borrower, lender] of directions) {
          const candidates = lender.godIds.map((id) => world.gods.get(id))
            .filter((god): god is God => god !== undefined && god.promoted && !god.adoptedByTribeIds.includes(borrower.id))
            .sort((x, y) => x.id - y.id);
          if (candidates.length === 0 || !world.streams.myth.chance(0.16)) continue;
          const god = world.streams.myth.pick(candidates);
          god.adoptedByTribeIds.push(borrower.id);
          if (!borrower.godIds.includes(god.id)) borrower.godIds.push(god.id);
          const concept = `god:${god.id}`;
          if (!borrower.lexicon[concept]) borrowWord(world, borrower, lender, concept);
        }
      } else if (relation < -0.45) {
        const directions: readonly [Tribe, Tribe][] = [[a, b], [b, a]];
        for (const [enemy, owner] of directions) {
          for (const godId of owner.godIds.slice().sort((x, y) => x - y)) {
            const god = world.gods.get(godId);
            if (god?.promoted && !god.demonizedByTribeIds.includes(enemy.id)) {
              god.demonizedByTribeIds.push(enemy.id);
            }
          }
        }
      }
    }
  }
}

/** Spiritual attribution, promotion, rites, syncretism and myth birth. */
export function updateReligion(world: World): void {
  // Snapshot prevents the events emitted by this system from recursively becoming
  // causes during the same tick. Ticks append monotonically, so today's events
  // are a suffix of the log.
  const currentEvents: WorldEvent[] = [];
  for (let i = world.events.length - 1; i >= 0; i--) {
    if (world.events[i].tick !== world.tick) break;
    currentEvents.push(world.events[i]);
  }
  currentEvents.reverse();
  attributeEvents(world, currentEvents);
  heroAndDisasterMyths(world, currentEvents);
  holdRites(world);
  syncretism(world);
}

export const tickReligion = updateReligion;
