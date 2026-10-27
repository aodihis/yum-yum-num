import * as THREE from "three";

function starGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false }).center();
}

interface Particle {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  spin: number;
  life: number;
  maxLife: number;
  size: number;
}

const CONFETTI_COLORS = [0xff6b8b, 0xffd23f, 0x4dd0e1, 0x8bd450, 0xb388ff];
const CONFETTI_COUNT = 40;

/** Pooled star bursts and confetti. A fixed number of objects, so nothing is allocated per celebration. */
export class Effects {
  private stars: Particle[] = [];
  private confetti: THREE.InstancedMesh;
  private confettiState: Particle[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = starGeometry();
    const starMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x8a6200 });
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(geo, starMat);
      mesh.visible = false;
      scene.add(mesh);
      this.stars.push({ obj: mesh, vel: new THREE.Vector3(), spin: 0, life: 0, maxLife: 0, size: 0 });
    }

    this.confetti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.24),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      CONFETTI_COUNT,
    );
    const color = new THREE.Color();
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      this.confetti.setColorAt(i, color.setHex(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
      this.confettiState.push({ obj: new THREE.Object3D(), vel: new THREE.Vector3(), spin: 0, life: 0, maxLife: 0, size: 1 });
    }
    this.confetti.count = 0;
    this.confetti.frustumCulled = false;
    scene.add(this.confetti);
  }

  /** Small sparkle where an object was tapped. */
  sparkle(at: THREE.Vector3): void {
    this.emitStars(at, 4, 2.2, 0.13);
  }

  celebrate(at: THREE.Vector3): void {
    this.emitStars(at, 10, 4.5, 0.26);
    for (const p of this.confettiState) {
      p.obj.position.set(at.x + (Math.random() - 0.5) * 1.5, at.y + 0.5, at.z + (Math.random() - 0.5));
      p.vel.set((Math.random() - 0.5) * 5, 4 + Math.random() * 3, (Math.random() - 0.2) * 3);
      p.obj.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      p.spin = 4 + Math.random() * 6;
      p.maxLife = 2.2 + Math.random() * 0.8;
      p.life = p.maxLife;
    }
    this.confetti.count = CONFETTI_COUNT;
  }

  clear(): void {
    for (const s of this.stars) {
      s.life = 0;
      s.obj.visible = false;
    }
    for (const p of this.confettiState) p.life = 0;
    this.confetti.count = 0;
  }

  update(dt: number): void {
    for (const s of this.stars) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.obj.visible = false;
        continue;
      }
      s.vel.y -= 6 * dt;
      s.obj.position.addScaledVector(s.vel, dt);
      s.obj.rotation.z += s.spin * dt;
      const k = s.life / s.maxLife;
      s.obj.scale.setScalar(s.size * Math.min(1, k * 2.5) * (k > 0.85 ? (1 - k) / 0.15 : 1));
    }

    if (this.confetti.count === 0) return;
    let alive = 0;
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const p = this.confettiState[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vel.y = Math.max(p.vel.y - 7 * dt, -1.4);
        p.vel.x *= 1 - dt * 1.5;
        p.obj.position.addScaledVector(p.vel, dt);
        p.obj.rotation.x += p.spin * dt;
        p.obj.rotation.y += p.spin * 0.7 * dt;
        alive++;
      }
      this.dummy.position.copy(p.obj.position);
      this.dummy.rotation.copy(p.obj.rotation);
      this.dummy.scale.setScalar(p.life > 0 ? Math.min(1, p.life * 2) : 0);
      this.dummy.updateMatrix();
      this.confetti.setMatrixAt(i, this.dummy.matrix);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
    if (alive === 0) this.confetti.count = 0;
  }

  private emitStars(at: THREE.Vector3, count: number, speed: number, size: number): void {
    let emitted = 0;
    for (const s of this.stars) {
      if (emitted >= count) break;
      if (s.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      s.vel.set(Math.cos(a) * speed * 0.6, speed * (0.7 + Math.random() * 0.5), Math.sin(a) * speed * 0.3 + 0.5);
      s.obj.position.copy(at);
      s.spin = (Math.random() - 0.5) * 8;
      s.maxLife = s.life = 1.1 + Math.random() * 0.4;
      s.size = size;
      s.obj.visible = true;
      emitted++;
    }
  }
}
