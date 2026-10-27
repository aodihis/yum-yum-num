import * as THREE from "three";
import type { AnimalType } from "../game/types";
import { blobShadow, mat, part } from "./materials";

type Action = "jump" | "nod" | "talk" | "hop";

const ACTION_DURATION: Record<Action, number> = { jump: 1.3, nod: 0.45, talk: 1.4, hop: 0.5 };

interface Rig {
  head: THREE.Group;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  earL?: THREE.Object3D;
  earR?: THREE.Object3D;
  tail?: THREE.Object3D;
  /** World-ish height of the mouth, used as the target when feeding. */
  mouthY: number;
  mouthZ: number;
}

const sphere = new THREE.SphereGeometry(1, 14, 10);
const smoothSphere = new THREE.SphereGeometry(1, 16, 12);

function eyes(head: THREE.Object3D, y: number, z: number, spread: number, size = 0.1) {
  for (const s of [-1, 1]) {
    part(head, smoothSphere, mat(0x2b2118, { flat: false }), [s * spread, y, z], [size, size * 1.15, size * 0.7]);
    part(head, smoothSphere, mat(0xffffff, { flat: false, emissive: 0x888888 }), [s * spread + size * 0.35, y + size * 0.4, z + size * 0.55], [size * 0.32, size * 0.32, size * 0.32]);
  }
}

function cheeks(head: THREE.Object3D, y: number, z: number, spread: number) {
  for (const s of [-1, 1]) part(head, smoothSphere, mat(0xff9fb3, { flat: false }), [s * spread, y, z], [0.1, 0.07, 0.04]);
}

function smile(head: THREE.Object3D, y: number, z: number, r = 0.11) {
  const m = part(head, new THREE.TorusGeometry(r, 0.025, 6, 12, Math.PI), mat(0x3b2416), [0, y, z]);
  m.rotation.z = Math.PI;
}

function limb(parent: THREE.Object3D, color: number, pos: [number, number, number], len: number, radius: number) {
  // Pivot at the shoulder so rotating the group swings the limb.
  const pivot = new THREE.Group();
  pivot.position.set(...pos);
  part(pivot, new THREE.CapsuleGeometry(radius, len, 4, 8), mat(color), [0, -len / 2, 0]);
  parent.add(pivot);
  return pivot;
}

function buildMonkey(body: THREE.Group): Rig {
  const brown = 0x9a6234;
  const tan = 0xf3d2a2;
  part(body, sphere, mat(brown), [0, 0.85, 0], [0.72, 0.8, 0.66]);
  part(body, sphere, mat(tan), [0, 0.8, 0.4], [0.46, 0.55, 0.3]);
  const armL = limb(body, brown, [-0.62, 1.2, 0.1], 0.55, 0.14);
  const armR = limb(body, brown, [0.62, 1.2, 0.1], 0.55, 0.14);
  armL.rotation.z = -0.5;
  armR.rotation.z = 0.5;
  for (const s of [-1, 1]) part(body, sphere, mat(brown), [s * 0.35, 0.18, 0.35], [0.22, 0.16, 0.3]);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, -0.55),
    new THREE.Vector3(0.5, 0.4, -0.9),
    new THREE.Vector3(0.9, 1.0, -0.8),
    new THREE.Vector3(0.65, 1.35, -0.6),
  ]);
  const tail = part(body, new THREE.TubeGeometry(tailCurve, 16, 0.07, 6), mat(brown), [0, 0, 0]);

  const head = new THREE.Group();
  head.position.set(0, 1.85, 0.05);
  body.add(head);
  part(head, sphere, mat(brown), [0, 0, 0], [0.62, 0.58, 0.58]);
  part(head, smoothSphere, mat(tan, { flat: false }), [0, -0.07, 0.3], [0.48, 0.4, 0.34]);
  part(head, smoothSphere, mat(tan, { flat: false }), [-0.17, 0.12, 0.38], [0.2, 0.2, 0.2]);
  part(head, smoothSphere, mat(tan, { flat: false }), [0.17, 0.12, 0.38], [0.2, 0.2, 0.2]);
  for (const s of [-1, 1]) {
    part(head, sphere, mat(brown), [s * 0.62, 0.05, 0], [0.22, 0.24, 0.12]);
    part(head, sphere, mat(tan), [s * 0.64, 0.05, 0.06], [0.13, 0.15, 0.08]);
  }
  eyes(head, 0.14, 0.52, 0.17, 0.085);
  for (const s of [-1, 1]) part(head, smoothSphere, mat(0x5a3a22, { flat: false }), [s * 0.06, -0.06, 0.62], [0.03, 0.025, 0.02]);
  smile(head, -0.15, 0.6, 0.12);
  cheeks(head, -0.08, 0.55, 0.3);
  return { head, armL, armR, tail, mouthY: 1.7, mouthZ: 0.7 };
}

