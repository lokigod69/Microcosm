// The two voices of the chronicle. Observer: cold, dated, quantified. Myth: the
// same facts through the dominant tribe's lens — their words (marked *word*, the
// panels italicize them), their gods, their formulas. Every phrasing choice draws
// from the `chronicle` stream so the text is part of the determinism invariant.

import { dayOfSeason, seasonOf, yearOf } from "../sim/time";
import type { God, GodDomain, Kin, Tribe, World, WorldEvent } from "../sim/types";

// ---------- small helpers ----------

function num(event: WorldEvent, key: string, fallback = 0): number {
  const value = event.data[key];
  return typeof value === "number" ? value : fallback;
}

function str(event: WorldEvent, key: string, fallback: string): string {
  const value = event.data[key];
  return typeof value === "string" ? value : fallback;
}

function aan(noun: string): string {
  return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function tribeFor(world: World, event: WorldEvent): Tribe | undefined {
  for (const id of event.tribeIds) {
    const tribe = world.tribes.get(id);
    if (tribe !== undefined) return tribe;
  }
  return undefined;
}

function tribeName(world: World, id: number | undefined): string {
  if (id === undefined) return "an unnamed people";
  return world.tribes.get(id)?.name ?? "a forgotten people";
}

function kinRef(world: World, id: number | undefined): Kin | undefined {
  return id === undefined ? undefined : world.kin.get(id);
}

/** nearest living settlement within a few tiles, for humane place references */
function placeName(world: World, event: WorldEvent): string | null {
  if (!event.pos) return null;
  let best: string | null = null;
  let bestD = 5;
  for (const s of world.settlements.values()) {
    if (s.sacked) continue;
    const d = Math.hypot(s.x - event.pos.x, s.y - event.pos.y);
    if (d < bestD) {
      bestD = d;
      best = s.name;
    }
  }
  return best;
}

function where(world: World, event: WorldEvent): string {
  const p = placeName(world, event);
  if (p) return `near ${p}`;
  if (event.pos) return `at ${event.pos.x},${event.pos.y}`;
  return "in the open country";
}

const DOMAIN_EPITHET: Record<GodDomain, string> = {
  sun: "who carries the sun",
  sea: "of the deep water",
  death: "who walks behind",
  harvest: "who gives and withholds",
  storm: "of the breaking sky",
  moon: "of the pale lamp",
  beasts: "master of beasts",
  glimmer: "of the buried light",
};

function godRef(god: God, firstUse: boolean): string {
  if (firstUse) return `${god.name}, ${DOMAIN_EPITHET[god.domain]}`;
  if (god.epithets.length > 0) return `${god.name}, called *${god.epithets[0]}*`;
  return god.name;
}

function relevantGod(world: World, tribe: Tribe | undefined, event: WorldEvent): God | undefined {
  const eventGod = world.gods.get(num(event, "godId", -1));
  if (eventGod !== undefined) return eventGod;
  if (tribe === undefined) return undefined;
  let best: God | undefined;
  for (const id of tribe.godIds) {
    const god = world.gods.get(id);
    if (god === undefined) continue;
    if (best === undefined || god.attributions > best.attributions) best = god;
  }
  return best;
}

/** The tribe's own word for a concept: first use "*word*, the <gloss>", after that "*word*". */
function inWord(tribe: Tribe | undefined, concept: string, gloss: string, used: Set<string>): string {
  const entry = tribe?.lexicon[concept];
  if (!entry) return `the ${gloss}`;
  if (used.has(concept)) return `*${entry.word}*`;
  used.add(concept);
  return `*${entry.word}*, the ${gloss}`;
}

/** concept + English gloss a myth line should lean on, or null if the kind isn't mythworthy */
function mythConcept(event: WorldEvent): { concept: string; gloss: string } | null {
  switch (event.kind) {
    case "omen.eclipse": return { concept: "eclipse", gloss: "sun-death" };
    case "omen.comet": return { concept: "comet", gloss: "burning wanderer" };
    case "omen.aurora": return { concept: "aurora", gloss: "sky-fire" };
    case "omen.drought": return { concept: "drought", gloss: "hunger-wind" };
    case "omen.storm": return { concept: "storm", gloss: "breaking sky" };
    case "omen.earthquake": return { concept: "earthquake", gloss: "world-shudder" };
    case "plague.start":
    case "plague.end": return { concept: "plague", gloss: "creeping death" };
    case "war.start":
    case "war.end":
    case "raid": return { concept: "war", gloss: "spear-time" };
    case "beast.attack": return { concept: "beast", gloss: "tooth in the dark" };
    case "glimmer.found": return { concept: "glimmer", gloss: "buried light" };
    case "discovery": {
      const tech = (event.data["tech"] as string) ?? "craft";
      return { concept: tech, gloss: tech };
    }
    case "death": return { concept: "death", gloss: "long silence" };
    default: return null;
  }
}

// ---------- titles ----------

export function titleFor(world: World, event: WorldEvent | undefined): string {
  const rng = world.streams.chronicle;
  if (event === undefined) return `The Quiet ${seasonOf(Math.max(0, world.tick - 1))}`;
  const tribe = tribeFor(world, event);
  const people = tribe?.name ?? world.name;
  const god = world.gods.get(num(event, "godId", -1));
  const pick = (arr: string[]) => arr[rng.int(arr.length)];

  switch (event.kind) {
    case "omen.eclipse":
      return pick(["When the Sun Went Out", "The Eaten Sun", `The Darkness over ${people}`]);
    case "omen.comet":
      return pick(["The Burning Wanderer", "A Fire Crossed the Sky"]);
    case "omen.drought":
      return pick(["The Year of Dust", `The Thirst of ${people}`, "The Hunger-Wind"]);
    case "omen.earthquake":
      return pick(["When the Ground Spoke", "The World-Shudder"]);
    case "plague.start":
      return pick([`The Creeping Death`, `The Sickness of ${people}`]);
    case "god.born":
    case "god.promoted":
      return god ? pick([`The Coming of ${god.name}`, `${god.name} Is Named`]) : `A New Power over ${people}`;
    case "myth.born":
      return pick([`A Tale Takes Root among the ${people}`, `The ${people} Begin a Story`]);
    case "war.start":
      return pick([`The Spears Go Up`, `${tribeName(world, event.tribeIds[0])} against ${tribeName(world, event.tribeIds[1])}`]);
    case "war.end":
      return pick([`The Spears Come Down`, `A Peace between ${tribeName(world, event.tribeIds[0])} and ${tribeName(world, event.tribeIds[1])}`]);
    case "raid":
      return pick([`Fire in the Night`, `The Raid ${cap(where(world, event))}`]);
    case "discovery":
      return pick([`How the ${people} Learned ${cap(str(event, "tech", "a New Craft"))}`, `The Gift of ${cap(str(event, "tech", "Craft"))}`]);
    case "settlement.founded":
      return pick([`The First Post ${cap(where(world, event))}`, `A Home for the ${people}`]);
    case "settlement.sacked":
      return pick([`The Burning ${cap(where(world, event))}`, `Ash where a Home Stood`]);
    case "tribe.split":
      return pick([`The ${people} Divide`, `Two Fires from One`]);
    case "tribe.formed":
      return pick([`The ${people} Become a People`, `The Naming of the ${people}`]);
    case "hero.risen":
      return pick([`${kinRef(world, event.agentIds[0])?.name ?? "A Kin"} of the ${people}`, `A Name Is Made`]);
    case "glimmer.found":
      return pick(["The Buried Light", `What the ${people} Dug Up`]);
    default: {
      const c = mythConcept(event);
      const titled = c ? c.gloss.split(" ").map(cap).join(" ") : null;
      return titled ? `The Season of the ${titled}` : `The ${seasonOf(event.tick)} of Year ${yearOf(event.tick)}`;
    }
  }
}

// ---------- observer voice ----------

export function observerFor(world: World, event: WorldEvent, repeats: number): string {
  const rng = world.streams.chronicle;
  const date = `Year ${yearOf(event.tick)}, ${seasonOf(event.tick)}, day ${dayOfSeason(event.tick)}`;
  const tribe = tribeName(world, event.tribeIds[0]);
  const actor = kinRef(world, event.agentIds[0]);
  const pick = (arr: string[]) => arr[rng.int(arr.length)];
  const loc = where(world, event);
  const more =
    repeats > 1 ? ` The pattern repeated ${repeats === 2 ? "once" : `${repeats - 1} times`} more this season.` : "";

  let line: string;
  switch (event.kind) {
    case "death": {
      const cause = str(event, "cause", "unrecorded causes");
      line = actor
        ? pick([
            `${actor.name} of the ${tribe} died of ${cause} ${loc}.`,
            `The ${tribe} lost ${actor.name} to ${cause}.`,
          ])
        : `A death by ${cause} was recorded among the ${tribe}.`;
      break;
    }
    case "birth":
      line = `${actor?.name ?? "A child"} was born to the ${tribe} ${loc}.`;
      break;
    case "tribe.formed":
      line = `${num(event, "count", event.agentIds.length)} kin consolidated as the ${tribe}, ranging ${loc}.`;
      break;
    case "tribe.split":
      line = `The ${tribeName(world, event.tribeIds[1])} separated from the ${tribeName(world, event.tribeIds[0])}; ${num(event, "count", 0) || "several"} kin departed.`;
      break;
    case "settlement.founded":
      line = `The ${tribe} established a camp ${loc}.`;
      break;
    case "settlement.grown":
      line = `The settlement ${placeName(world, event) ?? loc} grew to ${str(event, "tier", "a larger tier")}.`;
      break;
    case "settlement.sacked":
      line = `The settlement ${str(event, "settlement", "of the " + tribeName(world, event.tribeIds[1]))} was sacked by the ${tribeName(world, event.tribeIds[0])}.`;
      break;
    case "discovery":
      line = pick([
        `The ${tribe} acquired ${str(event, "tech", "a new technique")}.`,
        `First verified use of ${str(event, "tech", "a technique")} among the ${tribe}.`,
      ]);
      break;
    case "tech.spread":
      line = `${cap(str(event, "tech", "a technique"))} passed from the ${tribeName(world, event.tribeIds[0])} to the ${tribeName(world, event.tribeIds[1])} through contact.`;
      break;
    case "war.start":
      line = `Hostilities opened between the ${tribeName(world, event.tribeIds[0])} and the ${tribeName(world, event.tribeIds[1])}.`;
      break;
    case "war.end":
      line = `The war between the ${tribeName(world, event.tribeIds[0])} and the ${tribeName(world, event.tribeIds[1])} ended; combined losses: ${num(event, "casualties", num(event, "attackerLosses", 0) + num(event, "defenderLosses", 0))}.`;
      break;
    case "raid":
      line = `A raid ${loc}: ${num(event, "casualties", 0)} casualties, stores taken.`;
      break;
    case "peace.rite":
      line = `A peace rite was held between the ${tribeName(world, event.tribeIds[0])} and the ${tribeName(world, event.tribeIds[1])}.`;
      break;
    case "alliance.formed":
      line = `An alliance was concluded between the ${tribeName(world, event.tribeIds[0])} and the ${tribeName(world, event.tribeIds[1])}.`;
      break;
    case "trade.opened":
      line = `A trade route opened between the ${tribeName(world, event.tribeIds[0])} and the ${tribeName(world, event.tribeIds[1])}.`;
      break;
    case "god.born":
    case "god.promoted": {
      const god = world.gods.get(num(event, "godId", -1));
      line = god
        ? event.kind === "god.born"
          ? `Following the ${str(event, "trigger", "event")}, the ${tribe} began attributing it to a spirit they name ${god.name} (domain: ${god.domain}).`
          : `Cult activity around ${god.name} intensified among the ${tribe}; the spirit now ranks as a god (${god.attributions} recorded attributions).`
        : `A cultic attribution was recorded among the ${tribe}.`;
      break;
    }
    case "myth.born":
      line = `The ${tribe} fixed a ${str(event, "family", "ritual")} narrative into transmission (${num(event, "lines", 2)} lines).`;
      break;
    case "hero.risen":
      line = `${actor?.name ?? "A kin"} of the ${tribe} passed the renown threshold; deeds now circulate beyond the home range.`;
      break;
    case "hero.deed":
      line = `${actor?.name ?? "A kin"} of the ${tribe} performed a notable deed ${loc}.`;
      break;
    case "plague.start":
      line = `An epidemic began among the ${tribe} ${loc}; crowding and food stress noted as antecedents.`;
      break;
    case "plague.end":
      line = `The epidemic among the ${tribe} subsided. Total attributed deaths: ${num(event, "casualties", 0)}.`;
      break;
    case "beast.attack":
      line = `${cap(aan(str(event, "beast", "predator")))} attacked ${loc}; ${num(event, "casualties", 0)} casualties.`;
      break;
    case "glimmer.found":
      line = `The ${tribe} located a glimmer deposit ${loc}. Unusual cultural response noted.`;
      break;
    case "chief.crowned":
      line = `${actor?.name ?? "A kin"} assumed leadership of the ${tribe}.`;
      break;
    case "chief.contested":
      line = `Succession among the ${tribe} was contested.`;
      break;
    case "rite.held":
      line = `The ${tribe} held a rite ${loc}.`;
      break;
    default: {
      if (event.kind.startsWith("omen.")) {
        const what = event.kind.slice(5);
        line = pick([
          `${cap(aan(what))} was observed ${loc}; ${num(event, "populationAffected", num(event, "affected", 0)) || "an unknown number of"} kin were in the affected area.`,
          `The record marks ${aan(what)} over the territory of the ${tribe}.`,
        ]);
      } else {
        line = `${cap(event.kind.replace(".", " "))} recorded among the ${tribe} ${loc}.`;
      }
    }
  }
  return `${date}. ${line}${more}`;
}

// ---------- myth voice ----------

const MYTHIC_KINDS = new Set([
  "omen.eclipse",
  "omen.comet",
  "omen.aurora",
  "omen.drought",
  "omen.storm",
  "omen.earthquake",
  "plague.start",
  "plague.end",
  "war.start",
  "war.end",
  "raid",
  "settlement.founded",
  "settlement.sacked",
  "tribe.formed",
  "tribe.split",
  "discovery",
  "god.born",
  "god.promoted",
  "myth.born",
  "hero.risen",
  "hero.deed",
  "beast.attack",
  "glimmer.found",
  "chief.contested",
]);

export function isMythworthy(world: World, event: WorldEvent): boolean {
  if (MYTHIC_KINDS.has(event.kind)) return true;
  // a hero's death is a matter for the fire circle
  if (event.kind === "death") {
    const kin = kinRef(world, event.agentIds[0]);
    return kin?.hero === true;
  }
  return false;
}

export function mythFor(
  world: World,
  event: WorldEvent,
  used: Set<string>,
  lens: Tribe | undefined,
): string {
  const rng = world.streams.chronicle;
  // god births, tribe events, and discoveries belong to their own tribe's voice;
  // shared phenomena (omens, plagues) speak through the chapter's dominant lens
  const OWN_TRIBE = event.kind.startsWith("god.") || event.kind.startsWith("tribe.") ||
    event.kind === "discovery" || event.kind === "settlement.founded" ||
    event.kind === "settlement.sacked" || event.kind === "hero.risen";
  const tribe = (OWN_TRIBE ? tribeFor(world, event) : lens) ?? lens ?? tribeFor(world, event);
  const people = tribe?.name ?? world.name;
  const god = relevantGod(world, tribe, event);
  const godFirst = god !== undefined && !used.has(`god:${god.id}`);
  if (god) used.add(`god:${god.id}`);
  const cause = god ? godRef(god, godFirst) : "the powers beyond the rim";
  const hero = kinRef(world, event.agentIds[0]);
  const heroName = hero?.epithet ? `${hero.name}, called *${hero.epithet}*` : hero?.name;
  const scribe = tribe?.techs.includes("writing") ?? false;
  const lead = scribe
    ? "It is written:"
    : rng.chance(0.5)
      ? "Hear and remember:"
      : "So the elders say:";
  const pick = (arr: string[]) => `${lead} ${arr[rng.int(arr.length)]}`;
  const w = (concept: string, gloss: string) => inWord(tribe, concept, gloss, used);

  switch (event.kind) {
    case "omen.eclipse":
      return pick([
        `the sun went into the mouth of ${cause}, and the ${people} beat the ground until it was given back.`,
        `at midday came ${w("eclipse", "sun-death")}. The birds lay down. ${cap(cause)} passed between the world and its fire, to remind the ${people} whose fire it is.`,
      ]);
    case "omen.comet":
      return pick([
        `${w("comet", "burning wanderer")} crossed the roof of the world. Some among the ${people} said it was ${cause} hunting; the wise said nothing, and watched.`,
        `a fire walked across the night and did not fall. The ${people} counted their children twice that season.`,
      ]);
    case "omen.aurora":
      return pick([
        `in the long dark the sky opened its veins and burned green. The ${people} say it is ${cause} walking the rim of the world.`,
        `${w("aurora", "sky-fire")} stood over the camps all night. No one slept, and no one wished to.`,
      ]);
    case "omen.drought":
      return pick([
        `${w("drought", "hunger-wind")} came and sat at every fire. ${cap(cause)} had turned away, and the ${people} learned to eat silence.`,
        `the rivers pulled in their tongues. The ${people} sent their best voice to sing at the dry stones, for ${cause} listens to the stubborn.`,
      ]);
    case "omen.storm":
      return pick([
        `the sky broke over the ${people} and hammered the land flat. They named what walked in it: ${cause}.`,
      ]);
    case "omen.earthquake":
      return pick([
        `the ground remembered it was once water and moved. The ${people} planted their feet and lied to their children that it was nothing.`,
        `${w("earthquake", "world-shudder")} rolled beneath the camps. ${cap(cause)} turned over in sleep — so the ${people} say, and hope.`,
      ]);
    case "plague.start":
      return pick([
        `${w("plague", "creeping death")} came into the tents without footprints. The ${people} burned sweet wood and named the names of the well.`,
        `a sickness walked from fire to fire wearing borrowed faces. ${cap(cause)} was asked for a reason and gave none.`,
      ]);
    case "plague.end":
      return pick([
        `the creeping death grew thin and left. Those who remained of the ${people} washed in the river and did not speak of it for a year.`,
      ]);
    case "war.start": {
      // when the lens tribe is a belligerent, its foe is the other side; a
      // bystander lens narrates both parties by name instead
      const foeId = tribe !== undefined && event.tribeIds[1] === tribe.id
        ? event.tribeIds[0]
        : event.tribeIds[1];
      const variants = tribe !== undefined && event.tribeIds.includes(tribe.id)
        ? [`the ${people} took up ${w("war", "spear-time")} against ${tribeName(world, foeId)}. The old ones spat; the young ones sharpened.`]
        : [];
      variants.push(
        `between ${tribeName(world, event.tribeIds[0])} and ${tribeName(world, event.tribeIds[1])} a debt was opened that only ${w("war", "spear-time")} could count.`,
      );
      return pick(variants);
    }
    case "war.end":
      return pick([
        `the spears were laid down between ${tribeName(world, event.tribeIds[0])} and ${tribeName(world, event.tribeIds[1])}, and the dead were traded like beads until the count was even.`,
        `${w("war", "spear-time")} ended as it began: with two peoples smaller than before, and the grass indifferent.`,
      ]);
    case "raid":
      return pick([
        `men came out of the dark for the stores of the ${people}, and the dark took some of them back.`,
        `fire visited the granaries. The ${people} answered with ${w("war", "spear-time")}, briefly and without songs.`,
      ]);
    case "settlement.founded":
      return pick([
        `the ${people} drove the first post ${placeName(world, event) ? `and named the place ${placeName(world, event)}` : "into unclaimed ground"}. ${cap(cause)} was offered the first smoke.`,
        `here the wandering stopped: ${placeName(world, event) ?? "a nameless bend of country"}. The ${people} promised the ground they would stay, and mostly kept it.`,
      ]);
    case "settlement.sacked": {
      const fallen = event.data["settlement"];
      // the grief belongs to the defender (second id), never the sacker
      const mourner = tribeName(world, event.tribeIds[1] ?? event.tribeIds[0]);
      return pick([
        `where ${typeof fallen === "string" ? fallen : "a home"} stood there is ash, and the ash remembers the ${mourner}. Let it be told plainly; grief needs no ornament.`,
      ]);
    }
    case "tribe.formed":
      return pick([
        `the ${people} counted themselves and found they were a people. They took a name so the world would have something to call after them.`,
      ]);
    case "tribe.split":
      return pick([
        `one fire became two. The ${tribeName(world, event.tribeIds[1])} walked away from the ${tribeName(world, event.tribeIds[0])} carrying embers and grievances, both carefully banked.`,
      ]);
    case "discovery": {
      const tech = str(event, "tech", "craft");
      return pick([
        `${heroName ?? `one of the ${people}`} tore ${w(tech, tech)} from the world's keeping and gave it to the ${people}. ${cap(cause)} pretended not to notice.`,
        `the ${people} learned ${w(tech, tech)}. What was hard became easy, and something small was lost that no one could name.`,
      ]);
    }
    case "god.born": {
      if (!god) break;
      return pick([
        `out of the ${str(event, "trigger", "terror")} the ${people} named the thing that did it: ${godRef(god, godFirst)}. Naming is a rope; now it can be pulled.`,
        `the ${people} gave the ${str(event, "trigger", "sign")} a name — ${god.name} — so that it would owe them conversation.`,
      ]);
    }
    case "god.promoted": {
      if (!god) break;
      return pick([
        `${godRef(god, godFirst)} answered twice, and twice is a covenant. The ${people} now set aside the first portion.`,
        `what was a whisper is now a house: ${god.name} has rites, and the rites have keepers.`,
      ]);
    }
    case "myth.born":
      return pick([
        `a story stood up at the fire of the ${people} and refused to sit down. It will outlive everyone in this chronicle.`,
      ]);
    case "hero.risen":
      return pick([
        `${heroName ?? "a kin"} became more than a name: a direction. The young of the ${people} now walk the way that one walked.`,
      ]);
    case "hero.deed":
      return pick([
        `${heroName ?? "a kin"} did what is told of ${where(world, event)}, and the telling has already improved it.`,
      ]);
    case "death":
      return pick([
        `${heroName ?? "a great one"} went into ${w("death", "long silence")}. The ${people} sang the name until dawn so that ${cause} would know whom to expect.`,
      ]);
    case "beast.attack":
      return pick([
        `${w("beast", "tooth in the dark")} came for the ${people}. It is fed now; that is the most that can be said.`,
      ]);
    case "glimmer.found":
      return pick([
        `the ${people} dug where they should not and found ${w("glimmer", "buried light")}. It is beautiful, and it watches back.`,
      ]);
    case "chief.contested":
      return pick([
        `two hands reached for the ${people}'s one staff. The staff chose neither cleanly; staffs never do.`,
      ]);
  }
  // fallback — should rarely fire
  return pick([
    `${cause} moved through the season, and the ${people} kept the record of it as best they could.`,
  ]);
}

export function quietSeasonMyth(world: World, tribe: Tribe | undefined): string {
  const people = tribe?.name ?? world.name;
  const rng = world.streams.chronicle;
  const variants = [
    `So the elders say: the ${people} kept the quiet season, and the quiet season kept them.`,
    `Hear and remember: nothing came, nothing burned, no one great was born or lost. Such seasons are the mortar of a people; the stones get the songs.`,
  ];
  return variants[rng.int(variants.length)];
}
