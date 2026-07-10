import {
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  ECLIPSE_PERIOD,
  COMET_PERIOD,
  SEASONS,
  type Season,
} from "./types";

export function yearOf(tick: number): number {
  return Math.floor(tick / DAYS_PER_YEAR) + 1;
}

export function dayOfYear(tick: number): number {
  return tick % DAYS_PER_YEAR;
}

export function seasonOf(tick: number): Season {
  return SEASONS[Math.floor(dayOfYear(tick) / DAYS_PER_SEASON)];
}

export function dayOfSeason(tick: number): number {
  return (dayOfYear(tick) % DAYS_PER_SEASON) + 1;
}

export function isSeasonBoundary(tick: number): boolean {
  return tick > 0 && dayOfYear(tick) % DAYS_PER_SEASON === 0;
}

export function isYearBoundary(tick: number): boolean {
  return tick > 0 && dayOfYear(tick) === 0;
}

/** season multiplier for vegetation regrowth */
export function regrowthFactor(season: Season): number {
  switch (season) {
    case "Thaw":
      return 1.0;
    case "High Sun":
      return 1.3;
    case "Fall":
      return 0.8;
    case "Long Dark":
      return 0.35;
  }
}

export function isEclipse(tick: number, seedOffset: number): boolean {
  return tick > 0 && (tick + seedOffset) % ECLIPSE_PERIOD === 0;
}

export function isComet(tick: number, seedOffset: number): boolean {
  return tick > 0 && (tick + seedOffset * 3) % COMET_PERIOD === 0;
}

export function formatDate(tick: number): string {
  return `Year ${yearOf(tick)} · ${seasonOf(tick)} · Day ${dayOfSeason(tick)}`;
}
