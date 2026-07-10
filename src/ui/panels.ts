// DOM panels: Chronicle, Inspect, Almanac, Lexicon. Read-only views of the world.

import type { World, Kin, Tribe, Settlement } from "../sim/types";
import { BIOMES, GENES, idx, DAYS_PER_YEAR } from "../sim/types";
import { formatDate } from "../sim/time";
import type { Selection } from "./renderer";
import type { Theme } from "./themes";
import { tribeColor } from "./themes";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** escape, then *word* → <em>word</em> (chronicler marks in-world words with asterisks) */
function rich(s: string): string {
  return esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export type PanelSelection = Selection | { kind: "tribe"; id: number };

export class Panels {
  private world: () => World | null;
  private theme: Theme;
  private chronEl = document.getElementById("tab-chronicle")!;
  private inspectEl = document.getElementById("tab-inspect")!;
  private almanacEl = document.getElementById("tab-almanac")!;
  private lexiconEl = document.getElementById("tab-lexicon")!;
  private renderedChapters = 0;
  private shown: PanelSelection = null;
  onCenter: (x: number, y: number) => void = () => {};

  constructor(getWorld: () => World | null, theme: Theme) {
    this.world = getWorld;
    this.theme = theme;
    for (const el of [this.inspectEl, this.almanacEl, this.lexiconEl]) {
      el.addEventListener("click", (e) => this.handleLink(e));
    }
  }

  setTheme(t: Theme): void {
    this.theme = t;
    this.refreshAlmanac();
  }

  reset(): void {
    this.renderedChapters = 0;
    this.shown = null;
    this.chronEl.innerHTML = "";
    this.inspectEl.innerHTML = `<p class="empty">Click a kin, settlement, or tile on the map.</p>`;
  }

  private handleLink(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-sel]");
    if (!t) return;
    const [kind, id] = t.dataset.sel!.split(":");
    if (kind === "tribe") this.show({ kind: "tribe", id: Number(id) });
    if (kind === "kin") this.show({ kind: "kin", id: Number(id) });
    if (kind === "settlement") this.show({ kind: "settlement", id: Number(id) });
  }

  /** returns true if a new chapter appeared (for the tab badge) */
  refreshChronicle(): boolean {
    const world = this.world();
    if (!world) return false;
    const chapters = world.chronicle;
    if (chapters.length === this.renderedChapters) return false;
    for (let i = this.renderedChapters; i < chapters.length; i++) {
      const ch = chapters[i];
      const el = document.createElement("article");
      el.className = "chapter materialize";
      el.innerHTML =
        `<header class="chapter-head">` +
        `<div class="chapter-kicker">Chapter ${ch.index} · Year ${ch.year} · ${esc(ch.season)}</div>` +
        `<h2 class="chapter-title">${rich(ch.title)}</h2></header>` +
        `<div class="voice-myth">${ch.myth.map((p) => `<p>${rich(p)}</p>`).join("")}</div>` +
        `<div class="voice-observer">${ch.observer.map((p) => `<p>${rich(p)}</p>`).join("")}</div>`;
      this.chronEl.prepend(el);
    }
    while (this.chronEl.children.length > 60) this.chronEl.lastElementChild?.remove();
    this.renderedChapters = chapters.length;
    return true;
  }

  show(sel: PanelSelection): void {
    this.shown = sel;
    this.refreshInspect();
  }

  refreshInspect(): void {
    const world = this.world();
    const sel = this.shown;
    if (!world || !sel) return;
    let html = "";
    if (sel.kind === "kin") {
      const kin = world.kin.get(sel.id);
      html = kin ? this.kinCard(world, kin) : `<p class="empty">Gone.</p>`;
    } else if (sel.kind === "settlement") {
      const s = world.settlements.get(sel.id);
      html = s ? this.settlementCard(world, s) : `<p class="empty">Gone.</p>`;
    } else if (sel.kind === "tribe") {
      const t = world.tribes.get(sel.id);
      html = t ? this.tribeCard(world, t) : `<p class="empty">Gone.</p>`;
    } else if (sel.kind === "tile") {
      html = this.tileCard(world, sel.x, sel.y);
    }
    this.inspectEl.innerHTML = html;
  }

  private tribeLink(world: World, tribeId: number): string {
    const t = world.tribes.get(tribeId);
    if (!t) return "—";
    return `<span class="linklike" data-sel="tribe:${t.id}"><span class="swatch" style="background:${tribeColor(this.theme, t.color)}"></span>${esc(t.name)}</span>`;
  }

  private kinCard(world: World, kin: Kin): string {
    const years = Math.floor(kin.ageDays / DAYS_PER_YEAR);
    const genes = GENES.map(
      (g) => `<span class="gene">${g} ${(kin.genome[g] * 100).toFixed(0)}</span>`,
    ).join("");
    const status = kin.alive
      ? esc(kin.action)
      : `died of ${esc(kin.deathCause ?? "unknown causes")}`;
    return (
      `<div class="card"><h3 class="card-title">${esc(kin.name)}${kin.epithet ? ` <em>${esc(kin.epithet)}</em>` : ""}</h3>` +
      `<div class="card-sub">${kin.hero ? "Hero of " : ""}${this.tribeLink(world, kin.tribeId)}</div>` +
      `<dl class="kv">` +
      `<dt>age</dt><dd>${years} years</dd>` +
      `<dt>status</dt><dd>${status}</dd>` +
      `<dt>health</dt><dd>${(kin.health * 100).toFixed(0)}%</dd>` +
      `<dt>renown</dt><dd>${kin.renown.toFixed(0)}</dd>` +
      (kin.partnerId !== null && world.kin.get(kin.partnerId)
        ? `<dt>partner</dt><dd><span class="linklike" data-sel="kin:${kin.partnerId}">${esc(world.kin.get(kin.partnerId)!.name)}</span></dd>`
        : "") +
      `<dt>children</dt><dd>${kin.childIds.length}</dd>` +
      `</dl><div class="genes">${genes}</div></div>`
    );
  }

  private settlementCard(world: World, s: Settlement): string {
    const pop = [...world.kin.values()].filter(
      (k) => k.alive && Math.hypot(k.x - s.x, k.y - s.y) < 4,
    ).length;
    return (
      `<div class="card"><h3 class="card-title">${esc(s.name)}</h3>` +
      `<div class="card-sub">${esc(s.tier)} of ${this.tribeLink(world, s.tribeId)}</div>` +
      `<dl class="kv">` +
      `<dt>founded</dt><dd>Year ${Math.floor(s.foundedTick / DAYS_PER_YEAR) + 1}</dd>` +
      `<dt>nearby kin</dt><dd>${pop}</dd>` +
      `</dl></div>`
    );
  }

  private tribeCard(world: World, t: Tribe): string {
    const members = t.memberIds
      .map((id) => world.kin.get(id))
      .filter((k): k is Kin => !!k && k.alive);
    const chief = t.chiefId !== null ? world.kin.get(t.chiefId) : null;
    const gods = t.godIds
      .map((id) => world.gods.get(id))
      .filter(Boolean)
      .map((g) => `${esc(g!.name)} <span class="c">(${esc(g!.domain)})</span>`)
      .join(", ");
    const culture = Object.entries(t.culture)
      .map(([k, v]) => `<span class="gene">${k} ${(v * 100).toFixed(0)}</span>`)
      .join("");
    return (
      `<div class="card"><h3 class="card-title">${esc(t.name)}</h3>` +
      `<div class="card-sub">${t.extinct ? "extinct tribe" : `${members.length} living kin`}</div>` +
      `<dl class="kv">` +
      (chief
        ? `<dt>chief</dt><dd><span class="linklike" data-sel="kin:${chief.id}">${esc(chief.name)}</span></dd>`
        : "") +
      `<dt>gods</dt><dd>${gods || "none yet"}</dd>` +
      `<dt>arts</dt><dd>${t.techs.map(esc).join(", ") || "none"}</dd>` +
      `<dt>words</dt><dd>${Object.keys(t.lexicon).length} coined</dd>` +
      `</dl><div class="genes">${culture}</div></div>`
    );
  }

  private tileCard(world: World, x: number, y: number): string {
    const i = idx(x, y);
    const biome = BIOMES[world.map.biome[i]];
    return (
      `<div class="card"><h3 class="card-title">${esc(biome)}</h3>` +
      `<div class="card-sub">tile ${x}, ${y}</div>` +
      `<dl class="kv">` +
      `<dt>elevation</dt><dd>${(world.map.elevation[i] * 100).toFixed(0)}</dd>` +
      `<dt>fertility</dt><dd>${(world.map.fertility[i] * 100).toFixed(0)}</dd>` +
      `<dt>vegetation</dt><dd>${(world.map.vegetation[i] * 100).toFixed(0)}</dd>` +
      (world.map.glimmer[i] ? `<dt>glimmer</dt><dd>✦ deposit</dd>` : "") +
      `</dl></div>`
    );
  }

  refreshAlmanac(): void {
    const world = this.world();
    if (!world) return;
    const tribes = [...world.tribes.values()].filter((t) => !t.extinct);
    const gods = [...world.gods.values()].sort((a, b) => b.attributions - a.attributions);
    const heroes = [...world.kin.values()]
      .filter((k) => k.hero)
      .sort((a, b) => b.renown - a.renown)
      .slice(0, 12);
    const pop = [...world.kin.values()].filter((k) => k.alive).length;

    let html = `<div class="al-section"><div class="al-h">${formatDate(world.tick)} · ${pop} kin</div><canvas class="spark" id="pop-spark"></canvas></div>`;

    html += `<div class="al-section"><div class="al-h">Tribes</div>`;
    for (const t of tribes) {
      const alive = t.memberIds.filter((id) => world.kin.get(id)?.alive).length;
      html +=
        `<div class="al-row"><span class="name linklike" data-sel="tribe:${t.id}">` +
        `<span class="swatch" style="background:${tribeColor(this.theme, t.color)}"></span>${esc(t.name)}</span>` +
        `<span class="meta">${alive} kin · ${t.techs.length} arts · ${t.godIds.length} gods</span></div>`;
    }
    html += `</div>`;

    if (gods.length) {
      html += `<div class="al-section"><div class="al-h">Gods & Spirits</div>`;
      for (const g of gods.slice(0, 12)) {
        html += `<div class="al-row"><span class="name">${esc(g.name)}</span><span class="meta">${esc(g.domain)} · ${esc(g.mood)}${g.promoted ? " · god" : " · spirit"}</span></div>`;
      }
      html += `</div>`;
    }

    if (heroes.length) {
      html += `<div class="al-section"><div class="al-h">Heroes</div>`;
      for (const h of heroes) {
        html += `<div class="al-row"><span class="name linklike" data-sel="kin:${h.id}">${esc(h.name)}</span><span class="meta">${h.alive ? "" : "† "}renown ${h.renown.toFixed(0)}</span></div>`;
      }
      html += `</div>`;
    }

    this.almanacEl.innerHTML = html;
    this.drawSpark(world);
  }

  private drawSpark(world: World): void {
    const c = document.getElementById("pop-spark") as HTMLCanvasElement | null;
    if (!c || world.stats.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    const samples = world.stats;
    const maxPop = Math.max(...samples.map((s) => s.population), 10);
    const px = (i: number) => (i / (samples.length - 1)) * c.width;
    const py = (v: number) => c.height - (v / maxPop) * (c.height - 6) - 3;

    const style = getComputedStyle(document.documentElement);
    ctx.strokeStyle = style.getPropertyValue("--accent-strong").trim() || "#888";
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    samples.forEach((s, i) => (i === 0 ? ctx.moveTo(px(i), py(s.population)) : ctx.lineTo(px(i), py(s.population))));
    ctx.stroke();
  }

  refreshLexicon(): void {
    const world = this.world();
    if (!world) return;
    let html = "";
    for (const t of world.tribes.values()) {
      if (t.extinct) continue;
      const entries = Object.entries(t.lexicon).sort((a, b) => a[0].localeCompare(b[0]));
      if (!entries.length) continue;
      html += `<div class="lex-tribe"><div class="al-h"><span class="swatch" style="background:${tribeColor(this.theme, t.color)}"></span>${esc(t.name)} — ${entries.length} words</div>`;
      for (const [concept, e] of entries) {
        html +=
          `<div class="lex-word"><span><span class="w">${esc(e.word)}</span>` +
          (e.oldForms.length ? ` <span class="old">(older: ${esc(e.oldForms.join(", "))})</span>` : "") +
          `</span><span class="c">${esc(concept)}${e.borrowedFrom !== null ? " · borrowed" : ""}</span></div>`;
      }
      html += `</div>`;
    }
    this.lexiconEl.innerHTML = html || `<p class="empty">No words coined yet.</p>`;
  }
}
