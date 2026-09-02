import type * as THREE from 'three';

/**
 * RTS camera controller — pure math, headless-testable.
 * Holds a view center (x, y in map tiles) and a zoom; applies itself to an
 * orthographic top-down camera each frame.
 */
export interface CameraInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  edgeLeft: boolean;
  edgeRight: boolean;
  edgeTop: boolean;
  edgeBottom: boolean;
  wheel: number; // cumulative wheel delta this frame
}

export const DEFAULT_PAN_SPEED = 45; // world tiles/second
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 3.0;

export class RTSController {
  x: number;
  y: number;
  zoom = 0.7;
  /** world units per screen pixel at zoom=1 (ortho frustum = viewport * zoom) */
  pixelScale = 0.1;
  private bounds: number;

  constructor(bounds: number, startX = 0, startY = 0) {
    this.bounds = bounds;
    this.x = startX;
    this.y = startY;
  }

  /** Pan + zoom from input; clamps to map bounds. Pure: no camera side effects. */
  update(dt: number, input: CameraInput): void {
    let dx = 0;
    let dy = 0;
    if (input.up || input.edgeTop) dy -= 1;
    if (input.down || input.edgeBottom) dy += 1;
    if (input.left || input.edgeLeft) dx -= 1;
    if (input.right || input.edgeRight) dx += 1;

    const speed = DEFAULT_PAN_SPEED * dt;
    // normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }
    this.x += dx * speed;
    this.y += dy * speed;

    if (input.wheel !== 0) {
      this.zoom *= Math.pow(1.12, input.wheel);
    }
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom));
    this.clamp();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.clamp();
  }

  private clamp(): void {
    this.x = Math.min(this.bounds, Math.max(0, this.x));
    this.y = Math.min(this.bounds, Math.max(0, this.y));
  }

  /** Apply controller state to an orthographic top-down camera. */
  apply(camera: THREE.OrthographicCamera, viewW: number, viewH: number): void {
    const s = this.pixelScale / this.zoom;
    camera.left = (-viewW / 2) * s;
    camera.right = (viewW / 2) * s;
    camera.top = (viewH / 2) * s;
    camera.bottom = (-viewH / 2) * s;
    camera.position.set(this.x, 80, this.y);
    camera.lookAt(this.x, 0, this.y);
    camera.updateProjectionMatrix();
  }
}
