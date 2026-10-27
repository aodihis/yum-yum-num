import * as THREE from "three";
import { blobShadow, mat, part } from "./materials";

function skyTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#6ec6f5");
  g.addColorStop(0.6, "#bfe8ff");
  g.addColorStop(1, "#e9f8ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tree(x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(0.18, 0.26, 1.2, 7), mat(0x9b6a3c), [0, 0.6, 0]);
  const leaves = new THREE.IcosahedronGeometry(1, 0);
  part(g, leaves, mat(0x4fb35a), [0, 1.7, 0], [1, 0.95, 1]);
  part(g, leaves, mat(0x63c76a), [0.35, 2.25, 0.15], [0.62, 0.62, 0.62]);
  g.add(blobShadow(1.1));
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

function bush(x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.5, 0);
  part(g, geo, mat(0x58b860), [0, 0.35, 0]);
  part(g, geo, mat(0x6ccc6f), [0.45, 0.28, 0.1], [0.75, 0.75, 0.75]);
  part(g, geo, mat(0x4ea957), [-0.42, 0.25, 0.05], [0.7, 0.7, 0.7]);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

function flower(x: number, z: number, color: number): THREE.Group {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 4), mat(0x3f9a45), [0, 0.15, 0]);
  const petal = new THREE.SphereGeometry(0.07, 6, 4);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    part(g, petal, mat(color), [Math.cos(a) * 0.08, 0.32, Math.sin(a) * 0.08]);
  }
  part(g, petal, mat(0xffd84a), [0, 0.33, 0]);
  g.position.set(x, 0, z);
  return g;
}

function cloud(x: number, y: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const white = mat(0xffffff, { emissive: 0x666666 });
  part(g, geo, white, [0, 0, 0]);
  part(g, geo, white, [1.1, -0.2, 0], [0.75, 0.75, 0.75]);
  part(g, geo, white, [-1.1, -0.25, 0], [0.7, 0.7, 0.7]);
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  return g;
}

/** Static playground: sky, grass, trees, flowers, clouds. Returns a tick function for gentle motion. */
export function createEnvironment(scene: THREE.Scene): (time: number) => void {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xd8f1ff, 22, 48);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 40).rotateX(-Math.PI / 2), mat(0x8ed36b, { flat: false }));
  scene.add(ground);
  // A lighter "play mat" under the gameplay area helps objects stand out.
  const mat2 = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), mat(0xa7e07f, { flat: false }));
  mat2.scale.set(3.6, 1, 2.6);
  mat2.position.set(0, 0.005, 1.2);
  scene.add(mat2);

  for (const [x, z, s] of [
    [-4.2, -3.2, 1.2],
    [4.4, -2.8, 1.05],
    [-6.5, -6, 1.5],
    [6.8, -6.5, 1.6],
    [-2.6, -8.5, 1.3],
  ] as const)
    scene.add(tree(x, z, s));
  for (const [x, z, s] of [
    [-3.4, -1.2, 0.9],
    [3.5, -0.6, 0.8],
    [-2.2, -3.4, 0.8],
  ] as const)
    scene.add(bush(x, z, s));
  const colors = [0xff7aa8, 0xffffff, 0xb48cff, 0xff9d5c];
  [
    [-3.3, 1.2],
    [3.4, 1.9],
    [-3.0, 3.4],
    [3.1, 3.8],
    [-1.6, -2.6],
    [2.0, -2.4],
  ].forEach(([x, z], i) => scene.add(flower(x, z, colors[i % colors.length])));

  const clouds = [cloud(-5, 7.5, -12, 1.2), cloud(5.5, 9, -14, 1.4), cloud(0.5, 11, -16, 1.1)];
  clouds.forEach((c) => scene.add(c));

  const hemi = new THREE.HemisphereLight(0xffffff, 0x7fb069, 1.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
  sun.position.set(4, 10, 6);
  scene.add(sun);

  const baseX = clouds.map((c) => c.position.x);
  return (time) => {
    clouds.forEach((c, i) => (c.position.x = baseX[i] + Math.sin(time * 0.08 + i * 2) * 1.2));
  };
}
