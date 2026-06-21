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

  private maxPixelRatio = 2;
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

  setMaxPixelRatio(maxPixelRatio: number): void {
    const next = Math.min(2, Math.max(0.75, maxPixelRatio));
    if (Math.abs(next - this.maxPixelRatio) < 0.001) {
      return;
    }

    this.maxPixelRatio = next;
    this.resize();
  }

  getPixelRatio(): number {
    return this.renderer.getPixelRatio();
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
    let shadowCastingObjectCount = 0;
    let stadiumDrawCallEstimate = 0;
    let stadiumMeshCount = 0;
    let visibleMeshCount = 0;

    this.scene.traverse((object) => {
      if (object.castShadow) {
        shadowCastingObjectCount += 1;
      }

      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      sceneMeshCount += 1;
      if (object.visible) {
        visibleMeshCount += 1;
      }
      const materials = getMaterials(object.material);
      for (const material of materials) {
        sceneMaterials.add(material.uuid);
      }
      if (isStadiumObject(object)) {
        stadiumMeshCount += 1;
        stadiumDrawCallEstimate += materials.length;
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
      shadowCastingObjectCount,
      stadiumDrawCallEstimate,
      stadiumMeshCount,
      textures: this.renderer.info.memory.textures,
      triangles: this.renderer.info.render.triangles,
      visibleMeshCount,
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

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
    this.renderer.setSize(width, height);
    for (const handler of this.resizeHandlers) {
      handler(width, height);
    }
  };
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function isStadiumObject(object: THREE.Object3D): boolean {
  return /stadium|stand|seating|crowd-seating-shell/i.test(object.name);
}
