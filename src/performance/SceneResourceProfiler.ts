import * as THREE from 'three';
import { collectRendererMetrics } from './RendererMetricsCollector';
import {
  addBufferMemorySnapshots,
  createEmptyBufferMemorySnapshot,
  estimateGeometryBufferBytes,
  estimateInstancedMeshBufferBytes,
} from './GeometryMemoryEstimator';
import {
  collectMaterialTextures,
  estimateTextureMemory,
} from './TextureMemoryEstimator';
import {
  createUnsupportedBrowserMemorySnapshot,
  type BrowserMemoryProvider,
} from './BrowserMemoryProvider';
import type {
  BrowserMemorySnapshot,
  CalculatedBufferMemorySnapshot,
  MemorySubsystemId,
  SceneResourceProfileSnapshot,
  SubsystemMemorySnapshot,
  TextureMemoryEstimate,
} from './MemoryTypes';

export interface SceneResourceProfileOptions {
  browserMemory?: BrowserMemorySnapshot;
  playerVisuals?: Iterable<THREE.Object3D>;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
}

export class SceneResourceProfiler {
  private browserMemorySnapshot = createUnsupportedBrowserMemorySnapshot();

  constructor(private readonly browserMemoryProvider?: BrowserMemoryProvider) {}

  async refreshBrowserMemory(): Promise<BrowserMemorySnapshot> {
    if (!this.browserMemoryProvider) {
      this.browserMemorySnapshot = createUnsupportedBrowserMemorySnapshot();
      return this.browserMemorySnapshot;
    }

    this.browserMemorySnapshot = await this.browserMemoryProvider.measure();
    return this.browserMemorySnapshot;
  }

  profile({
    playerVisuals,
    renderer,
    scene,
  }: Omit<SceneResourceProfileOptions, 'browserMemory'>): SceneResourceProfileSnapshot {
    return createSceneResourceProfileSnapshot({
      browserMemory: this.browserMemorySnapshot,
      playerVisuals,
      renderer,
      scene,
    });
  }
}

export function createSceneResourceProfileSnapshot({
  browserMemory = createUnsupportedBrowserMemorySnapshot(),
  playerVisuals = [],
  renderer,
  scene,
}: SceneResourceProfileOptions): SceneResourceProfileSnapshot {
  const rendererMetrics = collectRendererMetrics(renderer);
  const subsystemStates = createSubsystemStates();
  const subsystemLookup = createSubsystemLookup(scene, playerVisuals);
  const globalTextures = new Map<string, THREE.Texture>();
  const textureEstimates: TextureMemoryEstimate[] = [];

  scene.traverse((object) => {
    const subsystem = subsystemLookup.get(object) ?? classifyObject(object);
    const state = subsystemStates.get(subsystem)!;
    state.objectCount += 1;

    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    state.meshCount += 1;
    if (!state.geometries.has(object.geometry.uuid)) {
      state.geometries.add(object.geometry.uuid);
      state.bufferBytes = addBufferMemorySnapshots(
        state.bufferBytes,
        estimateGeometryBufferBytes(object.geometry),
      );
    }

    if (object instanceof THREE.InstancedMesh) {
      state.bufferBytes = addBufferMemorySnapshots(
        state.bufferBytes,
        estimateInstancedMeshBufferBytes(object),
      );
    }

    for (const material of getMaterials(object.material)) {
      state.materials.add(material.uuid);
      for (const texture of collectMaterialTextures(material)) {
        state.textures.add(texture.uuid);
        if (!globalTextures.has(texture.uuid)) {
          globalTextures.set(texture.uuid, texture);
          textureEstimates.push(estimateTextureMemory(texture));
        }
      }
    }
  });

  const subsystemTotals = [...subsystemStates.values()].map((state) => {
    const estimates = [...state.textures]
      .map((textureId) => textureEstimates.find((estimate) => estimate.id === textureId))
      .filter((estimate): estimate is TextureMemoryEstimate => Boolean(estimate));
    const estimatedTextureBytes = estimates.reduce(
      (sum, estimate) => sum + (estimate.estimatedBytes ?? 0),
      0,
    );
    const unknownTextureCount = estimates.filter((estimate) =>
      estimate.estimatedBytes === null).length;

    return {
      bufferBytes: state.bufferBytes,
      estimatedTextureBytes,
      geometryCount: state.geometries.size,
      materialCount: state.materials.size,
      meshCount: state.meshCount,
      notes: createSubsystemNotes(state.id, unknownTextureCount),
      objectCount: state.objectCount,
      subsystem: state.id,
      textureCount: state.textures.size,
      unknownTextureCount,
    } satisfies SubsystemMemorySnapshot;
  });

  const calculatedBufferBytes = subsystemTotals.reduce(
    (total, subsystem) => addBufferMemorySnapshots(total, subsystem.bufferBytes),
    createEmptyBufferMemorySnapshot(),
  );

  return {
    browserMemory,
    calculatedBufferBytes,
    disclaimer:
      'Buffer and texture totals are calculated or estimated from Three.js-visible resources; they are not exact GPU VRAM usage.',
    renderer: {
      drawCalls: rendererMetrics.calls,
      geometries: rendererMetrics.geometries,
      lines: rendererMetrics.lines,
      points: rendererMetrics.points,
      textures: rendererMetrics.textures,
      triangles: rendererMetrics.triangles,
    },
    subsystemTotals,
    textureEstimates,
    totals: {
      estimatedTextureBytes: textureEstimates.reduce(
        (sum, estimate) => sum + (estimate.estimatedBytes ?? 0),
        0,
      ),
      materialCount: countDistinct(subsystemTotals, 'materialCount'),
      meshCount: subsystemTotals.reduce((sum, subsystem) => sum + subsystem.meshCount, 0),
      objectCount: subsystemTotals.reduce((sum, subsystem) => sum + subsystem.objectCount, 0),
      unknownTextureCount: textureEstimates.filter((estimate) =>
        estimate.estimatedBytes === null).length,
    },
  };
}