function buildRabbit(body: THREE.Group): Rig {
  const fur = 0xf7f2ec;
  const pink = 0xffb6c8;
  part(body, sphere, mat(fur), [0, 0.75, 0], [0.68, 0.72, 0.62]);
  part(body, sphere, mat(0xffffff), [0, 0.7, 0.38], [0.42, 0.48, 0.28]);
  for (const s of [-1, 1]) part(body, sphere, mat(fur), [s * 0.35, 0.12, 0.38], [0.22, 0.13, 0.36]);
  const armL = limb(body, fur, [-0.45, 1.05, 0.35], 0.3, 0.12);
  const armR = limb(body, fur, [0.45, 1.05, 0.35], 0.3, 0.12);
  armL.rotation.set(-0.5, 0, -0.2);
  armR.rotation.set(-0.5, 0, 0.2);
  const tail = part(body, smoothSphere, mat(0xffffff, { flat: false }), [0, 0.45, -0.62], [0.2, 0.2, 0.2]);

  const head = new THREE.Group();
  head.position.set(0, 1.62, 0.08);
  body.add(head);
  part(head, sphere, mat(fur), [0, 0, 0], [0.56, 0.5, 0.52]);
  const ear = (s: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.22, 0.38, -0.05);
    part(pivot, new THREE.CapsuleGeometry(0.13, 0.75, 4, 8), mat(fur), [0, 0.45, 0]);
    part(pivot, new THREE.CapsuleGeometry(0.07, 0.6, 4, 8), mat(pink), [0, 0.45, 0.08]);
    pivot.rotation.z = -s * 0.18;
    head.add(pivot);
    return pivot;
  };
  const earL = ear(-1);
  const earR = ear(1);
  eyes(head, 0.08, 0.45, 0.2, 0.09);
  part(head, smoothSphere, mat(pink, { flat: false }), [0, -0.06, 0.52], [0.07, 0.05, 0.05]);
  for (const s of [-1, 1]) part(head, smoothSphere, mat(0xffffff, { flat: false }), [s * 0.09, -0.15, 0.47], [0.11, 0.08, 0.08]);
  part(head, new THREE.BoxGeometry(0.1, 0.09, 0.03), mat(0xffffff), [0, -0.26, 0.48]);
  cheeks(head, -0.1, 0.42, 0.3);
  return { head, armL, armR, earL, earR, tail, mouthY: 1.45, mouthZ: 0.75 };
}

function buildElephant(body: THREE.Group): Rig {
  const grey = 0xa3b1c2;
  const pinkEar = 0xf6b9c6;
  part(body, sphere, mat(grey), [0, 1.0, -0.1], [0.95, 0.82, 0.85]);
  for (const [x, z] of [
    [-0.5, 0.35],
    [0.5, 0.35],
    [-0.5, -0.5],
    [0.5, -0.5],
  ])
    part(body, new THREE.CylinderGeometry(0.24, 0.27, 0.6, 8), mat(grey), [x, 0.3, z]);
  for (const s of [-1, 1]) part(body, smoothSphere, mat(0xeeeeee, { flat: false }), [s * 0.5, 0.02, 0.45], [0.2, 0.06, 0.14]);
  const tail = part(body, new THREE.CapsuleGeometry(0.05, 0.4, 3, 6), mat(grey), [0, 0.85, -0.98]);
  tail.rotation.x = -0.6;

  const head = new THREE.Group();
  head.position.set(0, 1.75, 0.45);
  body.add(head);
  part(head, sphere, mat(grey), [0, 0, 0], [0.62, 0.58, 0.55]);
  const ear = (s: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.5, 0.05, -0.05);
    part(pivot, sphere, mat(grey), [s * 0.42, 0, 0], [0.52, 0.58, 0.1]);
    part(pivot, sphere, mat(pinkEar), [s * 0.42, 0, 0.05], [0.38, 0.44, 0.07]);
    pivot.rotation.y = s * -0.35;
    head.add(pivot);
    return pivot;
  };
  const earL = ear(-1);
  const earR = ear(1);
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.05, 0.45),
    new THREE.Vector3(0, -0.4, 0.68),
    new THREE.Vector3(0, -0.75, 0.72),
    new THREE.Vector3(0, -0.9, 0.9),
    new THREE.Vector3(0, -0.8, 1.05),
  ]);
  const trunk = new THREE.Group();
  part(trunk, new THREE.TubeGeometry(trunkCurve, 20, 0.15, 8), mat(grey), [0, 0, 0]);
  head.add(trunk);
  for (const s of [-1, 1]) {
    const tusk = part(head, new THREE.ConeGeometry(0.06, 0.28, 6), mat(0xfffbef), [s * 0.22, -0.35, 0.45]);
    tusk.rotation.set(1.9, 0, -s * 0.3);
  }
  eyes(head, 0.15, 0.47, 0.25, 0.085);
  cheeks(head, -0.05, 0.47, 0.38);
  return { head, earL, earR, tail, mouthY: 1.5, mouthZ: 1.0 };
}

