import * as THREE from 'three';
import {
  CUSTOM_REACTION_BYTES,
  FAR_MOSAIC_COLOR_BYTES,
  FAR_MOSAIC_VERTEX_BYTES,
  FAR_MESHES_PER_SPECTATOR,
  INSTANCE_COLOR_BYTES,
  NEAR_MESHES_PER_SPECTATOR,
  TRANSFORM_MATRIX_BYTES,
} from './CrowdConfiguration';
import type {
  CrowdPerInstanceStorageSnapshot,
  CrowdRendererMemorySnapshot,
  CrowdRendererRenderSnapshot,
  CrowdResourceSnapshotBase,
} from './CrowdTypes';

export class CrowdFrameMetrics {
  private elapsedSeconds = 0;
  private frameCount = 0;
  private minFps = Number.POSITIVE_INFINITY;
  private rendererMemory: CrowdRendererMemorySnapshot = { geometries: 0, textures: 0 };
  private rendererRender: CrowdRendererRenderSnapshot = { calls: 0, triangles: 0 };

  recordFrame(deltaSeconds: number, renderer: THREE.WebGLRenderer): void {
    const clampedDelta = Math.max(0, Math.min(deltaSeconds, 0.25));
    this.frameCount += 1;
    this.elapsedSeconds += clampedDelta;

    if (clampedDelta > 0) {
      this.minFps = Math.min(this.minFps, 1 / clampedDelta);
    }

    this.rendererMemory = {
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    };
    this.rendererRender = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  }

  reset(): void {
    this.elapsedSeconds = 0;
    this.frameCount = 0;
    this.minFps = Number.POSITIVE_INFINITY;
  }

  getSnapshot(): {
    averageFrameTimeMs: number;
    frameCount: number;
    minimumObservedFps: number;
    rendererMemory: CrowdRendererMemorySnapshot;
    rendererRender: CrowdRendererRenderSnapshot;
  } {
    return {
      averageFrameTimeMs: this.frameCount > 0
        ? (this.elapsedSeconds / this.frameCount) * 1000
        : 0,
      frameCount: this.frameCount,
      minimumObservedFps: Number.isFinite(this.minFps) ? this.minFps : 0,
      rendererMemory: { ...this.rendererMemory },
      rendererRender: { ...this.rendererRender },
    };
  }
}

export function createPerInstanceStorageSnapshot(): CrowdPerInstanceStorageSnapshot {
  return {
    colorBytes: INSTANCE_COLOR_BYTES,
    customReactionDataBytes: CUSTOM_REACTION_BYTES,
    farMeshesPerSpectator: FAR_MESHES_PER_SPECTATOR,
    nearMeshesPerSpectator: NEAR_MESHES_PER_SPECTATOR,
    transformMatrixBytes: TRANSFORM_MATRIX_BYTES,
  };
}

export function estimateInstanceBufferBytes(nearCount: number, farCount: number): number {
  const bytesPerInstancedPart = TRANSFORM_MATRIX_BYTES + INSTANCE_COLOR_BYTES + CUSTOM_REACTION_BYTES;

  return (
    nearCount * NEAR_MESHES_PER_SPECTATOR * bytesPerInstancedPart +
    farCount * FAR_MESHES_PER_SPECTATOR * bytesPerInstancedPart
  );
}

export function estimateStaticCrowdBufferBytes(farMosaicSeatCount: number): number {
  return farMosaicSeatCount * (FAR_MOSAIC_VERTEX_BYTES + FAR_MOSAIC_COLOR_BYTES);
}

export function createCrowdMemoryBudgetSnapshot(
  snapshot: CrowdResourceSnapshotBase,
): {
  geometryCount: number;
  materialCount: number;
  textureCount: number;
  totalInstanceBufferBytes: number;
} {
  return {
    geometryCount: snapshot.geometryCount,
    materialCount: snapshot.materialCount,
    textureCount: snapshot.textureCount,
    totalInstanceBufferBytes: snapshot.estimatedInstanceBufferBytes,
  };
}

export function resourcesReturnedNearBaseline(
  before: { geometries: number; textures: number },
  after: { geometries: number; textures: number },
  tolerance = 2,
): boolean {
  return Math.abs(after.geometries - before.geometries) <= tolerance &&
    Math.abs(after.textures - before.textures) <= tolerance;
}

export function countCrowdDrawCalls(group: THREE.Group): number {
  let drawCalls = 0;

  group.traverse((object) => {
    if (isRenderableCrowdObject(object)) {
      drawCalls += 1;
    }
  });

  return drawCalls;
}

export function countCrowdTriangles(group: THREE.Group): number {
  let triangles = 0;

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !isRenderableCrowdObject(object)) {
      return;
    }

    const geometryTriangles = getGeometryTriangleCount(object.geometry);
    const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1;
    triangles += geometryTriangles * instanceCount;
  });

  return triangles;
}

function isRenderableCrowdObject(object: THREE.Object3D): object is THREE.Mesh | THREE.Points {
  if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) {
    return false;
  }

  if (!isWorldVisible(object)) {
    return false;
  }

  if (object instanceof THREE.InstancedMesh && object.count <= 0) {
    return false;
  }

  const position = object.geometry.getAttribute('position');
  return Boolean(position && position.count > 0);
}

function isWorldVisible(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) {
      return false;
    }
    current = current.parent;
  }
  return true;
}

function getGeometryTriangleCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }

  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}
