import * as THREE from "three";

/** Points that must always be on screen: animal, play area corners and basket. */
const FRAME_POINTS = [
  [0, 2.9, -1.8],
  [-1.2, 0, -1.9],
  [1.2, 0, -1.9],
  [-2.9, 0, -0.6],
  [2.9, 0, -0.6],
  [-2.9, 0.3, 2.9],
  [2.9, 0.3, 2.9],
  [-1.15, 0.9, 3.5],
  [1.15, 0.9, 3.5],
  [0, 0, 4.2],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

const LOOK_AT = new THREE.Vector3(0, 0.6, 1.0);

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize: (width: number, height: number) => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  const resize = (width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fitCamera(camera, width, height);
  };
  return { renderer, scene, camera, resize };
}

/**
 * Fixed camera: pick the closest distance at which every frame point fits, then
 * shift the lens so the content is centred. Tall portrait screens look down more
 * steeply, which spreads the objects apart vertically and uses the extra height.
 */
function fitCamera(camera: THREE.PerspectiveCamera, width: number, height: number): void {
  const margin = 0.9;
  const elevation = camera.aspect < 0.8 ? 0.88 : 0.7;
  const dir = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation));
  const v = new THREE.Vector3();
  const box = new THREE.Box2();
  camera.clearViewOffset();
  const measure = (d: number) => {
    camera.position.copy(LOOK_AT).addScaledVector(dir, d);
    camera.lookAt(LOOK_AT);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    box.makeEmpty();
    for (const p of FRAME_POINTS) {
      v.copy(p).project(camera);
      box.expandByPoint(new THREE.Vector2(v.x, v.y));
    }
    return box;
  };
  let lo = 4;
  let hi = 60;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const b = measure(mid);
    if (b.max.x - b.min.x <= 2 * margin && b.max.y - b.min.y <= 2 * margin) hi = mid;
    else lo = mid;
  }
  const b = measure(hi);
  const cx = (b.min.x + b.max.x) / 2;
  const cy = (b.min.y + b.max.y) / 2;
  camera.setViewOffset(width, height, (cx * width) / 2, (-cy * height) / 2, width, height);
}
