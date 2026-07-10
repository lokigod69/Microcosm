// Minimal rAF spring + momentum helpers, per the fluid-interface rules:
// animate from the current value, accept initial velocity, always interruptible.

export interface SpringOpts {
  /** apple-style response, seconds (how fast it approaches) */
  response?: number;
  /** 1.0 = critically damped (default), <1 overshoots */
  damping?: number;
}

export class Spring {
  value: number;
  velocity = 0;
  target: number;
  private stiffness: number;
  private dampingCoeff: number;

  constructor(value: number, opts: SpringOpts = {}) {
    this.value = value;
    this.target = value;
    const response = opts.response ?? 0.3;
    const damping = opts.damping ?? 1.0;
    const omega = (2 * Math.PI) / response;
    this.stiffness = omega * omega;
    this.dampingCoeff = 2 * damping * omega;
  }

  /** retarget without killing velocity — the anti-brick-wall rule */
  setTarget(t: number): void {
    this.target = t;
  }

  /** advance by dt seconds; returns true while still moving */
  step(dt: number): boolean {
    const d = Math.min(dt, 1 / 30); // clamp huge frames
    const displacement = this.value - this.target;
    const accel = -this.stiffness * displacement - this.dampingCoeff * this.velocity;
    this.velocity += accel * d;
    this.value += this.velocity * d;
    if (Math.abs(this.velocity) < 0.001 && Math.abs(this.value - this.target) < 0.001) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }
}

/** Apple's momentum projection: where would this velocity coast to? */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** progressive edge resistance */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** small pointer-velocity tracker (px/s) from recent samples */
export class VelocityTracker {
  private samples: { t: number; x: number; y: number }[] = [];

  add(x: number, y: number): void {
    const t = performance.now();
    this.samples.push({ t, x, y });
    while (this.samples.length > 6 || (this.samples.length > 1 && t - this.samples[0].t > 120)) {
      this.samples.shift();
    }
  }

  velocity(): { vx: number; vy: number } {
    if (this.samples.length < 2) return { vx: 0, vy: 0 };
    const a = this.samples[0];
    const b = this.samples[this.samples.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return { vx: 0, vy: 0 };
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  }

  reset(): void {
    this.samples.length = 0;
  }
}

export const reducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
