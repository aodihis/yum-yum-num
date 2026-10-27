import * as THREE from "three";
import { blobShadow, mat, part } from "./materials";

const SLOT_X = [-0.5, 0, 0.5];

/** The collection basket in front of the animal. Items sit in fixed slots, one per count. */
export class Basket {
  readonly root = new THREE.Group();
  readonly hitArea: THREE.Mesh;
  private bumpT = -1;

  constructor() {
    const wicker = 0xc98a45;
    const dark = 0xa86c30;
    const shell = part(
      this.root,
      new THREE.CylinderGeometry(1.0, 0.78, 0.55, 14, 1, true),
      new THREE.MeshLambertMaterial({ color: wicker, side: THREE.DoubleSide, flatShading: true }),
      [0, 0.28, 0],
    );
    shell.scale.z = 0.62;
    part(this.root, new THREE.CylinderGeometry(0.78, 0.78, 0.04, 14), mat(dark), [0, 0.03, 0], [1, 1, 0.62]);
    const ring = new THREE.TorusGeometry(1, 0.07, 5, 18).rotateX(Math.PI / 2);
    part(this.root, ring, mat(dark), [0, 0.55, 0], [1.0, 1, 0.62]);
    part(this.root, new THREE.TorusGeometry(1, 0.035, 4, 18).rotateX(Math.PI / 2), mat(dark), [0, 0.3, 0], [0.9, 1, 0.56]);
    const handle = part(this.root, new THREE.TorusGeometry(0.85, 0.06, 5, 16, Math.PI), mat(dark), [0, 0.55, -0.05]);
    handle.scale.y = 0.75;
    this.root.add(blobShadow(1.1, 0.3));

    this.hitArea = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.05, 1.2, 10),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitArea.position.y = 0.5;
    this.hitArea.scale.z = 0.7;
    this.hitArea.userData.basket = true;
    this.root.add(this.hitArea);
  }

  /** World position for the n-th collected item (0-based). */
  slotWorld(n: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.root.localToWorld(target.set(SLOT_X[n] ?? 0, 0.32, 0));
  }

  bump(): void {
    this.bumpT = 0;
  }

  update(dt: number): void {
    if (this.bumpT < 0) return;
    this.bumpT += dt;
    const p = this.bumpT / 0.35;
    if (p >= 1) {
      this.bumpT = -1;
      this.root.scale.set(1, 1, 1);
      return;
    }
    const s = Math.sin(p * Math.PI) * 0.1;
    this.root.scale.set(1 + s, 1 - s, 1 + s);
  }
}
