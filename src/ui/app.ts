// App shell: genesis overlay, sim loop with per-frame tick budget, time controls,
// theme cycling, tab switching, and wiring renderer ↔ panels.

import { createWorld, tickWorld } from "../sim/engine";
import type { World } from "../sim/types";
import { formatDate } from "../sim/time";
import { MapRenderer } from "./renderer";
import { Panels } from "./panels";
import { THEMES, applyTheme, loadTheme, nextTheme, type Theme } from "./themes";

const TPS: Record<number, number> = { 1: 3, 4: 12, 16: 48, 60: 180 };
const MAX_TICKS_PER_FRAME = 30;

export class App {
  private world: World | null = null;
  private theme: Theme = loadTheme();
  private renderer: MapRenderer;
  private panels: Panels;
  private paused = false;
  private speed = 4;
  private tickCarry = 0;
  private lastFrame = performance.now();
  private seenEvents = 0;
  private activeTab = "chronicle";
  private uiRefreshCarry = 0;

  constructor() {
    applyTheme(this.theme);
    const canvas = document.getElementById("map") as HTMLCanvasElement;
    this.renderer = new MapRenderer(canvas, this.theme, () => this.world);
    this.panels = new Panels(() => this.world, this.theme);

    this.renderer.onSelect = (sel) => {
      this.panels.show(sel);
      this.switchTab("inspect");
    };
    this.panels.onCenter = (x, y) => this.renderer.centerOn(x, y);

    this.bindControls();
    this.updateSpeedButtons();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- world lifecycle ----------

  begin(seed: number): void {
    this.world = createWorld(seed);
    this.seenEvents = 0;
    this.tickCarry = 0;
    this.panels.reset();
    this.renderer.worldChanged();
    document.getElementById("world-name")!.textContent = this.world.name;
    document.getElementById("world-seed")!.textContent = `seed ${seed}`;
    document.getElementById("genesis")!.classList.add("hidden");
    this.paused = false;
    this.updatePauseButton();
    this.panels.refreshAlmanac();
    this.panels.refreshLexicon();
    setTimeout(() => document.getElementById("map-hint")?.classList.add("faded"), 6000);
  }

  // ---------- loop ----------

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.world && !this.paused) {
      this.tickCarry += dt * TPS[this.speed];
      let budget = Math.min(Math.floor(this.tickCarry), MAX_TICKS_PER_FRAME);
      this.tickCarry -= Math.floor(this.tickCarry);
      while (budget-- > 0) tickWorld(this.world);

      // surface new events as pulses
      const events = this.world.events;
      if (events.length > this.seenEvents) {
        this.renderer.notifyEvents(events.slice(this.seenEvents));
        this.seenEvents = events.length;
      }

      // periodic panel refreshes (cheap cadence, not per tick)
      this.uiRefreshCarry += dt;
      if (this.uiRefreshCarry > 0.5) {
        this.uiRefreshCarry = 0;
        document.getElementById("world-date")!.textContent = formatDate(this.world.tick);
        if (this.panels.refreshChronicle() && this.activeTab !== "chronicle") {
          document.getElementById("chron-badge")!.hidden = false;
        }
        if (this.activeTab === "almanac") this.panels.refreshAlmanac();
        if (this.activeTab === "lexicon") this.panels.refreshLexicon();
        if (this.activeTab === "inspect") this.panels.refreshInspect();
      }
    }

    this.renderer.frame(dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- controls ----------

  private bindControls(): void {
    const seedInput = document.getElementById("seed-input") as HTMLInputElement;
    seedInput.value = String(Math.floor(Math.random() * 100000)); // UI-only randomness

    document.getElementById("btn-shuffle")!.addEventListener("click", () => {
      seedInput.value = String(Math.floor(Math.random() * 100000));
    });
    document.getElementById("btn-begin")!.addEventListener("click", () => {
      const seed = Number(seedInput.value.trim()) || 1;
      this.begin(seed);
    });
    seedInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") (document.getElementById("btn-begin") as HTMLButtonElement).click();
    });

    document.getElementById("btn-pause")!.addEventListener("click", () => this.togglePause());
    document.querySelectorAll<HTMLButtonElement>(".tc-btn.speed").forEach((b) => {
      b.addEventListener("click", () => {
        this.speed = Number(b.dataset.speed);
        this.paused = false;
        this.updatePauseButton();
        this.updateSpeedButtons();
      });
    });

    document.getElementById("btn-theme")!.addEventListener("click", () => this.cycleTheme());

    document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => {
      b.addEventListener("click", () => this.switchTab(b.dataset.tab!));
    });

    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        this.togglePause();
      } else if (e.key >= "1" && e.key <= "4") {
        this.speed = [1, 4, 16, 60][Number(e.key) - 1];
        this.updateSpeedButtons();
      } else if (e.key === "t" || e.key === "T") {
        this.cycleTheme();
      }
    });
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.updatePauseButton();
  }

  private updatePauseButton(): void {
    document.getElementById("btn-pause")!.textContent = this.paused ? "▶" : "⏸";
  }

  private updateSpeedButtons(): void {
    document.querySelectorAll<HTMLButtonElement>(".tc-btn.speed").forEach((b) => {
      b.classList.toggle("on", Number(b.dataset.speed) === this.speed);
    });
  }

  private cycleTheme(): void {
    this.theme = nextTheme(this.theme);
    applyTheme(this.theme);
    this.renderer.setTheme(this.theme);
    this.panels.setTheme(this.theme);
    if (this.activeTab === "lexicon") this.panels.refreshLexicon();
  }

  private switchTab(tab: string): void {
    this.activeTab = tab;
    document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    document.querySelectorAll<HTMLElement>(".tab-page").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${tab}`);
    });
    if (tab === "chronicle") document.getElementById("chron-badge")!.hidden = true;
    if (tab === "almanac") this.panels.refreshAlmanac();
    if (tab === "lexicon") this.panels.refreshLexicon();
    if (tab === "inspect") this.panels.refreshInspect();
  }
}

// theme cycle hint: show all three labels in the title
export const THEME_LABELS = THEMES.map((t) => t.label).join(" · ");
