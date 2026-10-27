import * as THREE from "three";

const cache = new Map<string, THREE.Material>();

/**
 * Shared low-poly materials, keyed by colour. Everything in the game reuses these,
 * so they live for the whole session and never need disposing.
 */
export function mat(color: number, opts: { flat?: boolean; emissive?: number } = {}): THREE.Material {
  const flat = opts.flat ?? true;
  const key = `${color}:${flat}:${opts.emissive ?? 0}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: flat,
      emissive: opts.emissive ?? 0x000000,
    });
    cache.set(key, m);
  }
  return m;
}

let shadowMat: THREE.MeshBasicMaterial | null = null;
const shadowGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);

/** Soft "blob" shadow: far cheaper on phones than real-time shadow maps. */
export function blobShadow(radius: number, opacity = 0.28): THREE.Mesh {
  if (!shadowMat) {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(30,60,20,1)");
    g.addColorStop(1, "rgba(30,60,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    shadowMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    });
  }
  const m = shadowMat.clone();
  m.opacity = opacity;
  const mesh = new THREE.Mesh(shadowGeo, m);
  mesh.scale.setScalar(radius);
  mesh.position.y = 0.01;
  mesh.renderOrder = -1;
  return mesh;
}

/** Add a mesh to `parent` at a position, with optional non-uniform scale. */
export function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  pos: [number, number, number],
  scale?: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(...pos);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}
