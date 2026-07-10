// Deterministic PRNG. Every random draw in the simulation flows through a named
// stream so adding a consumer in one system never reshuffles another system's rolls.

export type StreamName =
  | "worldgen"
  | "climate"
  | "agents"
  | "events"
  | "language"
  | "myth"
  | "chronicle";

export const STREAM_NAMES: StreamName[] = [
  "worldgen",
  "climate",
  "agents",
  "events",
  "language",
  "myth",
  "chronicle",
];

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number, stream: string) {
    const s = fnv1a(stream);
    this.a = (seed ^ 0x9e3779b9) >>> 0;
    this.b = (seed ^ s) >>> 0;
    this.c = Math.imul(seed, 0x85ebca6b) ^ s;
    this.d = (fnv1a(stream + seed.toString()) ^ 0xc2b2ae35) >>> 0;
    // warm up so nearby seeds decorrelate
    for (let i = 0; i < 12; i++) this.next();
  }

  /** float in [0, 1) — sfc32 */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    const t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    const r = (t + this.d) | 0;
    this.c = (this.c + r) | 0;
    return (r >>> 0) / 4294967296;
  }

  /** integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** float in [a, b) */
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** approximately normal via sum of 4 uniforms, mean 0, ~sd `sd` */
  jitter(sd: number): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * sd * 1.732;
  }

  /** weighted index pick; weights need not sum to 1 */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}

export type Streams = Record<StreamName, Rng>;

export function makeStreams(seed: number): Streams {
  const out = {} as Streams;
  for (const name of STREAM_NAMES) out[name] = new Rng(seed, name);
  return out;
}

/** Deterministic helper: iterate a Record's entries in sorted-key order. */
export function sortedEntries<V>(obj: Record<string, V>): [string, V][] {
  return Object.keys(obj)
    .sort()
    .map((k) => [k, obj[k]]);
}
