// Canvas map renderer: static terrain layer + live overlay (settlements, kin,
// pulses, selection), with a fluid camera (1:1 drag, momentum, rubber-band edges).

import type { World, WorldEvent, Settlement, Kin } from "../sim/types";
import { WORLD_W, WORLD_H, BIOMES, idx } from "../sim/types";
import { Spring, VelocityTracker, project, rubberband, reducedMotion } from "./spring";
import type { Theme } from "./themes";
import { tribeColor } from "./themes";

export type Selection =
  | { kind: "kin"; id: number }
  | { kind: "settlement"; id: number }
  | { kind: "tile"; x: number; y: number }
  | null;

interface Pulse {
  x: number;
  y: number;
  born: number; // performance.now()
  omen: boolean;
}

const PULSE_KINDS = new Set([
  "god.born",
  "god.promoted",
  "myth.born",
  "discovery",
  "settlement.founded",
  "settlement.sacked",
  "tribe.split",
  "tribe.formed",
  "war.start",
  "war.end",
  "raid",
  "hero.risen",
  "glimmer.found",
]);
const OMEN_KINDS = new Set([
  "omen.eclipse",
  "omen.comet",
  "omen.aurora",
  "omen.drought",
  "omen.earthquake",
  "plague.start",
]);

export class MapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement; // offscreen, 1px per tile × TSCALE
  private terrainDirty = true;
  private theme: Theme;
  private getWorld: () => World | null;
  private pulses: Pulse[] = [];
  private dpr = 1;

  // camera: world-tile coords at canvas center + scale (device px per tile)
  private camX = new Spring(WORLD_W / 2, { response: 0.35 });
  private camY = new Spring(WORLD_H / 2, { response: 0.35 });
  private scale = WORLD_W; // recomputed on first resize
  private minScale = 4;
  private maxScale = 48;

  private dragging = false;
  private dragPointer = -1;
  private lastPX = 0;
  private lastPY = 0;
  private tracker = new VelocityTracker();
  private movedSinceDown = 0;
  private arrestedMomentum = false;
  // raw (un-rubber-banded) drag position; banding always applies to this, never
  // to an already-banded value, so resistance doesn't compound
  private rawX = 0;
  private rawY = 0;

  // two-finger pinch: zoom anchored to the moving midpoint, so one gesture
  // pans and zooms at once; a surviving finger inherits the camera as a drag
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchIds: [number, number] | null = null;
  private pinchMidX = 0;
  private pinchMidY = 0;
  private pinchDist = 0;

  selection: Selection = null;
  onSelect: (sel: Selection) => void = () => {};

  constructor(canvas: HTMLCanvasElement, theme: Theme, getWorld: () => World | null) {
    this.canvas = canvas;
    this.theme = theme;
    this.getWorld = getWorld;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.terrain = document.createElement("canvas");
    this.terrain.width = WORLD_W * 4;
    this.terrain.height = WORLD_H * 4;
    this.bindInput();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement ?? canvas);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.terrainDirty = true;
  }

  worldChanged(): void {
    this.terrainDirty = true;
    this.pulses.length = 0;
    this.selection = null;
  }

  notifyEvents(events: WorldEvent[]): void {
    for (const e of events) {
      if (!e.pos) continue;
      const omen = OMEN_KINDS.has(e.kind);
      if (omen || PULSE_KINDS.has(e.kind)) {
        this.pulses.push({ x: e.pos.x, y: e.pos.y, born: performance.now(), omen });
      }
    }
    if (this.pulses.length > 60) this.pulses.splice(0, this.pulses.length - 60);
  }

  // ---------- camera helpers ----------

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    const fit = Math.min(this.canvas.width / WORLD_W, this.canvas.height / WORLD_H);
    this.minScale = fit * 0.9;
    if (this.scale === WORLD_W || this.scale < this.minScale) this.scale = fit;
    // shrinking the window can strand a previously legal camera outside the new
    // bounds; pull it back in rather than showing void until the next gesture
    if (!this.dragging) {
      this.clampTargets();
      if (reducedMotion()) {
        this.camX.value = this.camX.target;
        this.camY.value = this.camY.target;
      }
    }
  }

  private toScreen(wx: number, wy: number): [number, number] {
    return [
      this.canvas.width / 2 + (wx - this.camX.value) * this.scale,
      this.canvas.height / 2 + (wy - this.camY.value) * this.scale,
    ];
  }

  private toWorld(sx: number, sy: number): [number, number] {
    return [
      this.camX.value + (sx - this.canvas.width / 2) / this.scale,
      this.camY.value + (sy - this.canvas.height / 2) / this.scale,
    ];
  }

  private bounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const halfW = this.canvas.width / 2 / this.scale;
    const halfH = this.canvas.height / 2 / this.scale;
    const pad = 6;
    return {
      minX: Math.min(halfW - pad, WORLD_W / 2),
      maxX: Math.max(WORLD_W - halfW + pad, WORLD_W / 2),
      minY: Math.min(halfH - pad, WORLD_H / 2),
      maxY: Math.max(WORLD_H - halfH + pad, WORLD_H / 2),
    };
  }

  private clampTargets(): void {
    const b = this.bounds();
    this.camX.setTarget(Math.max(b.minX, Math.min(b.maxX, this.camX.target)));
    this.camY.setTarget(Math.max(b.minY, Math.min(b.maxY, this.camY.target)));
  }

  // ---------- input ----------

  private bindInput(): void {
    const c = this.canvas;

    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinchIds) return; // third+ finger: held, but the pinch pair owns the camera
      if (this.pointers.size === 2) {
        this.beginPinch();
        return;
      }
      this.dragging = true;
      this.dragPointer = e.pointerId;
      this.lastPX = e.clientX;
      this.lastPY = e.clientY;
      this.movedSinceDown = 0;
      this.tracker.reset();
      this.tracker.add(e.clientX, e.clientY);
      // a tap that arrests visible momentum is a stop, not a click
      this.arrestedMomentum =
        Math.abs(this.camX.velocity) + Math.abs(this.camY.velocity) > 1.5;
      // grab: kill momentum, follow the finger (interruptible always)
      this.camX.setTarget(this.camX.value);
      this.camY.setTarget(this.camY.value);
      this.camX.velocity = 0;
      this.camY.velocity = 0;
      this.rawX = this.camX.value;
      this.rawY = this.camY.value;
      c.classList.add("dragging");
    });

    c.addEventListener("pointermove", (e) => {
      const pt = this.pointers.get(e.pointerId);
      if (pt) {
        pt.x = e.clientX;
        pt.y = e.clientY;
      }
      if (this.pinchIds) {
        if (e.pointerId === this.pinchIds[0] || e.pointerId === this.pinchIds[1]) {
          this.pinchMove();
        }
        return;
      }
      if (!this.dragging || e.pointerId !== this.dragPointer) return;
      const dx = (e.clientX - this.lastPX) * this.dpr;
      const dy = (e.clientY - this.lastPY) * this.dpr;
      this.lastPX = e.clientX;
      this.lastPY = e.clientY;
      this.movedSinceDown += Math.abs(dx) + Math.abs(dy);
      this.tracker.add(e.clientX, e.clientY);

      this.rawX -= dx / this.scale;
      this.rawY -= dy / this.scale;
      // rubber-band beyond the same bounds the camera settles to, applied to the
      // raw drag position so the resistance is stable while the finger is down
      const b = this.bounds();
      let nx = this.rawX;
      let ny = this.rawY;
      if (nx < b.minX) nx = b.minX + rubberband(nx - b.minX, WORLD_W);
      else if (nx > b.maxX) nx = b.maxX + rubberband(nx - b.maxX, WORLD_W);
      if (ny < b.minY) ny = b.minY + rubberband(ny - b.minY, WORLD_H);
      else if (ny > b.maxY) ny = b.maxY + rubberband(ny - b.maxY, WORLD_H);
      this.camX.value = nx;
      this.camY.value = ny;
      this.camX.setTarget(nx);
      this.camY.setTarget(ny);
    });

    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pinchIds) {
        if (e.pointerId !== this.pinchIds[0] && e.pointerId !== this.pinchIds[1]) return;
        this.pinchIds = null;
        if (this.pointers.size >= 2) {
          this.beginPinch();
          return;
        }
        const survivor = this.pointers.keys().next();
        if (!survivor.done) {
          // hand the camera to the remaining finger: pinch flows into a 1:1 drag
          const id = survivor.value;
          const p = this.pointers.get(id)!;
          this.dragging = true;
          this.dragPointer = id;
          this.lastPX = p.x;
          this.lastPY = p.y;
          this.movedSinceDown = Number.POSITIVE_INFINITY; // a pinch is never a tap
          this.tracker.reset();
          this.tracker.add(p.x, p.y);
          this.rawX = this.camX.value;
          this.rawY = this.camY.value;
        } else {
          c.classList.remove("dragging");
          this.clampTargets();
        }
        return;
      }
      if (!this.dragging || e.pointerId !== this.dragPointer) return;
      this.dragging = false;
      c.classList.remove("dragging");
      if (this.movedSinceDown < 6 * this.dpr) {
        if (!this.arrestedMomentum) this.click(e);
        this.clampTargets();
        return;
      }
      if (reducedMotion()) {
        this.clampTargets();
        this.camX.value = this.camX.target;
        this.camY.value = this.camY.target;
        return;
      }
      // momentum: project the release velocity, then spring there
      const { vx, vy } = this.tracker.velocity();
      this.camX.velocity = (-vx * this.dpr) / this.scale;
      this.camY.velocity = (-vy * this.dpr) / this.scale;
      this.camX.setTarget(this.camX.value + project(-vx * this.dpr) / this.scale);
      this.camY.setTarget(this.camY.value + project(-vy * this.dpr) / this.scale);
      this.clampTargets();
    };
    c.addEventListener("pointerup", release);
    c.addEventListener("pointercancel", release);

    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = c.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * this.dpr;
        const sy = (e.clientY - rect.top) * this.dpr;
        const [wx, wy] = this.toWorld(sx, sy);
        const factor = Math.exp(-e.deltaY * 0.0015);
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
        // keep the point under the cursor fixed
        this.camX.value = wx - (sx - this.canvas.width / 2) / this.scale;
        this.camY.value = wy - (sy - this.canvas.height / 2) / this.scale;
        this.camX.setTarget(this.camX.value);
        this.camY.setTarget(this.camY.value);
        this.clampTargets();
        this.camX.value = this.camX.target;
        this.camY.value = this.camY.target;
      },
      { passive: false },
    );
  }

  private beginPinch(): void {
    const it = this.pointers.keys();
    this.pinchIds = [it.next().value as number, it.next().value as number];
    this.dragging = false;
    this.canvas.classList.add("dragging");
    // grab: kill momentum, the fingers own the camera now (interruptible always)
    this.camX.setTarget(this.camX.value);
    this.camY.setTarget(this.camY.value);
    this.camX.velocity = 0;
    this.camY.velocity = 0;
    [this.pinchMidX, this.pinchMidY, this.pinchDist] = this.pinchGeom();
  }

  private pinchGeom(): [number, number, number] {
    const [a, b] = this.pinchIds!;
    const p = this.pointers.get(a)!;
    const q = this.pointers.get(b)!;
    return [
      (p.x + q.x) / 2,
      (p.y + q.y) / 2,
      Math.max(1, Math.hypot(q.x - p.x, q.y - p.y)),
    ];
  }

  private pinchMove(): void {
    const rect = this.canvas.getBoundingClientRect();
    const [mx, my, d] = this.pinchGeom();
    // the world point under the previous midpoint stays pinned under the current
    // one, so a single gesture zooms and pans together with no seam
    const [wx, wy] = this.toWorld(
      (this.pinchMidX - rect.left) * this.dpr,
      (this.pinchMidY - rect.top) * this.dpr,
    );
    this.scale = Math.max(
      this.minScale,
      Math.min(this.maxScale, this.scale * (d / this.pinchDist)),
    );
    const sx = (mx - rect.left) * this.dpr;
    const sy = (my - rect.top) * this.dpr;
    this.camX.value = wx - (sx - this.canvas.width / 2) / this.scale;
    this.camY.value = wy - (sy - this.canvas.height / 2) / this.scale;
    this.camX.setTarget(this.camX.value);
    this.camY.setTarget(this.camY.value);
    this.clampTargets();
    this.camX.value = this.camX.target;
    this.camY.value = this.camY.target;
    this.pinchMidX = mx;
    this.pinchMidY = my;
    this.pinchDist = d;
  }

  private click(e: PointerEvent): void {
    const world = this.getWorld();
    if (!world) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * this.dpr;
    const sy = (e.clientY - rect.top) * this.dpr;
    const [wx, wy] = this.toWorld(sx, sy);
    if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) return;

    // nearest living kin within ~0.8 tiles
    let bestKin: Kin | null = null;
    let bestD = 0.8;
    for (const kin of world.kin.values()) {
      if (!kin.alive) continue;
      const d = Math.hypot(kin.x + 0.5 - wx, kin.y + 0.5 - wy);
      if (d < bestD) {
        bestD = d;
        bestKin = kin;
      }
    }
    // settlement within ~1.2 tiles beats a kin slightly farther away
    let bestSet: Settlement | null = null;
    let bestSD = 1.2;
    for (const s of world.settlements.values()) {
      if (s.sacked) continue;
      const d = Math.hypot(s.x + 0.5 - wx, s.y + 0.5 - wy);
      if (d < bestSD) {
        bestSD = d;
        bestSet = s;
      }
    }

    if (bestKin && bestD <= bestSD) this.selection = { kind: "kin", id: bestKin.id };
    else if (bestSet) this.selection = { kind: "settlement", id: bestSet.id };
    else this.selection = { kind: "tile", x: Math.floor(wx), y: Math.floor(wy) };
    this.onSelect(this.selection);
  }

  centerOn(wx: number, wy: number): void {
    this.camX.setTarget(wx);
    this.camY.setTarget(wy);
    this.clampTargets();
  }

  // ---------- drawing ----------

  private renderTerrain(world: World): void {
    const t = this.terrain.getContext("2d");
    if (!t) return;
    const S = 4;
    const pal = this.theme.map;
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const i = idx(x, y);
        const biome = BIOMES[world.map.biome[i]];
        // deterministic per-tile shade variation from elevation fraction
        const e = world.map.elevation[i];
        const mix = (e * 7.13 + x * 0.37 + y * 0.61) % 1;
        t.fillStyle = mix < 0.5 ? pal.biomes[biome] : pal.biomesDark[biome];
        t.fillRect(x * S, y * S, S, S);
      }
    }
    // glimmer deposits: tiny bright specks
    t.fillStyle = pal.pulseOmen;
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (world.map.glimmer[idx(x, y)]) t.fillRect(x * S + 1, y * S + 1, 2, 2);
      }
    }
    this.terrainDirty = false;
  }

  frame(dt: number): void {
    const ctx = this.ctx;
    const world = this.getWorld();
    const pal = this.theme.map;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!world) return;
    if (this.terrainDirty) this.renderTerrain(world);

    if (!this.dragging) {
      this.camX.step(dt);
      this.camY.step(dt);
    }

    const [ox, oy] = this.toScreen(0, 0);
    const w = WORLD_W * this.scale;
    const h = WORLD_H * this.scale;
    ctx.imageSmoothingEnabled = this.scale < 8;
    ctx.drawImage(this.terrain, ox, oy, w, h);
    if (pal.gridVeil) {
      ctx.fillStyle = pal.gridVeil;
      ctx.fillRect(ox, oy, w, h);
    }

    const now = performance.now();

    // settlements
    for (const s of world.settlements.values()) {
      if (s.sacked) continue;
      const [sx, sy] = this.toScreen(s.x + 0.5, s.y + 0.5);
      const r = (s.tier === "town" ? 0.42 : s.tier === "village" ? 0.32 : 0.24) * this.scale;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = pal.settlementRing;
      ctx.fill();
      if (this.theme.id === "illuminated") {
        // tiny keep glyph
        ctx.fillStyle = pal.settlement;
        ctx.fillRect(sx - r * 0.7, sy - r * 0.3, r * 1.4, r * 1.1);
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.85, sy - r * 0.3);
        ctx.lineTo(sx, sy - r * 1.15);
        ctx.lineTo(sx + r * 0.85, sy - r * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = pal.settlement;
        ctx.fill();
      }
    }

    // kin dots, tribe-colored
    const kr = Math.max(1.4, this.scale * 0.13);
    for (const kin of world.kin.values()) {
      if (!kin.alive) continue;
      const tribe = world.tribes.get(kin.tribeId);
      const jx = ((kin.id * 0.618034) % 1) * 0.5 - 0.25;
      const jy = ((kin.id * 0.381966) % 1) * 0.5 - 0.25;
      const [sx, sy] = this.toScreen(kin.x + 0.5 + jx, kin.y + 0.5 + jy);
      ctx.beginPath();
      ctx.arc(sx, sy, kin.hero ? kr * 1.6 : kr, 0, Math.PI * 2);
      ctx.fillStyle = tribe
        ? tribeColor(this.theme, tribe.color, pal.kinAlpha)
        : `rgba(128,128,128,${pal.kinAlpha})`;
      ctx.fill();
    }

    // event pulses
    this.pulses = this.pulses.filter((p) => now - p.born < 1400);
    for (const p of this.pulses) {
      const age = (now - p.born) / 1400;
      const [sx, sy] = this.toScreen(p.x + 0.5, p.y + 0.5);
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + age * this.scale * 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = p.omen ? pal.pulseOmen : pal.pulse;
      ctx.globalAlpha = (1 - age) * 0.8;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // selection ring (soft pulse)
    const sel = this.selection;
    if (sel) {
      let px: number | null = null;
      let py: number | null = null;
      let pr = 0.6;
      if (sel.kind === "kin") {
        const kin = world.kin.get(sel.id);
        if (kin?.alive) {
          px = kin.x + 0.5;
          py = kin.y + 0.5;
          pr = 0.5;
        }
      } else if (sel.kind === "settlement") {
        const s = world.settlements.get(sel.id);
        if (s && !s.sacked) {
          px = s.x + 0.5;
          py = s.y + 0.5;
          pr = 0.8;
        }
      } else {
        px = sel.x + 0.5;
        py = sel.y + 0.5;
        pr = 0.72;
      }
      if (px !== null && py !== null) {
        const [sx, sy] = this.toScreen(px, py);
        const breathe = reducedMotion() ? 0 : Math.sin(now / 420) * 0.12 + 0.12;
        ctx.beginPath();
        ctx.arc(sx, sy, this.scale * (pr + breathe), 0, Math.PI * 2);
        ctx.strokeStyle = pal.selection;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}
