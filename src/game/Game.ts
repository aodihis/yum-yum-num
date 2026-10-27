import * as THREE from "three";
import { Animal } from "../scene/Animal";
import { Basket } from "../scene/Basket";
import { Collectible } from "../scene/Collectible";
import { createEnvironment } from "../scene/Environment";
import { Effects } from "../scene/Effects";
import { createScene, type SceneContext } from "../scene/createScene";
import type { HUD } from "../ui/HUD";
import type { AudioManager } from "./AudioManager";
import { ChallengeManager } from "./ChallengeManager";
import { GameState } from "./GameState";
import { InputManager } from "./InputManager";
import { ease, Tweens } from "./tween";
import { ANIMALS, type AnimalType, type ChallengeLayout, type Level } from "./types";

const ANIMAL_POS = new THREE.Vector3(0, 0, -1.8);
const BASKET_POS = new THREE.Vector3(0, 0, 3.5);
const ITEM_SCALE = 1.15;
const BASKET_ITEM_SCALE = 0.72;
/** Seconds without a tap before the game gently offers help. */
const IDLE_HELP_AFTER = 14;
const MAX_IDLE_HELPS = 2;

export interface GameOptions {
  seed: number;
  startLevel: Level;
}

/**
 * Connects the counting rules (GameState) to the 3D scene, HUD and audio.
 *
 * Every asynchronous sequence captures `runId` when it starts and stops as soon
 * as a newer challenge has begun, so an interrupted animation can never leave
 * the game stuck or apply to the wrong challenge.
 */
export class Game {
  readonly state = new GameState();
  readonly challenges: ChallengeManager;
  private readonly tweens = new Tweens();
  private readonly ctx: SceneContext;
  private readonly animals: Record<AnimalType, Animal>;
  private readonly animalHit: THREE.Mesh;
  private readonly basket = new Basket();
  private readonly effects: Effects;
  private readonly tickEnvironment: (time: number) => void;
  private animal: Animal | null = null;
  private items: Collectible[] = [];
  private pending: ChallengeLayout | null;
  private runId = 0;
  private helpId = 0;
  private idle = 0;
  private idleHelps = 0;
  private time = 0;
  private last = performance.now();
  private started = false;

  constructor(
    private readonly hud: HUD,
    private readonly audio: AudioManager,
    opts: GameOptions,
  ) {
    this.ctx = createScene(hud.canvas);
    const { scene, camera } = this.ctx;
    this.tickEnvironment = createEnvironment(scene);
    this.effects = new Effects(scene);

    this.animals = Object.fromEntries(
      ANIMALS.map((type) => {
        const a = new Animal(type);
        a.root.position.copy(ANIMAL_POS);
        a.root.visible = false;
        scene.add(a.root);
        return [type, a];
      }),
    ) as Record<AnimalType, Animal>;
    this.animalHit = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.8, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.animalHit.position.copy(ANIMAL_POS).setY(1.4);
    scene.add(this.animalHit);

    this.basket.root.position.copy(BASKET_POS);
    scene.add(this.basket.root);

    this.challenges = new ChallengeManager(opts.seed, opts.startLevel);
    this.pending = this.challenges.next();
    this.setAnimal(this.animals[this.pending.animal]);

    new InputManager(hud.canvas, camera, () => this.tapTargets(), (hits, ray) => this.onTap(hits, ray));

    const resize = () => this.ctx.resize(hud.stage.clientWidth, hud.stage.clientHeight);
    new ResizeObserver(resize).observe(hud.stage);
    window.addEventListener("orientationchange", resize);
    resize();

    this.ctx.renderer.setAnimationLoop(this.frame);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.nextChallenge();
  }

  replayInstruction(): void {
    const ch = this.state.challenge;
    if (!ch || (this.state.phase !== "COUNTING" && this.state.phase !== "INSTRUCTION")) return;
    this.idle = 0;
    this.audio.say(`ask_${ch.item}_${ch.target}`);
    this.animal?.trigger("talk");
    this.hud.pulseTarget();
  }

  undo(): void {
    const index = this.state.undo();
    if (index === null) return;
    this.idle = 0;
    this.helpId++;
    const item = this.items[index];
    item.collected = false;
    this.tweens.cancelGroup(`item${index}`);
    this.audio.sfx("boing");
    this.hud.setProgress(this.state.count);
    this.hud.setUndoVisible(this.state.count > 0);
    void this.fly(item, item.home, ITEM_SCALE, 0.9).then((done) => {
      if (done) item.shadow.visible = true;
    });
  }

  /** Skip the rest of the celebration (Next button). */
  skipCelebration(): void {
    if (this.state.phase === "CELEBRATING") void this.nextChallenge();
  }

