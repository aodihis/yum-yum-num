import * as THREE from "three";
import type { CollectibleType } from "../game/types";
import { blobShadow, mat, part } from "./materials";

const hitGeo = new THREE.SphereGeometry(0.72, 10, 8);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

function banana(g: THREE.Group) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.48, 0.42, 0),
    new THREE.Vector3(-0.3, 0.16, 0),
    new THREE.Vector3(0, 0.12, 0),
    new THREE.Vector3(0.3, 0.16, 0),
    new THREE.Vector3(0.48, 0.42, 0),
  ]);
  part(g, new THREE.TubeGeometry(curve, 20, 0.14, 8), mat(0xffd93b), [0, 0, 0]);
  const tip = new THREE.SphereGeometry(0.075, 8, 6);
  part(g, tip, mat(0x6b4a26), [-0.48, 0.42, 0]);
  const stem = part(g, new THREE.CylinderGeometry(0.05, 0.07, 0.16, 6), mat(0x8a6a2a), [0.52, 0.5, 0]);
  stem.rotation.z = -0.6;
  g.rotation.y = 0.25;
}

function carrot(g: THREE.Group) {
  const body = part(g, new THREE.ConeGeometry(0.25, 0.9, 9), mat(0xff8a1f), [0, 0.47, 0]);
  body.rotation.x = Math.PI;
  const ring = new THREE.TorusGeometry(1, 0.06, 4, 10).rotateX(Math.PI / 2);
  part(g, ring, mat(0xe8720f), [0, 0.6, 0], [0.18, 0.4, 0.18]);
  part(g, ring, mat(0xe8720f), [0, 0.35, 0], [0.12, 0.4, 0.12]);
  const leaf = new THREE.ConeGeometry(0.09, 0.42, 5);
  for (const [x, rz] of [
    [-0.08, 0.35],
    [0, 0],
    [0.08, -0.35],
  ]) {
    const l = part(g, leaf, mat(0x47b54e), [x, 1.05, 0]);
    l.rotation.z = rz;
  }
}

function apple(g: THREE.Group) {
  part(g, new THREE.SphereGeometry(1, 12, 9), mat(0xf0433a), [0, 0.37, 0], [0.4, 0.36, 0.4]);
  part(g, new THREE.SphereGeometry(1, 8, 6), mat(0xffffff, { flat: false, emissive: 0xaaaaaa }), [-0.15, 0.5, 0.26], [0.07, 0.05, 0.04]);
  part(g, new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5), mat(0x6b4a26), [0, 0.78, 0]);
  const leaf = part(g, new THREE.SphereGeometry(1, 6, 4), mat(0x4fb84f), [0.12, 0.8, 0], [0.13, 0.04, 0.07]);
  leaf.rotation.z = 0.4;
}

const BUILDERS: Record<CollectibleType, (g: THREE.Group) => void> = { banana, carrot, apple };

/** One tappable object. `root` is moved by tweens; `model` carries the idle wiggle. */
export class Collectible {
  readonly root = new THREE.Group();
  readonly model = new THREE.Group();
  readonly hitArea: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly home: THREE.Vector3;
  /** True while the object is in (or flying to) the basket. */
  collected = false;
  private hintT = -1;
  private readonly phase = Math.random() * Math.PI * 2;

  constructor(readonly type: CollectibleType, readonly index: number, x: number, z: number) {
    BUILDERS[type](this.model);
    this.root.add(this.model);
    this.hitArea = new THREE.Mesh(hitGeo, hitMat);
    this.hitArea.position.y = 0.45;
    this.hitArea.userData.collectible = this;
    this.root.add(this.hitArea);
    this.shadow = blobShadow(0.5);
    this.root.add(this.shadow);
    this.home = new THREE.Vector3(x, 0, z);
    this.root.position.copy(this.home);
    this.root.scale.setScalar(1.15);
  }

  /** A short "pick me" wiggle used for hints. */
  hint(): void {
    this.hintT = 0;
  }

  update(time: number, dt: number): void {
    let wobble = 0;
    let lift = 0;
    if (!this.collected) {
      wobble = Math.sin(time * 1.8 + this.phase) * 0.06;
      lift = (Math.sin(time * 1.8 + this.phase) + 1) * 0.02;
    }
    if (this.hintT >= 0) {
      this.hintT += dt;
      const p = this.hintT / 0.9;
      if (p >= 1) this.hintT = -1;
      else {
        wobble += Math.sin(p * Math.PI * 6) * 0.3 * (1 - p);
        lift += Math.sin(p * Math.PI) * 0.35;
      }
    }
    this.model.rotation.z = wobble;
    this.model.position.y = lift;
  }
}
