import type { ChallengeLayout, CollectibleType } from "../game/types";

export const ITEM_EMOJI: Record<CollectibleType, string> = {
  banana: "🍌",
  carrot: "🥕",
  apple: "🍎",
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

/** Restart a CSS animation class on an element. */
function replayClass(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export interface HudHandlers {
  onPlay: () => void;
  onReplay: () => void;
  onSound: () => void;
  onUndo: () => void;
  onNext: () => void;
}

/** HTML overlay: target numeral, progress slots and the large touch controls. */
export class HUD {
  readonly stage = $("stage");
  readonly canvas = $("scene") as HTMLCanvasElement;
  private readonly targetNum = $("target-num");
  private readonly targetDots = $("target-dots");
  private readonly progress = $("progress");
  private readonly undo = $("undo") as HTMLButtonElement;
  private readonly next = $("next") as HTMLButtonElement;
  private readonly sound = $("sound") as HTMLButtonElement;
  private readonly pops = $("pops");
  private readonly card = $("number-card");
  private readonly start = $("start");
  private slots: HTMLElement[] = [];

  constructor(h: HudHandlers) {
    const bind = (id: string, fn: () => void) =>
      $(id).addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
    bind("play", h.onPlay);
    bind("replay", h.onReplay);
    bind("sound", h.onSound);
    bind("undo", h.onUndo);
    bind("next", h.onNext);
  }

  hideStart(): void {
    this.start.classList.add("hidden");
  }

  setSound(on: boolean): void {
    this.sound.setAttribute("aria-pressed", String(on));
    this.sound.classList.toggle("muted", !on);
  }

  setChallenge(ch: ChallengeLayout): void {
    const emoji = ITEM_EMOJI[ch.item];
    this.targetNum.textContent = String(ch.target);
    this.targetNum.setAttribute("aria-label", `${ch.target} ${ch.item}${ch.target > 1 ? "s" : ""}`);
    this.targetDots.textContent = emoji.repeat(ch.target);
    replayClass(this.targetNum, "pulse");
    this.progress.replaceChildren();
    this.slots = Array.from({ length: ch.target }, (_, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.innerHTML = `<span class="slot-item">${emoji}</span><span class="slot-num">${i + 1}</span>`;
      this.progress.append(slot);
      return slot;
    });
    this.progress.setAttribute("aria-label", `0 of ${ch.target}`);
    this.setUndoVisible(false);
    this.setNextVisible(false);
    this.setCelebrating(false);
  }

  setProgress(count: number): void {
    this.slots.forEach((slot, i) => {
      const filled = i < count;
      if (filled && !slot.classList.contains("filled")) replayClass(slot, "pop");
      slot.classList.toggle("filled", filled);
    });
    this.progress.setAttribute("aria-label", `${count} of ${this.slots.length}`);
  }

  pulseSlot(i: number): void {
    const slot = this.slots[i];
    if (slot) replayClass(slot, "pop");
  }

  pulseTarget(): void {
    replayClass(this.targetNum, "pulse");
  }

  setUndoVisible(visible: boolean): void {
    this.undo.hidden = !visible;
  }

  setNextVisible(visible: boolean): void {
    this.next.hidden = !visible;
  }

  setCelebrating(on: boolean): void {
    document.body.classList.toggle("celebrating", on);
  }

  /** Big numeral floating up from a tapped object (x, y in stage pixels). */
  popNumber(n: number, x: number, y: number): void {
    const el = document.createElement("div");
    el.className = "pop-num";
    el.textContent = String(n);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.pops.append(el);
    el.addEventListener("animationend", () => el.remove());
    window.setTimeout(() => el.remove(), 2000);
  }

  /** "3 = 🍌🍌🍌" card connecting the numeral with the quantity. */
  showNumberCard(n: number, item: CollectibleType): void {
    this.card.innerHTML = `<span class="card-num">${n}</span><span class="card-items">${ITEM_EMOJI[item].repeat(n)}</span>`;
    replayClass(this.card, "show");
  }

  hideNumberCard(): void {
    this.card.classList.remove("show");
  }

  clearPops(): void {
    this.pops.replaceChildren();
  }
}
