import * as THREE from 'three';
import {
  applyHelmetUniformMaterials,
  cloneHelmetAsset,
  findHelmetPartMeshes,
  measureHelmetBounds,
  type HelmetPartMeshes,
} from '../presentation/helmet/HelmetAssetLibrary';
import type { UniformPalette } from '../teams/UniformPalette';

export interface HelmetPreviewFit {
  centerOffset: THREE.Vector3;
  scale: number;
}

interface HelmetPreviewEntry {
  camera: THREE.PerspectiveCamera;
  fallback: SVGSVGElement;
  helmet: THREE.Object3D | null;
  host: HTMLElement;
  id: string;
  loadState: 'fallback' | 'idle' | 'loaded' | 'loading';
  materialScope: string;
  normalizer: THREE.Group | null;
  parts: HelmetPartMeshes | null;
  scene: THREE.Scene;
  uniform: UniformPalette;
}

const HELMET_PREVIEW_CONFIG = {
  cameraFov: 28,
  cameraPosition: new THREE.Vector3(0.28, 0.08, 3.55),
  fitTargetHeight: 1.34,
  fitTargetWidth: 1.6,
  maximumPixelRatio: 1.5,
  previewRotationY: -0.18,
} as const;

export function resolveHelmetPreviewRotationY(id: string): number {
  if (id === 'user') {
    return -0.42;
  }

  if (id === 'opponent') {
    return 0.42;
  }

  return HELMET_PREVIEW_CONFIG.previewRotationY;
}

export function calculateHelmetPreviewFit(bounds: THREE.Box3): HelmetPreviewFit {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const widthScale = HELMET_PREVIEW_CONFIG.fitTargetWidth / Math.max(size.x, size.z, 0.001);
  const heightScale = HELMET_PREVIEW_CONFIG.fitTargetHeight / Math.max(size.y, 0.001);
  const scale = Math.min(widthScale, heightScale);

  return {
    centerOffset: center.multiplyScalar(-1),
    scale,
  };
}

export class MatchSetupHelmetPreviewRenderer {
  private readonly entries = new Map<string, HelmetPreviewEntry>();
  private readonly renderer: THREE.WebGLRenderer | null;
  private animationFrame = 0;
  private disposed = false;
  private visible = false;
  private warnedFailure = false;

  private readonly handleResize = (): void => {
    this.requestRender();
  };

  private readonly handleScroll = (): void => {
    this.requestRender();
  };

  private readonly handleVisibilityChange = (): void => {
    this.requestRender();
  };

  constructor(private readonly container: HTMLElement) {
    this.renderer = this.createRenderer();

    if (this.renderer) {
      container.append(this.renderer.domElement);
      window.addEventListener('resize', this.handleResize);
      container.addEventListener('scroll', this.handleScroll, true);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  registerPreview(id: string, host: HTMLElement, fallback: SVGSVGElement, uniform: UniformPalette): void {
    if (this.entries.has(id)) {
      this.syncPreview(id, uniform);
      return;
    }

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xf4fbff, 0x1a2428, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(2.2, 2.8, 3.8);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8fb6ff, 1.1);
    rimLight.position.set(-2.4, 1.6, -2.2);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(HELMET_PREVIEW_CONFIG.cameraFov, 1, 0.05, 20);
    camera.position.copy(HELMET_PREVIEW_CONFIG.cameraPosition);
    camera.lookAt(0, 0, 0);

    this.entries.set(id, {
      camera,
      fallback,
      helmet: null,
      host,
      id,
      loadState: 'idle',
      materialScope: createPreviewMaterialScope(id, uniform),
      normalizer: null,
      parts: null,
      scene,
      uniform,
    });

    if (this.visible) {
      this.loadPreview(id);
    }
  }

  syncPreview(id: string, uniform: UniformPalette): void {
    const entry = this.entries.get(id);

    if (!entry) {
      return;
    }

    entry.uniform = uniform;
    entry.materialScope = createPreviewMaterialScope(id, uniform);

    if (entry.parts) {
      applyHelmetUniformMaterials(entry.parts, uniform, entry.materialScope);
      entry.host.dataset.preview = 'glb';
    }

    if (this.visible) {
      this.loadPreview(id);
    }

    this.requestRender();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;

    if (this.renderer) {
      this.renderer.domElement.hidden = !visible;
    }

    if (visible) {
      for (const entry of this.entries.values()) {
        this.loadPreview(entry.id);
      }
    }

    this.requestRender();
  }

  dispose(): void {
    this.disposed = true;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }

    window.removeEventListener('resize', this.handleResize);
    this.container.removeEventListener('scroll', this.handleScroll, true);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    for (const entry of this.entries.values()) {
      entry.scene.clear();
      entry.host.dataset.preview = 'fallback';
      entry.fallback.removeAttribute('aria-hidden');
    }
    this.entries.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }

  private createRenderer(): THREE.WebGLRenderer | null {
    try {
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HELMET_PREVIEW_CONFIG.maximumPixelRatio));
      renderer.autoClear = false;
      renderer.domElement.className = 'match-helmet-preview-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.hidden = true;
      return renderer;
    } catch (error) {
      this.warnPreviewFailure(error);
      return null;
    }
  }

  private loadPreview(id: string): void {
    const entry = this.entries.get(id);

    if (!entry || !this.renderer || entry.loadState !== 'idle') {
      return;
    }

    entry.loadState = 'loading';
    void cloneHelmetAsset()
      .then((helmet) => {
        if (this.disposed) {
          return;
        }

        const parts = findHelmetPartMeshes(helmet);
        applyHelmetUniformMaterials(parts, entry.uniform, entry.materialScope);

        const fit = calculateHelmetPreviewFit(measureHelmetBounds(helmet));
        const normalizer = new THREE.Group();
        normalizer.name = `match-setup-helmet-preview-${entry.id}`;
        normalizer.scale.setScalar(fit.scale);
        normalizer.rotation.y = resolveHelmetPreviewRotationY(entry.id);
        helmet.position.copy(fit.centerOffset);
        normalizer.add(helmet);
        entry.scene.add(normalizer);

        entry.helmet = helmet;
        entry.normalizer = normalizer;
        entry.parts = parts;
        entry.loadState = 'loaded';
        entry.host.dataset.preview = 'glb';
        entry.fallback.setAttribute('aria-hidden', 'true');
        this.requestRender();
      })
      .catch((error: unknown) => {
        entry.loadState = 'fallback';
        entry.host.dataset.preview = 'fallback';
        entry.fallback.removeAttribute('aria-hidden');
        this.warnPreviewFailure(error);
      });
  }

  private requestRender(): void {
    if (this.disposed || !this.renderer || !this.visible || document.visibilityState === 'hidden') {
      return;
    }

    if (this.animationFrame) {
      return;
    }

    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = 0;
      this.render();
    });
  }

  private render(): void {
    if (this.disposed || !this.renderer || !this.visible || document.visibilityState === 'hidden') {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HELMET_PREVIEW_CONFIG.maximumPixelRatio));
    this.renderer.setSize(width, height, false);
    this.renderer.setScissorTest(false);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);

    for (const entry of this.entries.values()) {
      if (entry.loadState !== 'loaded' || !entry.normalizer || !entry.host.isConnected) {
        continue;
      }

      const rect = entry.host.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1 || rect.bottom < 0 || rect.top > height) {
        continue;
      }

      const x = Math.max(0, rect.left);
      const y = Math.max(0, height - rect.bottom);
      const scissorWidth = Math.min(rect.width, width - x);
      const scissorHeight = Math.min(rect.height, height - y);

      if (scissorWidth <= 1 || scissorHeight <= 1) {
        continue;
      }

      entry.camera.aspect = rect.width / Math.max(rect.height, 1);
      entry.camera.updateProjectionMatrix();
      this.renderer.setViewport(x, y, scissorWidth, scissorHeight);
      this.renderer.setScissor(x, y, scissorWidth, scissorHeight);
      this.renderer.render(entry.scene, entry.camera);
    }

    this.renderer.setScissorTest(false);
  }

  private warnPreviewFailure(error: unknown): void {
    if (this.warnedFailure || !import.meta.env.DEV) {
      return;
    }

    this.warnedFailure = true;
    console.warn(
      '[match-setup] Helmet GLB preview unavailable; using SVG fallback.',
      error instanceof Error ? error.message : error,
    );
  }
}

function createPreviewMaterialScope(id: string, uniform: UniformPalette): string {
  return `match-setup-preview:${id}:${uniform.helmetShell}:${uniform.faceguard}:${uniform.stripe}`;
}