  /** Screen positions of objects, for automated tests. */
  debugSnapshot() {
    const rect = this.hud.canvas.getBoundingClientRect();
    const toScreen = (v: THREE.Vector3) => {
      const p = this.toStage(v);
      return { x: rect.left + p.x, y: rect.top + p.y };
    };
    return {
      phase: this.state.phase,
      count: this.state.count,
      challenge: this.state.challenge,
      level: this.challenges.level,
      items: this.items.map((it) => ({
        index: it.index,
        collected: it.collected,
        ...toScreen(it.root.position.clone().setY(0.5)),
      })),
      basket: toScreen(BASKET_POS.clone().setY(0.4)),
      animal: toScreen(ANIMAL_POS.clone().setY(1.2)),
    };
  }

  // ---------------------------------------------------------------- flow

  private async nextChallenge(): Promise<void> {
    const run = ++this.runId;
    this.helpId++;
    this.tweens.cancelAll();
    this.state.reset();
    this.effects.clear();
    this.hud.setNextVisible(false);
    this.hud.setUndoVisible(false);
    this.hud.setCelebrating(false);
    this.hud.hideNumberCard();
    this.hud.clearPops();
    this.removeItems();

    const ch = this.pending ?? this.challenges.next();
    this.pending = null;
    await this.showAnimal(ch.animal);
    if (run !== this.runId) return;

    this.items = ch.positions.map((p, i) => {
      const item = new Collectible(ch.item, i, p.x, p.z);
      item.root.scale.setScalar(0);
      this.ctx.scene.add(item.root);
      void this.tweens.add({
        duration: 0.45,
        delay: i * 0.12,
        easing: ease.outBack,
        update: (k) => item.root.scale.setScalar(k * ITEM_SCALE),
      });
      return item;
    });
    this.state.begin(ch);
    this.hud.setChallenge(ch);

    await this.tweens.wait(0.3 + ch.available * 0.12);
    if (run !== this.runId) return;
    this.audio.say(`ask_${ch.item}_${ch.target}`);
    this.animal?.trigger("talk");

    await this.tweens.wait(0.5);
    if (run !== this.runId) return;
    this.state.startCounting();
    this.idle = 0;
    this.idleHelps = 0;
  }

  private collect(item: Collectible): void {
    const result = this.state.collect(item.index);
    if (result.kind === "already") {
      void this.help();
      return;
    }
    if (result.kind !== "counted") return;

    item.collected = true;
    item.shadow.visible = false;
    this.idle = 0;
    this.helpId++;
    this.audio.say(`count_${result.count as 1 | 2 | 3}`);
    this.audio.sfx("pop");
    this.hud.setProgress(result.count);
    this.hud.setUndoVisible(!result.completed);
    const top = item.root.position.clone().setY(0.9);
    const p = this.toStage(top);
    this.hud.popNumber(result.count, p.x, p.y);
    this.effects.sparkle(top);
    this.animal?.trigger("nod");

    const slot = this.basket.slotWorld(result.count - 1);
    void this.fly(item, slot, BASKET_ITEM_SCALE, 0.55).then((done) => {
      if (!done) return;
      this.basket.bump();
      this.audio.sfx("tap");
    });
    if (result.completed) void this.celebrate(this.runId);
  }

  private async celebrate(run: number): Promise<void> {
    const ch = this.state.challenge!;
    const independent = !this.state.neededSupport;
    this.hud.setUndoVisible(false);

    await this.tweens.wait(0.65);
    if (run !== this.runId) return;
    this.hud.setCelebrating(true);
    this.animal?.trigger("jump");
    this.effects.celebrate(this.animal!.headWorld());
    this.audio.sfx("cheer");
    if (ch.level === 3) this.hud.showNumberCard(ch.target, ch.item);

    await this.tweens.wait(0.6);
    if (run !== this.runId) return;
    this.audio.say("great_job");
    this.challenges.recordResult(independent);

    await this.tweens.wait(0.8);
    if (run !== this.runId) return;
    this.hud.setNextVisible(true);
    // The animal "eats" what was collected.
    const mouth = this.animal!.mouthWorld();
    this.state.collectedIndices.forEach((index, i) => {
      const item = this.items[index];
      void this.fly(item, mouth, 0, 0.5, i * 0.25, 0.6).then((done) => {
        if (done) {
          this.animal?.trigger("nod");
          this.audio.sfx("pop");
        }
      });
    });

    await this.tweens.wait(2.6);
    if (run !== this.runId) return;
    void this.nextChallenge();
  }

