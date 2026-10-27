import * as THREE from "three";

/**
 * Turns taps on the canvas into raycast hits. Uses pointerdown only (no click or
 * touchend), so one finger press produces exactly one selection attempt.
 */
export class InputManager {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly targets: () => THREE.Object3D[],
    private readonly onHit: (hits: THREE.Intersection[], ray: THREE.Ray) => void,
  ) {
    canvas.addEventListener("pointerdown", this.handle);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private handle = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Stops the compatibility mouse events / ghost clicks that follow a touch.
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.onHit(this.raycaster.intersectObjects(this.targets(), false), this.raycaster.ray);
  };
}
