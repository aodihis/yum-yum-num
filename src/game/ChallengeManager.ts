import { createRng, pick, randInt, shuffle, type Rng } from "./random";
import {
  ANIMALS,
  FAVORITE_ITEM,
  type ChallengeLayout,
  type Level,
  type Spot,
  type Target,
} from "./types";

/** Ground rectangle where collectibles may be placed (world units). */
export const PLAY_AREA = { minX: -2.2, maxX: 2.2, minZ: -0.1, maxZ: 2.4 } as const;
/** Minimum centre-to-centre distance so every object stays an easy, separate tap target. */
export const MIN_SPACING = 1.25;
export const MAX_AVAILABLE = 5;
/** Challenges in a row finished without help or undo before moving up a level. */
export const STREAK_TO_LEVEL_UP = 3;

/**
 * Generates counting challenges.
 *
 * Levels (never advanced by challenge count alone, only by a streak of
 * independent completions, and never moved down):
 *  1. Few extra objects, neatly lined up with wide gaps.
 *  2. More extra objects, scattered in varied positions.
 *  3. Same as 2; the game additionally shows a "numeral = quantity" card on completion.
 */
export class ChallengeManager {
  private readonly rng: Rng;
  private targetBag: Target[] = [];
  private lastAnimal: (typeof ANIMALS)[number] | null = null;
  private nextId = 1;
  private streak = 0;
  level: Level;

  constructor(readonly seed: number, startLevel: Level = 1) {
    this.rng = createRng(seed);
    this.level = startLevel;
  }

  next(): ChallengeLayout {
    const animal = pick(this.rng, ANIMALS.filter((a) => a !== this.lastAnimal));
    this.lastAnimal = animal;
    const target = this.drawTarget();
    const maxExtra = this.level === 1 ? 1 : 2;
    const available = Math.min(MAX_AVAILABLE, target + randInt(this.rng, 1, maxExtra));
    const positions =
      this.level === 1 ? rowLayout(available) : scatterLayout(this.rng, available);
    return {
      id: this.nextId++,
      level: this.level,
      animal,
      item: FAVORITE_ITEM[animal],
      target,
      available,
      positions,
    };
  }

  /** Report how the last challenge went; `independent` means no help and no undo. */
  recordResult(independent: boolean): void {
    this.streak = independent ? this.streak + 1 : 0;
    if (this.streak >= STREAK_TO_LEVEL_UP && this.level < 3) {
      this.level = (this.level + 1) as Level;
      this.streak = 0;
    }
  }

  /** Shuffled bag of 1..3 so every quantity comes up regularly without long repeats. */
  private drawTarget(): Target {
    if (this.targetBag.length === 0) this.targetBag = shuffle(this.rng, [1, 2, 3] as Target[]);
    return this.targetBag.pop()!;
  }
}

export function rowLayout(count: number): Spot[] {
  const width = PLAY_AREA.maxX - PLAY_AREA.minX;
  const spacing = count > 1 ? Math.min(1.7, width / (count - 1)) : 0;
  const zigzag = spacing < MIN_SPACING;
  const midZ = (PLAY_AREA.minZ + PLAY_AREA.maxZ) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: (i - (count - 1) / 2) * spacing,
    z: zigzag ? midZ + (i % 2 === 0 ? -0.55 : 0.55) : midZ,
  }));
}

export function scatterLayout(rng: Rng, count: number): Spot[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const spots: Spot[] = [];
    for (let tries = 0; tries < 200 && spots.length < count; tries++) {
      const spot = {
        x: PLAY_AREA.minX + rng() * (PLAY_AREA.maxX - PLAY_AREA.minX),
        z: PLAY_AREA.minZ + rng() * (PLAY_AREA.maxZ - PLAY_AREA.minZ),
      };
      if (spots.every((s) => Math.hypot(s.x - spot.x, s.z - spot.z) >= MIN_SPACING)) {
        spots.push(spot);
      }
    }
    if (spots.length === count) return spots;
  }
  return rowLayout(count);
}
