export type Easing = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t ** 3,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
} satisfies Record<string, Easing>;

interface Tween {
  elapsed: number;
  duration: number;
  delay: number;
  easing: Easing;
  group: string;
  update: (k: number) => void;
  resolve: (finished: boolean) => void;
}

export interface TweenOptions {
  duration: number;
  delay?: number;
  easing?: Easing;
  /** Tag used to cancel related tweens together. */
  group?: string;
  update?: (k: number) => void;
}

/**
 * Minimal tween runner driven by the render loop. Promises resolve with `true`
 * when a tween finishes and `false` when it is cancelled, so async flows never hang.
 */
export class Tweens {
  private list: Tween[] = [];

  add(opts: TweenOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.list.push({
        elapsed: 0,
        duration: Math.max(opts.duration, 1e-4),
        delay: opts.delay ?? 0,
        easing: opts.easing ?? ease.outCubic,
        group: opts.group ?? "",
        update: opts.update ?? (() => {}),
        resolve,
      });
    });
  }

  wait(seconds: number, group = ""): Promise<boolean> {
    return this.add({ duration: seconds, group });
  }

  update(dt: number): void {
    const done: Tween[] = [];
    for (const tw of this.list.slice()) {
      tw.elapsed += dt;
      const t = (tw.elapsed - tw.delay) / tw.duration;
      if (t < 0) continue;
      const clamped = Math.min(t, 1);
      tw.update(tw.easing(clamped));
      if (clamped >= 1) done.push(tw);
    }
    if (done.length === 0) return;
    this.list = this.list.filter((tw) => !done.includes(tw));
    for (const tw of done) tw.resolve(true);
  }

  cancelGroup(group: string): void {
    this.cancelWhere((tw) => tw.group === group);
  }

  cancelAll(): void {
    this.cancelWhere(() => true);
  }

  private cancelWhere(match: (tw: Tween) => boolean): void {
    const cancelled = this.list.filter(match);
    this.list = this.list.filter((tw) => !match(tw));
    for (const tw of cancelled) tw.resolve(false);
  }
}
