import { describe, expect, it } from "vitest";
import { GameState } from "./GameState";
import type { ChallengeLayout, Target } from "./types";

function challenge(target: Target, available = target + 2): ChallengeLayout {
  return {
    id: 1,
    level: 1,
    animal: "monkey",
    item: "banana",
    target,
    available,
    positions: Array.from({ length: available }, (_, i) => ({ x: i, z: 0 })),
  };
}

function counting(target: Target) {
  const s = new GameState();
  s.begin(challenge(target));
  s.startCounting();
  return s;
}

describe("GameState", () => {
  it.each([1, 2, 3] as Target[])("completes exactly at target %i", (target) => {
    const s = counting(target);
    for (let i = 0; i < target - 1; i++) {
      expect(s.collect(i)).toEqual({ kind: "counted", count: i + 1, completed: false });
      expect(s.phase).toBe("COUNTING");
    }
    expect(s.collect(target - 1)).toEqual({ kind: "counted", count: target, completed: true });
    expect(s.phase).toBe("CELEBRATING");
  });

  it("counts each object at most once", () => {
    const s = counting(3);
    s.collect(0);
    expect(s.collect(0)).toEqual({ kind: "already" });
    expect(s.collect(0)).toEqual({ kind: "already" });
    expect(s.count).toBe(1);
  });

  it("ignores selections outside COUNTING and after completion", () => {
    const s = new GameState();
    expect(s.collect(0).kind).toBe("ignored");
    s.begin(challenge(1));
    expect(s.collect(0).kind).toBe("ignored"); // still in INSTRUCTION
    s.startCounting();
    s.collect(0);
    expect(s.collect(1).kind).toBe("ignored"); // celebrating
    expect(s.count).toBe(1);
  });

  it("ignores out-of-range indices", () => {
    const s = counting(2);
    expect(s.collect(-1).kind).toBe("ignored");
    expect(s.collect(99).kind).toBe("ignored");
    expect(s.collect(0.5).kind).toBe("ignored");
    expect(s.count).toBe(0);
  });

  it("extra taps cannot leak into the next challenge", () => {
    const s = counting(1);
    s.collect(0);
    s.collect(1);
    s.reset();
    s.begin(challenge(3));
    s.startCounting();
    expect(s.count).toBe(0);
    s.collect(1);
    expect(s.phase).toBe("COUNTING");
  });

  it("undoes the most recent selection only while counting", () => {
    const s = counting(3);
    expect(s.undo()).toBeNull();
    s.collect(2);
    s.collect(4);
    expect(s.undo()).toBe(4);
    expect(s.count).toBe(1);
    expect(s.isCollected(4)).toBe(false);
    expect(s.neededSupport).toBe(true);
    expect(s.collect(4).kind).toBe("counted");
    s.collect(0);
    expect(s.phase).toBe("CELEBRATING");
    expect(s.undo()).toBeNull();
  });

  it("rejects invalid transitions and impossible challenges", () => {
    const s = new GameState();
    expect(() => s.startCounting()).toThrow();
    expect(() => s.begin(challenge(3, 2))).toThrow();
    s.begin(challenge(1));
    expect(() => s.begin(challenge(1))).toThrow();
  });
});