const BUILDERS: Record<AnimalType, (body: THREE.Group) => Rig> = {
  monkey: buildMonkey,
  rabbit: buildRabbit,
  elephant: buildElephant,
};

/** A procedural animal with simple idle, talk, nod, hop and celebration animations. */
export class Animal {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly rig: Rig;
  private readonly base: { armL: number; armR: number; earL: THREE.Euler | null; earR: THREE.Euler | null };
  private actions: { kind: Action; t: number }[] = [];

  constructor(readonly type: AnimalType) {
    this.root.add(this.body);
    this.root.add(blobShadow(1.0, 0.32));
    this.rig = BUILDERS[type](this.body);
    this.base = {
      armL: this.rig.armL?.rotation.z ?? 0,
      armR: this.rig.armR?.rotation.z ?? 0,
      earL: this.rig.earL?.rotation.clone() ?? null,
      earR: this.rig.earR?.rotation.clone() ?? null,
    };
  }

  /** Point in front of the mouth, in world space. */
  mouthWorld(target = new THREE.Vector3()): THREE.Vector3 {
    return this.root.localToWorld(target.set(0, this.rig.mouthY, this.rig.mouthZ));
  }

  headWorld(target = new THREE.Vector3()): THREE.Vector3 {
    return this.rig.head.getWorldPosition(target);
  }

  trigger(kind: Action): void {
    this.actions = this.actions.filter((a) => a.kind !== kind);
    this.actions.push({ kind, t: 0 });
  }

  update(time: number, dt: number): void {
    const { body, rig, base } = this;
    // Idle: breathing and a slow sway.
    let y = 0;
    let spin = 0;
    let sx = 1 + Math.sin(time * 2.2) * 0.015;
    let sy = 1 - Math.sin(time * 2.2) * 0.015;
    let headTilt = Math.sin(time * 0.9) * 0.06;
    let headNod = 0;
    let arms = 0;
    let ears = Math.sin(time * 3.1) * 0.05;

    for (const a of this.actions) {
      a.t += dt;
      const p = Math.min(a.t / ACTION_DURATION[a.kind], 1);
      switch (a.kind) {
        case "jump": {
          const hops = 2;
          const h = Math.abs(Math.sin(p * Math.PI * hops));
          y += h * 0.7;
          spin += p < 0.5 ? 0 : (p - 0.5) * 2 * Math.PI * 2;
          sy *= 1 + h * 0.08;
          sx *= 1 - h * 0.05;
          arms += Math.sin(p * Math.PI) * 1.8;
          ears += Math.sin(p * Math.PI * 6) * 0.25;
          break;
        }
        case "hop":
          y += Math.sin(p * Math.PI) * 0.35;
          break;
        case "nod":
          headNod += Math.sin(p * Math.PI) * 0.28;
          arms += Math.sin(p * Math.PI) * 0.5;
          break;
        case "talk":
          headNod += Math.sin(p * Math.PI * 6) * 0.07 * (1 - p);
          headTilt += Math.sin(p * Math.PI) * 0.15;
          ears += Math.sin(p * Math.PI * 4) * 0.12;
          break;
      }
    }
    this.actions = this.actions.filter((a) => a.t < ACTION_DURATION[a.kind]);

    body.position.y = y;
    body.rotation.y = spin;
    body.scale.set(sx, sy, sx);
    rig.head.rotation.set(headNod, 0, headTilt);
    if (rig.armL) rig.armL.rotation.z = base.armL - arms;
    if (rig.armR) rig.armR.rotation.z = base.armR + arms;
    if (rig.earL && base.earL) rig.earL.rotation.set(base.earL.x + ears, base.earL.y, base.earL.z - ears * 0.5);
    if (rig.earR && base.earR) rig.earR.rotation.set(base.earR.x - ears, base.earR.y, base.earR.z + ears * 0.5);
    if (rig.tail) rig.tail.rotation.y = Math.sin(time * 2.5) * 0.25;
  }
}
