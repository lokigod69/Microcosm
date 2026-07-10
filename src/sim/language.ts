import { sortedEntries, type Streams } from "./rng";
import type { LexEntry, Phonology, Tribe, World } from "./types";
import { emit } from "./events";

const CONSONANTS = [
  "p", "t", "k", "b", "d", "g", "m", "n", "ng", "f", "v", "s", "z",
  "sh", "h", "l", "r", "w", "y", "th", "ch", "kh",
] as const;
const VOWELS = ["a", "e", "i", "o", "u"] as const;
const PATTERNS = ["CV", "CVC", "CVV", "VC", "CVVC", "CCV"] as const;

export type NameKind = "kin" | "settlement" | "god" | "tribe" | "myth" | "epithet";

function shufflePrefix<T>(values: readonly T[], count: number, streams: Streams): T[] {
  const copy = values.slice();
  const rng = streams.language;
  for (let i = 0; i < count; i++) {
    const chosen = i + rng.int(copy.length - i);
    const hold = copy[i];
    copy[i] = copy[chosen];
    copy[chosen] = hold;
  }
  return copy.slice(0, count);
}

/** Draw one culture's sound inventory exclusively from the language stream. */
export function generatePhonology(streams: Streams): Phonology {
  return {
    consonants: shufflePrefix(CONSONANTS, 7 + streams.language.int(6), streams),
    vowels: shufflePrefix(VOWELS, 3 + streams.language.int(3), streams),
    patterns: shufflePrefix(PATTERNS, 2 + streams.language.int(3), streams),
  };
}

function syllable(streams: Streams, phonology: Phonology): string {
  const rng = streams.language;
  const pattern = rng.pick(phonology.patterns);
  let result = "";
  for (let i = 0; i < pattern.length; i++) {
    result += pattern[i] === "C"
      ? rng.pick(phonology.consonants)
      : rng.pick(phonology.vowels);
  }
  return result;
}

function generateWord(streams: Streams, phonology: Phonology, syllableCount?: number): string {
  const roll = streams.language.next();
  const count = syllableCount ?? (roll < 0.42 ? 1 : roll < 0.87 ? 2 : 3);
  let result = "";
  for (let i = 0; i < count; i++) result += syllable(streams, phonology);
  return result;
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1);
}

function allExistingNames(world: World): Set<string> {
  const names = new Set<string>();
  const kin = Array.from(world.kin.values()).sort((a, b) => a.id - b.id);
  const tribes = Array.from(world.tribes.values()).sort((a, b) => a.id - b.id);
  const settlements = Array.from(world.settlements.values()).sort((a, b) => a.id - b.id);
  const gods = Array.from(world.gods.values()).sort((a, b) => a.id - b.id);
  for (let i = 0; i < kin.length; i++) names.add(kin[i].name);
  for (let i = 0; i < tribes.length; i++) names.add(tribes[i].name);
  for (let i = 0; i < settlements.length; i++) names.add(settlements[i].name);
  for (let i = 0; i < gods.length; i++) names.add(gods[i].name);
  for (let i = 0; i < world.myths.length; i++) names.add(world.myths[i].title);
  return names;
}

/**
 * Make an in-world proper name. Kind changes only its cadence; no English morpheme
 * enters the generated form.
 */
export function makeName(world: World, tribe: Tribe, kind: NameKind): string {
  const occupied = allExistingNames(world);
  let forcedSyllables: number | undefined;
  if (kind === "settlement" || kind === "tribe") forcedSyllables = 2;
  else if (kind === "god" || kind === "myth" || kind === "epithet") {
    forcedSyllables = 2 + world.streams.language.int(2);
  }
  let candidate = "";
  for (let attempt = 0; attempt < 16; attempt++) {
    candidate = capitalize(generateWord(world.streams, tribe.phonology, forcedSyllables));
    if (!occupied.has(candidate)) return candidate;
  }
  // A second phonological word is a deterministic collision escape, not a numeral.
  return `${candidate}${capitalize(generateWord(world.streams, tribe.phonology, 1))}`;
}

/** Coin a concept on its salient first encounter. Calling again is idempotent. */
export function coin(world: World, tribe: Tribe, concept: string, gloss?: string): LexEntry {
  const existing = tribe.lexicon[concept];
  if (existing !== undefined) return existing;
  const entry: LexEntry = {
    word: generateWord(world.streams, tribe.phonology),
    coinedTick: world.tick,
    oldForms: [],
    borrowedFrom: null,
  };
  tribe.lexicon[concept] = entry;
  emit(world, "language.coin", {
    tribeIds: [tribe.id],
    data: { concept, word: entry.word, gloss: gloss ?? concept },
  });
  return entry;
}

function nearestVowel(vowel: string, inventory: readonly string[]): string {
  let source = VOWELS.indexOf(vowel as (typeof VOWELS)[number]);
  if (source < 0) source = 0;
  let best = inventory[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < inventory.length; i++) {
    const candidate = VOWELS.indexOf(inventory[i] as (typeof VOWELS)[number]);
    const distance = candidate < 0 ? 10 : Math.abs(source - candidate);
    if (distance < bestDistance) {
      best = inventory[i];
      bestDistance = distance;
    }
  }
  return best;
}

const CONSONANT_FAMILIES: readonly (readonly string[])[] = [
  ["p", "b", "f", "v", "w"],
  ["t", "d", "s", "z", "th", "sh", "ch"],
  ["k", "g", "kh", "h"],
  ["m", "n", "ng"],
  ["l", "r", "y"],
];