  /** "Let's count together!" then recount what is already in the basket and hint at the next object. */
  private async help(): Promise<void> {
    if (this.state.phase !== "COUNTING") return;
    const run = this.runId;
    const id = ++this.helpId;
    const alive = () => run === this.runId && id === this.helpId && this.state.phase === "COUNTING";
    this.state.neededSupport = true;
    this.idle = 0;
    this.audio.say("together");
    this.animal?.trigger("talk");

    await this.tweens.wait(1.6);
    const counted = [...this.state.collectedIndices];
    for (let i = 0; i < counted.length; i++) {
      if (!alive()) return;
      this.audio.say(`count_${(i + 1) as 1 | 2 | 3}`);
      this.hud.pulseSlot(i);
      this.items[counted[i]]?.hint();
      await this.tweens.wait(0.8);
    }
    if (!alive()) return;
    this.items.find((it) => !it.collected)?.hint();
    this.hud.pulseTarget();
  }

  // ---------------------------------------------------------------- scene helpers

  private tapTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = this.items.filter((it) => !it.collected).map((it) => it.hitArea);
    targets.push(this.basket.hitArea, this.animalHit);
    return targets;
  }

  private onTap(hits: THREE.Intersection[], ray: THREE.Ray): void {
    if (!this.started || this.state.phase !== "COUNTING") return;
    const candidates = hits
      .map((h) => h.object.userData.collectible as Collectible | undefined)
      .filter((c): c is Collectible => !!c && !c.collected);
    if (candidates.length > 0) {
      // Overlapping touch areas: choose the object whose centre is nearest the finger.
      const centre = new THREE.Vector3();
      const dist = (c: Collectible) => ray.distanceSqToPoint(centre.copy(c.root.position).setY(0.45));
      candidates.sort((a, b) => dist(a) - dist(b));
      this.collect(candidates[0]);
    } else if (hits.some((h) => h.object.userData.basket)) {
      void this.help();
    } else if (hits.some((h) => h.object === this.animalHit)) {
      this.replayInstruction();
    }
  }

  /** Arc an item to a point while scaling it. Resolves false if cancelled. */
  private fly(item: Collectible, to: THREE.Vector3, scale: number, duration: number, delay = 0, arc = 1.6): Promise<boolean> {
    const from = item.root.position.clone();
    const fromScale = item.root.scale.x;
    const target = to.clone();
    return this.tweens.add({
      duration,
      delay,
      group: `item${item.index}`,
      easing: ease.inOutSine,
      update: (k) => {
        item.root.position.lerpVectors(from, target, k);
        item.root.position.y += Math.sin(k * Math.PI) * arc;
        item.root.scale.setScalar(fromScale + (scale - fromScale) * k);
      },
    });
  }

  private removeItems(): void {
    for (const item of this.items) {
      const root = item.root;
      const s = root.scale.x;
      // Removed whether the tween finishes or is cancelled, so nothing is ever left behind.
      void this.tweens
        .add({ duration: 0.25, update: (k) => root.scale.setScalar(s * (1 - k)) })
        .then(() => this.ctx.scene.remove(root));
    }
    this.items = [];
  }

  private async showAnimal(type: AnimalType): Promise<void> {
    const next = this.animals[type];
    const prev = this.animal;
    if (prev === next) {
      next.trigger("hop");
      return;
    }
    this.audio.sfx("whoosh");
    if (prev) {
      await this.tweens.add({ duration: 0.3, easing: ease.inCubic, update: (k) => prev.root.scale.setScalar(1 - k) });
    }
    this.setAnimal(next);
    next.root.scale.setScalar(0);
    next.trigger("hop");
    await this.tweens.add({ duration: 0.45, easing: ease.outBack, update: (k) => next.root.scale.setScalar(k) });
  }

  private setAnimal(animal: Animal): void {
    for (const a of Object.values(this.animals)) {
      a.root.visible = a === animal;
      a.root.scale.setScalar(1);
    }
    this.animal = animal;
  }

  /** World point -> pixel position inside the stage element. */
  private toStage(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.ctx.camera);
    const el = this.hud.canvas;
    return { x: ((p.x + 1) / 2) * el.clientWidth, y: ((1 - p.y) / 2) * el.clientHeight };
  }

  private frame = () => {
    const now = performance.now();
    // Clamp so a backgrounded tab does not jump animations on return.
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;

    this.tweens.update(dt);
    this.animal?.update(this.time, dt);
    for (const item of this.items) item.update(this.time, dt);
    this.basket.update(dt);
    this.effects.update(dt);
    this.tickEnvironment(this.time);

    if (this.state.phase === "COUNTING" && !document.hidden) {
      this.idle += dt;
      if (this.idle > IDLE_HELP_AFTER && this.idleHelps < MAX_IDLE_HELPS) {
        this.idleHelps++;
        void this.help();
      }
    }
    this.ctx.renderer.render(this.ctx.scene, this.ctx.camera);
  };
}
