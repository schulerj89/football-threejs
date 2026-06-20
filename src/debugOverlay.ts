import * as THREE from 'three';
import type { PlayerModel } from './playerModel';

interface DebugOverlayOptions {
  renderer: THREE.WebGLRenderer;
  player: PlayerModel;
}

export class DebugOverlay {
  private readonly element: HTMLDivElement;
  private frameCount = 0;
  private elapsed = 0;
  private fps = 0;

  constructor({ renderer, player }: DebugOverlayOptions) {
    this.element = document.createElement('div');
    this.element.className = 'debug-overlay';
    this.element.hidden = !new URLSearchParams(window.location.search).has('debug');
    document.body.appendChild(this.element);

    this.update(0, renderer, player);
  }

  update(deltaSeconds: number, renderer: THREE.WebGLRenderer, player: PlayerModel): void {
    this.frameCount += 1;
    this.elapsed += deltaSeconds;

    if (this.elapsed >= 0.25) {
      this.fps = this.frameCount / this.elapsed;
      this.frameCount = 0;
      this.elapsed = 0;
    }

    const { x, z } = player.position;
    this.element.textContent = [
      `FPS ${this.fps.toFixed(0)}`,
      `POS ${x.toFixed(1)}, ${z.toFixed(1)}`,
      `CALLS ${renderer.info.render.calls}`,
      `TRIS ${renderer.info.render.triangles}`,
    ].join('\n');
  }
}