function nearestConsonant(sound: string, inventory: readonly string[]): string {
  for (let familyIndex = 0; familyIndex < CONSONANT_FAMILIES.length; familyIndex++) {
    const family = CONSONANT_FAMILIES[familyIndex];
    if (family.indexOf(sound) < 0) continue;
    for (let candidateIndex = 0; candidateIndex < family.length; candidateIndex++) {
      if (inventory.indexOf(family[candidateIndex]) >= 0) return family[candidateIndex];
    }
  }
  return inventory[0];
}

function tokenize(word: string, phonology: Phonology): string[] {
  const inventory = phonology.consonants.concat(phonology.vowels)
    .slice()
    .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  const tokens: string[] = [];
  let offset = 0;
  while (offset < word.length) {
    let found = "";
    for (let i = 0; i < inventory.length; i++) {
      if (word.startsWith(inventory[i], offset)) {
        found = inventory[i];
        break;
      }
    }
    if (found.length === 0) found = word[offset];
    tokens.push(found);
    offset += found.length;
  }
  return tokens;
}

function adaptWord(source: string, lender: Phonology, borrower: Phonology): string {
  const tokens = tokenize(source.toLowerCase(), lender);
  let adapted = "";
  for (let i = 0; i < tokens.length; i++) {
    const sound = tokens[i];
    if (borrower.vowels.indexOf(sound) >= 0 || borrower.consonants.indexOf(sound) >= 0) {
      adapted += sound;
    } else if (lender.vowels.indexOf(sound) >= 0 || VOWELS.indexOf(sound as (typeof VOWELS)[number]) >= 0) {
      adapted += nearestVowel(sound, borrower.vowels);
    } else {
      adapted += nearestConsonant(sound, borrower.consonants);
    }
  }
  return adapted;
}

/** Copy a missing concept through contact and fit it to the borrower's inventory. */
export function borrowWord(
  world: World,
  borrower: Tribe,
  lender: Tribe,
  concept: string,
): LexEntry | null {
  const existing = borrower.lexicon[concept];
  if (existing !== undefined) return existing;
  const source = lender.lexicon[concept];
  if (source === undefined) return null;
  const entry: LexEntry = {
    word: adaptWord(source.word, lender.phonology, borrower.phonology),
    coinedTick: world.tick,
    oldForms: [],
    borrowedFrom: lender.id,
  };
  borrower.lexicon[concept] = entry;
  emit(world, "language.borrow", {
    tribeIds: [borrower.id, lender.id],
    data: { concept, word: entry.word, sourceWord: source.word, lenderId: lender.id },
  });
  return entry;
}

function mutateWord(world: World, tribe: Tribe, word: string): string {
  const rng = world.streams.language;
  const mode = rng.int(3);
  const tokens = tokenize(word, tribe.phonology);
  if (tokens.length === 0) return word;

  if (mode === 0) { // vowel shift
    const vowelPositions: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tribe.phonology.vowels.indexOf(tokens[i]) >= 0) vowelPositions.push(i);
    }
    if (vowelPositions.length > 0) {
      const position = vowelPositions[rng.int(vowelPositions.length)];
      const current = tribe.phonology.vowels.indexOf(tokens[position]);
      tokens[position] = tribe.phonology.vowels[(current + 1) % tribe.phonology.vowels.length];
    }
  } else if (mode === 1) { // lenition within the culture's consonant inventory
    const consonantPositions: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tribe.phonology.consonants.indexOf(tokens[i]) >= 0) consonantPositions.push(i);
    }
    if (consonantPositions.length > 0) {
      const position = consonantPositions[rng.int(consonantPositions.length)];
      const current = tribe.phonology.consonants.indexOf(tokens[position]);
      tokens[position] = tribe.phonology.consonants[(current + 1) % tribe.phonology.consonants.length];
    }
  } else if (tokens.length > 2) { // erosion / syllable loss
    tokens.splice(rng.chance(0.5) ? 0 : tokens.length - 1, 1);
  }
  return tokens.join("") || word;
}

/** Perform the yearly, voice-scaled sound-change pass. */
export function driftLanguages(world: World): void {
  const tribes = Array.from(world.tribes.values()).sort((a, b) => a.id - b.id);
  for (let t = 0; t < tribes.length; t++) {
    const tribe = tribes[t];
    if (tribe.extinct) continue;
    let voice = 0;
    let members = 0;
    const memberIds = tribe.memberIds.slice().sort((a, b) => a - b);
    for (let i = 0; i < memberIds.length; i++) {
      const kin = world.kin.get(memberIds[i]);
      if (kin !== undefined && kin.alive) {
        voice += kin.genome.voice;
        members++;
      }
    }
    const meanVoice = members === 0 ? 0.5 : voice / members;
    const chance = 0.025 + meanVoice * 0.1;
    const entries = sortedEntries(tribe.lexicon);
    for (let i = 0; i < entries.length; i++) {
      const concept = entries[i][0];
      const entry = entries[i][1];
      if (!world.streams.language.chance(chance)) continue;
      const previous = entry.word;
      const next = mutateWord(world, tribe, previous);
      if (next === previous) continue;
      entry.oldForms.push(previous);
      entry.word = next;
      emit(world, "language.drift", {
        tribeIds: [tribe.id],
        data: { concept, oldWord: previous, word: next },
      });
    }
  }
}
