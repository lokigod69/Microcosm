// Chapter assembly: pick the season's history from its noise, then render it in
// both voices. Selection rules:
//  - texture kinds (births, pairings, language bookkeeping, routine rites) never
//    lead a chapter — they are the sim's connective tissue, not its history
//  - always-keep kinds (gods, wars, tribes, discoveries, sackings) ride along
//  - repeats collapse: the same kind striking the same tribe twice in a season
//    becomes one line that says so

import { observerFor, mythFor, titleFor, isMythworthy, quietSeasonMyth, tribeFor } from "./templates";
import type { Chapter, ChronicleBackend, EventKind, Season, Tribe, World, WorldEvent } from "../sim/types";

const TEXTURE_KINDS = new Set<EventKind>([
  "birth",
  "pairing",
  "language.coin",
  "language.borrow",
  "language.drift",
  "rite.held",
  "hero.deed",
]);

const ALWAYS_PREFIXES = ["god.", "war.", "tribe."];
const ALWAYS_KINDS = new Set<EventKind>([
  "myth.born",
  "discovery",
  "settlement.sacked",
  "plague.start",
  "hero.risen",
]);

const MAX_EVENTS = 10;
const MAX_MYTH_LINES = 5;

function alwaysKeep(kind: EventKind): boolean {
  if (ALWAYS_KINDS.has(kind)) return true;
  for (const prefix of ALWAYS_PREFIXES) if (kind.startsWith(prefix)) return true;
  return false;
}

interface Grouped {
  event: WorldEvent; // strongest representative
  repeats: number;
}

function groupKey(e: WorldEvent): string {
  return `${e.kind}|${e.tribeIds.slice().sort((a, b) => a - b).join(",")}`;
}

function selectEvents(events: WorldEvent[]): Grouped[] {
  // collapse repeats first so a stormy season is one line, not seven
  const groups = new Map<string, Grouped>();
  for (const e of events) {
    if (TEXTURE_KINDS.has(e.kind)) continue;
    const key = groupKey(e);
    const g = groups.get(key);
    if (!g) groups.set(key, { event: e, repeats: 1 });
    else {
      g.repeats++;
      if (e.salience > g.event.salience) g.event = e;
    }
  }
  const ranked = [...groups.values()].sort(
    (a, b) => b.event.salience - a.event.salience || a.event.id - b.event.id,
  );
  const kept = ranked.slice(0, 7);
  const included = new Set(kept.map((g) => g.event.id));
  for (const g of ranked) {
    if (kept.length >= MAX_EVENTS) break;
    if (alwaysKeep(g.event.kind) && !included.has(g.event.id)) {
      kept.push(g);
      included.add(g.event.id);
    }
  }
  kept.sort((a, b) => a.event.tick - b.event.tick || a.event.id - b.event.id);
  return kept;
}

function dominantTribe(world: World, groups: Grouped[]): Tribe | undefined {
  let best: Tribe | undefined;
  let bestScore = -1;
  for (const tribe of world.tribes.values()) {
    if (tribe.extinct) continue;
    let score = 0;
    for (const g of groups) if (g.event.tribeIds.includes(tribe.id)) score += g.event.salience;
    if (score > bestScore) {
      best = tribe;
      bestScore = score;
    }
  }
  return best;
}

export class TemplateBackend implements ChronicleBackend {
  renderChapter(world: World, events: WorldEvent[], year: number, season: Season): Chapter {
    const selected = selectEvents(events);
    const top = selected
      .slice()
      .sort((a, b) => b.event.salience - a.event.salience || a.event.id - b.event.id)[0];
    const lens = dominantTribe(world, selected);

    const observer: string[] = [];
    const myth: string[] = [];
    const usedConcepts = new Set<string>();

    for (const g of selected) {
      observer.push(observerFor(world, g.event, g.repeats));
      if (myth.length < MAX_MYTH_LINES && isMythworthy(world, g.event)) {
        const line = mythFor(world, g.event, usedConcepts, lens ?? tribeFor(world, g.event));
        if (!myth.includes(line)) myth.push(line);
      }
    }
    if (observer.length === 0) {
      observer.push(`Year ${year}, ${season}. No event exceeded the seasonal recording threshold.`);
    }
    if (myth.length === 0) myth.push(quietSeasonMyth(world, lens));

    return {
      year,
      season,
      index: world.chronicle.length + 1,
      title: titleFor(world, top?.event),
      observer,
      myth,
      eventIds: selected.map((g) => g.event.id),
    };
  }
}

export function chronicleSeason(world: World, events: WorldEvent[], year: number, season: Season): Chapter {
  return new TemplateBackend().renderChapter(world, events, year, season);
}
