// Theme registry: CSS handles chrome via [data-theme]; the canvas can't read CSS,
// so each theme carries a map palette object with the same mood.

import type { Biome } from "../sim/types";

export interface MapPalette {
  biomes: Record<Biome, string>;
  biomesDark: Record<Biome, string>; // subtle per-tile variation target
  settlement: string;
  settlementRing: string;
  kinAlpha: number;
  gridVeil: string; // very subtle overlay to unify tiles ("" = none)
  pulse: string; // event pulse
  pulseOmen: string;
  selection: string;
  tribeHues: number[]; // hue ring for tribe colors
  tribeSat: number;
  tribeLight: number;
}

export interface Theme {
  id: "observatory" | "journal" | "illuminated";
  label: string;
  map: MapPalette;
}

const observatory: Theme = {
  id: "observatory",
  label: "Observatory",
  map: {
    biomes: {
      ocean: "#0a1a2e",
      coast: "#12293f",
      river: "#16405c",
      grassland: "#25423a",
      forest: "#1c3a30",
      jungle: "#173b2c",
      savanna: "#3d4a2e",
      desert: "#4a4232",
      marsh: "#233d38",
      hills: "#33403c",
      mountain: "#454b54",
      snow: "#8a97ad",
    },
    biomesDark: {
      ocean: "#081525",
      coast: "#0f2234",
      river: "#133850",
      grassland: "#1f3830",
      forest: "#173028",
      jungle: "#133124",
      savanna: "#343f27",
      desert: "#3f392b",
      marsh: "#1d342f",
      hills: "#2b3733",
      mountain: "#3b4148",
      snow: "#78859b",
    },
    settlement: "#ffd9a0",
    settlementRing: "rgba(255, 217, 160, 0.35)",
    kinAlpha: 0.9,
    gridVeil: "rgba(6, 8, 16, 0.12)",
    pulse: "#6ee7ff",
    pulseOmen: "#ffb454",
    selection: "#7deaff",
    tribeHues: [185, 35, 320, 95, 265, 15, 150, 220],
    tribeSat: 75,
    tribeLight: 68,
  },
};

const journal: Theme = {
  id: "journal",
  label: "Field Journal",
  map: {
    biomes: {
      ocean: "#cfe0dd",
      coast: "#dbe7de",
      river: "#b8d4cf",
      grassland: "#cdd9ae",
      forest: "#9dbb8f",
      jungle: "#8cb083",
      savanna: "#dcd3a2",
      desert: "#ead9b0",
      marsh: "#b9c9ab",
      hills: "#c4c0a2",
      mountain: "#b3ab98",
      snow: "#efece4",
    },
    biomesDark: {
      ocean: "#c3d6d3",
      coast: "#d0ded4",
      river: "#aac9c3",
      grassland: "#c2cfa0",
      forest: "#90b081",
      jungle: "#7fa476",
      savanna: "#d2c893",
      desert: "#e0cd9f",
      marsh: "#adbf9d",
      hills: "#b8b393",
      mountain: "#a69e8a",
      snow: "#e7e3d8",
    },
    settlement: "#2a2620",
    settlementRing: "rgba(42, 38, 32, 0.3)",
    kinAlpha: 0.85,
    gridVeil: "",
    pulse: "#3f6d4e",
    pulseOmen: "#b4443c",
    selection: "#345e43",
    tribeHues: [150, 25, 350, 205, 280, 45, 105, 320],
    tribeSat: 45,
    tribeLight: 38,
  },
};

const illuminated: Theme = {
  id: "illuminated",
  label: "Illuminated",
  map: {
    biomes: {
      ocean: "#95ab9c",
      coast: "#b4c2a8",
      river: "#8aa695",
      grassland: "#d8c48f",
      forest: "#a8a06a",
      jungle: "#96975f",
      savanna: "#d6bd82",
      desert: "#e2cb92",
      marsh: "#b0ac76",
      hills: "#c0a877",
      mountain: "#8a7551",
      snow: "#e6dcc0",
    },
    biomesDark: {
      ocean: "#89a091",
      coast: "#a9b89d",
      river: "#7e9b8a",
      grassland: "#cdb983",
      forest: "#9d955f",
      jungle: "#8b8c55",
      savanna: "#cbb277",
      desert: "#d7c087",
      marsh: "#a5a16c",
      hills: "#b59d6c",
      mountain: "#7e6a48",
      snow: "#dcd2b5",
    },
    settlement: "#571f26",
    settlementRing: "rgba(87, 31, 38, 0.35)",
    kinAlpha: 0.8,
    gridVeil: "rgba(59, 47, 30, 0.05)",
    pulse: "#571f26",
    pulseOmen: "#b98a2f",
    selection: "#6d2730",
    tribeHues: [355, 42, 160, 210, 285, 20, 130, 240],
    tribeSat: 42,
    tribeLight: 34,
  },
};

export const THEMES: Theme[] = [observatory, journal, illuminated];

const KEY = "microcosm.theme";

export function loadTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  return THEMES.find((t) => t.id === saved) ?? THEMES[0];
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme.id);
  localStorage.setItem(KEY, theme.id);
}

export function nextTheme(current: Theme): Theme {
  const i = THEMES.findIndex((t) => t.id === current.id);
  return THEMES[(i + 1) % THEMES.length];
}

export function tribeColor(theme: Theme, colorIndex: number, alpha = 1): string {
  const m = theme.map;
  const hue = m.tribeHues[colorIndex % m.tribeHues.length];
  return `hsla(${hue}, ${m.tribeSat}%, ${m.tribeLight}%, ${alpha})`;
}
