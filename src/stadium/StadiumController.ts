import * as THREE from 'three';
import { DEFAULT_STADIUM_SPEC } from './StadiumSpec';
import {
  buildStadiumGeometry,
} from './StadiumGeometryBuilder';
import {
  createStadiumMaterialLibrary,
  getStadiumTextureCacheSnapshot,
  type StadiumMaterialLibrary,
} from './StadiumMaterialLibrary';
import { createSeatLayout } from './SeatLayout';
import type {
  StadiumControllerSnapshot,
  StadiumGeometryMetrics,
  StadiumSpec,
} from './StadiumTypes';

export type { StadiumControllerSnapshot } from './StadiumTypes';

export interface StadiumControllerOptions {
  enabled: boolean;
  imageMaterialsEnabled: boolean;
  renderer: THREE.WebGLRenderer;
  spec?: StadiumSpec;
  upperTierEnabled: boolean;
}

export class StadiumController {
  readonly group = new THREE.Group();

  private build: ReturnType<typeof buildStadiumGeometry> | null = null;
  private enabled: boolean;
  private imageMaterialsEnabled: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly spec: StadiumSpec;
  private materialLibrary: StadiumMaterialLibrary | null = null;
  private upperTierEnabled: boolean;

  constructor(options: StadiumControllerOptions) {
    this.group.name = 'stadium-controller-root';
    this.group.userData.stadium = true;
    this.enabled = options.enabled;
    this.imageMaterialsEnabled = options.imageMaterialsEnabled;
    this.renderer = options.renderer;
    this.spec = options.spec ?? DEFAULT_STADIUM_SPEC;
    this.upperTierEnabled = options.upperTierEnabled;
    this.rebuild();
  }

  applySettings(options: {
    enabled: boolean;
    imageMaterialsEnabled: boolean;
    upperTierEnabled: boolean;
  }): void {
    if (
      this.enabled === options.enabled &&
      this.imageMaterialsEnabled === options.imageMaterialsEnabled &&
      this.upperTierEnabled === options.upperTierEnabled
    ) {
      return;
    }

    this.enabled = options.enabled;
    this.imageMaterialsEnabled = options.imageMaterialsEnabled;
    this.upperTierEnabled = options.upperTierEnabled;
    this.rebuild();
  }

  getSnapshot(): StadiumControllerSnapshot {
    const metrics = this.build?.metrics ?? createEmptyMetrics();
    const textureSnapshot = getStadiumTextureCacheSnapshot();
    const lowerTierRows = this.spec.tiers[0]?.rowCount ?? 0;
    return {
      ...metrics,
      enabled: this.enabled,
      imageMaterialsEnabled: this.imageMaterialsEnabled,
      lowerTierRows,
      seatCount: createSeatLayout(this.spec, {
        upperTierEnabled: this.upperTierEnabled,
      }).seats.length,
      textureCount: this.imageMaterialsEnabled ? textureSnapshot.textureCount : 0,
      upperTierEnabled: this.upperTierEnabled,
    };
  }

  dispose(): void {
    this.disposeBuild();
  }

  private rebuild(): void {
    this.disposeBuild();

    if (!this.enabled) {
      return;
    }

    this.materialLibrary = createStadiumMaterialLibrary({
      anisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      imageMaterialsEnabled: this.imageMaterialsEnabled,
    });
    this.build = buildStadiumGeometry({
      materials: this.materialLibrary,
      spec: this.spec,
      upperTierEnabled: this.upperTierEnabled,
    });
    this.group.add(this.build.group);
  }

  private disposeBuild(): void {
    if (this.build) {
      this.group.remove(this.build.group);
      for (const geometry of new Set(this.build.geometries)) {
        geometry.dispose();
      }
      this.build = null;
    }
    this.materialLibrary?.dispose();
    this.materialLibrary = null;
  }
}

function createEmptyMetrics(): StadiumGeometryMetrics {
  return {
    drawCalls: 0,
    geometryCount: 0,
    materialCount: 0,
    seatCount: 0,
    textureCount: 0,
    triangles: 0,
  };
}
