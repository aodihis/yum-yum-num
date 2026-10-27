import { describe, expect, it } from "vitest";
import {
  ChallengeManager,
  MAX_AVAILABLE,
  MIN_SPACING,
  PLAY_AREA,
  STREAK_TO_LEVEL_UP,
  rowLayout,
} from "./ChallengeManager";
import { FAVORITE_ITEM, type Level } from "./types";

function spacingOk(positions: { x: number; z: number }[]) {
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++) {
      const d = Math.hypot(positions[i].x - positions[j].x, positions[i].z - positions[j].z);
      if (d < MIN_SPACING - 1e-9) return false;
    }
  return true;
}

describe("ChallengeManager", () => {
  it.each([1, 2, 3] as Level[])("generates valid challenges at level %i", (level) => {
    for (let seed = 1; seed <= 200; seed++) {
      const cm = new ChallengeManager(seed, level);
      for (let n = 0; n < 12; n++) {
        const ch = cm.next();
        expect([1, 2, 3]).toContain(ch.target);
        expect(ch.item).toBe(FAVORITE_ITEM[ch.animal]);
        expect(ch.available).toBeGreaterThan(ch.target);
        expect(ch.available).toBeLessThanOrEqual(MAX_AVAILABLE);
        expect(ch.positions).toHaveLength(ch.available);
        expect(spacingOk(ch.positions)).toBe(true);
        for (const p of ch.positions) {
          expect(p.x).toBeGreaterThanOrEqual(PLAY_AREA.minX);
          expect(p.x).toBeLessThanOrEqual(PLAY_AREA.maxX);
          expect(p.z).toBeGreaterThanOrEqual(PLAY_AREA.minZ);
          expect(p.z).toBeLessThanOrEqual(PLAY_AREA.maxZ);
        }
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const a = new ChallengeManager(42);
    const b = new ChallengeManager(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toEqual(b.next());
  });

  it("covers every animal and every target, and never repeats an animal back to back", () => {
    const cm = new ChallengeManager(7);
    const seen = new Set<string>();
    let prev = "";
    for (let i = 0; i < 30; i++) {
      const ch = cm.next();
      expect(ch.animal).not.toBe(prev);
      prev = ch.animal;
      seen.add(`${ch.animal}`);
      seen.add(`t${ch.target}`);
    }
    expect(seen).toEqual(new Set(["monkey", "rabbit", "elephant", "t1", "t2", "t3"]));
  });

  it("each block of three challenges uses targets 1, 2 and 3", () => {
    const cm = new ChallengeManager(99);
    for (let block = 0; block < 5; block++) {
      const targets = [cm.next(), cm.next(), cm.next()].map((c) => c.target).sort();
      expect(targets).toEqual([1, 2, 3]);
    }
  });

  it("levels up only after a streak of independent completions", () => {
    const cm = new ChallengeManager(1);
    for (let i = 0; i < 10; i++) {
      cm.next();
      cm.recordResult(false);
    }
    expect(cm.level).toBe(1);
    for (let i = 0; i < STREAK_TO_LEVEL_UP - 1; i++) cm.recordResult(true);
    cm.recordResult(false);
    expect(cm.level).toBe(1);
    for (let i = 0; i < STREAK_TO_LEVEL_UP; i++) cm.recordResult(true);
    expect(cm.level).toBe(2);
    for (let i = 0; i < STREAK_TO_LEVEL_UP * 3; i++) cm.recordResult(true);
    expect(cm.level).toBe(3);
  });

  it("row layout keeps spacing for every possible count", () => {
    for (let n = 1; n <= MAX_AVAILABLE; n++) expect(spacingOk(rowLayout(n))).toBe(true);
  });
});
