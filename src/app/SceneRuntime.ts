import * as THREE from 'three';
import {
  WORLD_SCALE,
  createFootballField,
  syncFootballFieldDriveLines,
  type FootballField,
} from '../field';
import type { RenderMetricsSnapshot } from '../debugOverlay';

export interface SceneRuntimeOptions {
  mount: HTMLElement;
  searchParams: URLSearchParams;
}

export class SceneRuntime {
  readonly field: FootballField;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();

  private readonly resizeHandlers = new Set<(width: number, height: number) => void>();

  constructor({ mount, searchParams }: SceneRuntimeOptions) {
    this.scene.background = new THREE.Color(0x101920);

    this.field = createFootballField({
      fieldAudit: searchParams.has('fieldAudit'),
    });
    this.scene.add(this.field.group);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: searchParams.has('readback'),
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.HemisphereLight(0xdde7ef, 0x344038, 2.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
    directionalLight.position.set(-20, 45, -25);
    this.scene.add(directionalLight);

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);

    console.info(
      `World scale: ${WORLD_SCALE.units}. Field ${WORLD_SCALE.fieldLength} x ${WORLD_SCALE.fieldWidth.toFixed(
        2,
      )} yards. ${WORLD_SCALE.axes}.`,
    );
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  onResize(handler: (width: number, height: number) => void): () => void {
    this.resizeHandlers.add(handler);
    handler(window.innerWidth, window.innerHeight);
    return () => {
      this.resizeHandlers.delete(handler);
    };
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  syncDriveLines(
    lineOfScrimmage: { z: number },
    firstDownMarker: { z: number },
  ): void {
    syncFootballFieldDriveLines(this.field, lineOfScrimmage, firstDownMarker);
  }

  createRenderMetricsSnapshot(
    deltaSeconds: number,
    playerVisuals: Iterable<THREE.Object3D>,
    playerCount: number,
  ): RenderMetricsSnapshot {
    const sceneMaterials = new Set<string>();
    let sceneMeshCount = 0;
    let playerBodyMeshCount = 0;

    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      sceneMeshCount += 1;
      for (const material of getMaterials(object.material)) {
        sceneMaterials.add(material.uuid);
      }
    });

    for (const playerVisual of playerVisuals) {
      playerVisual.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          playerBodyMeshCount += 1;
        }
      });
    }

    return {
      calls: this.renderer.info.render.calls,
      frameTimeMs: Math.max(0, deltaSeconds) * 1000,
      geometries: this.renderer.info.memory.geometries,
      playerBodyMeshCount,
      playerCount,
      sceneMaterialCount: sceneMaterials.size,
      sceneMeshCount,
      textures: this.renderer.info.memory.textures,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    this.resizeHandlers.clear();
    this.field.dispose();
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }

  private readonly resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    for (const handler of this.resizeHandlers) {
      handler(width, height);
    }
  };
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}