interface SubsystemState {
  bufferBytes: CalculatedBufferMemorySnapshot;
  geometries: Set<string>;
  id: MemorySubsystemId;
  materials: Set<string>;
  meshCount: number;
  objectCount: number;
  textures: Set<string>;
}

function createSubsystemStates(): Map<MemorySubsystemId, SubsystemState> {
  const states = new Map<MemorySubsystemId, SubsystemState>();
  for (const id of [
    'field',
    'players',
    'helmets',
    'football',
    'routeArt',
    'crowd',
    'stadium',
    'uiRenderTargets',
    'other',
  ] as const) {
    states.set(id, {
      bufferBytes: createEmptyBufferMemorySnapshot(),
      geometries: new Set(),
      id,
      materials: new Set(),
      meshCount: 0,
      objectCount: 0,
      textures: new Set(),
    });
  }
  return states;
}

function createSubsystemLookup(
  scene: THREE.Scene,
  playerVisuals: Iterable<THREE.Object3D>,
): WeakMap<THREE.Object3D, MemorySubsystemId> {
  const lookup = new WeakMap<THREE.Object3D, MemorySubsystemId>();

  for (const playerVisual of playerVisuals) {
    assignSubsystem(playerVisual, 'players', lookup);
  }

  scene.traverse((object) => {
    const name = object.name.toLowerCase();
    if (name === 'low-poly-helmet' || name.includes('helmet-')) {
      assignSubsystem(object, 'helmets', lookup);
    } else if (
      name === 'football-field' ||
      name.includes('yard') ||
      name.includes('goal-line') ||
      name.includes('sideline')
    ) {
      assignSubsystem(object, 'field', lookup);
    } else if (name === 'football-ball' || name.startsWith('football-')) {
      assignSubsystem(object, 'football', lookup);
    } else if (name === 'route-art-root' || name.startsWith('route-art-')) {
      assignSubsystem(object, 'routeArt', lookup);
    } else if (
      object.userData.crowdPreview ||
      object.userData.crowdPresentation ||
      name.includes('crowd')
    ) {
      assignSubsystem(object, 'crowd', lookup);
    } else if (name.includes('stadium') || name.includes('stand') || name.includes('seating')) {
      assignSubsystem(object, 'stadium', lookup);
    }
  });

  return lookup;
}

function assignSubsystem(
  root: THREE.Object3D,
  subsystem: MemorySubsystemId,
  lookup: WeakMap<THREE.Object3D, MemorySubsystemId>,
): void {
  root.traverse((object) => {
    lookup.set(object, subsystem);
  });
}

function classifyObject(object: THREE.Object3D): MemorySubsystemId {
  const name = object.name.toLowerCase();
  if (name.includes('field') || name.includes('yard') || name.includes('goal')) {
    return 'field';
  }
  if (name.includes('helmet')) {
    return 'helmets';
  }
  if (name.includes('player')) {
    return 'players';
  }
  if (name.includes('football') || name.includes('ball')) {
    return 'football';
  }
  if (name.includes('route-art')) {
    return 'routeArt';
  }
  if (name.includes('crowd')) {
    return 'crowd';
  }
  if (name.includes('stadium') || name.includes('stand') || name.includes('seating')) {
    return 'stadium';
  }
  return 'other';
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function createSubsystemNotes(
  subsystem: MemorySubsystemId,
  unknownTextureCount: number,
): string[] {
  const notes: string[] = [];
  if (unknownTextureCount > 0) {
    notes.push(`${unknownTextureCount} texture estimate(s) are unknown.`);
  }
  if (subsystem === 'uiRenderTargets') {
    notes.push('Render target estimates only include resources visible to this profiler.');
  }
  return notes;
}

function countDistinct(
  subsystemTotals: readonly SubsystemMemorySnapshot[],
  key: 'materialCount',
): number {
  return subsystemTotals.reduce((sum, subsystem) => sum + subsystem[key], 0);
}
