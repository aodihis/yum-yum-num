import type { ChallengeLayout } from "./types";

export type GamePhase = "READY" | "INSTRUCTION" | "COUNTING" | "CELEBRATING";

const TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  READY: ["INSTRUCTION"],
  INSTRUCTION: ["COUNTING"],
  COUNTING: ["CELEBRATING"],
  CELEBRATING: [],
};

export type CollectResult =
  | { kind: "counted"; count: number; completed: boolean }
  | { kind: "already" }
  | { kind: "ignored" };

/**
 * The counting rules, independent of rendering. Every selection goes through
 * `collect`, which is the single place a count can change.
 */
export class GameState {
  phase: GamePhase = "READY";
  challenge: ChallengeLayout | null = null;
  /** Child asked for or was offered help, or used undo, during this challenge. */
  neededSupport = false;
  private collected: number[] = [];

  get count(): number {
    return this.collected.length;
  }

  get collectedIndices(): readonly number[] {
    return this.collected;
  }

  isCollected(index: number): boolean {
    return this.collected.includes(index);
  }

  /** Return to READY from any phase, dropping the current challenge. */
  reset(): void {
    this.phase = "READY";
    this.challenge = null;
    this.collected = [];
    this.neededSupport = false;
  }

  begin(challenge: ChallengeLayout): void {
    if (challenge.available < challenge.target) {
      throw new Error(`Challenge ${challenge.id} cannot be completed`);
    }
    this.go("INSTRUCTION");
    this.challenge = challenge;
    this.collected = [];
    this.neededSupport = false;
  }

  startCounting(): void {
    this.go("COUNTING");
  }

  collect(index: number): CollectResult {
    const ch = this.challenge;
    if (this.phase !== "COUNTING" || !ch) return { kind: "ignored" };
    if (!Number.isInteger(index) || index < 0 || index >= ch.available) return { kind: "ignored" };
    if (this.collected.includes(index)) return { kind: "already" };
    this.collected.push(index);
    const completed = this.collected.length >= ch.target;
    if (completed) this.go("CELEBRATING");
    return { kind: "counted", count: this.collected.length, completed };
  }

  /** Undo the most recent selection. Returns its index, or null if nothing can be undone. */
  undo(): number | null {
    if (this.phase !== "COUNTING" || this.collected.length === 0) return null;
    this.neededSupport = true;
    return this.collected.pop()!;
  }

  private go(next: GamePhase): void {
    if (!TRANSITIONS[this.phase].includes(next)) {
      throw new Error(`Invalid transition ${this.phase} -> ${next}`);
    }
    this.phase = next;
  }
}
