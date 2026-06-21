import type * as THREE from 'three';
import type { StadiumSectionId } from '../stadium/StadiumTypes';

export type CrowdPreviewCameraView = 'close' | 'endZone' | 'sideline' | 'wide';

export interface CrowdPreviewBenchmarkReport {
  actualSpectatorCount: number;
  averageFrameTimeMs: number;
  crowdDrawCalls: number;
  crowdTriangles: number;
  estimatedInstanceBufferBytes: number;
  frameCount: number;
  minimumObservedFps: number;
  requestedSpectatorCount: number;
  rendererMemory: {
    geometries: number;
    textures: number;
  };
}

export interface CrowdPreviewSnapshot {
  actualSpectatorCount: number;
  averageFrameTimeMs: number;
  benchmark: {
    active: boolean;
    completed: boolean;
    currentCount: number | null;
    reports: CrowdPreviewBenchmarkReport[];
  };
  cameraView: CrowdPreviewCameraView;
  crowdDrawCalls: number;
  crowdTriangles: number;
  estimatedInstanceBufferBytes: number;
  farInstanceCount: number;
  frameCount: number;
  gameplayPlayerCount: number;
  geometryCount: number;
  materialCount: number;
  minimumObservedFps: number;
  nearInstanceCount: number;
  perInstanceStorage: CrowdPerInstanceStorageSnapshot;
  requestedSpectatorCount: number;
  rendererMemory: CrowdRendererMemorySnapshot;
  rendererRender: CrowdRendererRenderSnapshot;
  textureCount: number;
}

export interface CrowdPreviewPlacement {
  colorSeed: number;
  facingRadians: number;
  lod: 'far' | 'near';
  row: number;
  scale: number;
  seatIndex: number;
  stand: StadiumSectionId;
  tier: number;
  x: number;
  y: number;
  z: number;
}

export interface CrowdPreviewControllerOptions {
  benchmarkDurationSeconds?: number;
  benchmarkEnabled?: boolean;
  height: number;
  requestedCount: number;
  view?: CrowdPreviewCameraView;
  width: number;
}

export interface CrowdPerInstanceStorageSnapshot {
  colorBytes: number;
  customReactionDataBytes: number;
  farMeshesPerSpectator: number;
  nearMeshesPerSpectator: number;
  transformMatrixBytes: number;
}

export interface CrowdRendererMemorySnapshot {
  geometries: number;
  textures: number;
}

export interface CrowdRendererRenderSnapshot {
  calls: number;
  triangles: number;
}

export interface CrowdResourceSnapshotBase {
  actualSpectatorCount: number;
  crowdDrawCalls: number;
  crowdTriangles: number;
  estimatedInstanceBufferBytes: number;
  farInstanceCount: number;
  geometryCount: number;
  materialCount: number;
  nearInstanceCount: number;
  textureCount: number;
}

export interface CrowdResources {
  detailedArmLeft: THREE.InstancedMesh;
  detailedArmRight: THREE.InstancedMesh;
  detailedHead: THREE.InstancedMesh;
  detailedTorso: THREE.InstancedMesh;
  farBody: THREE.InstancedMesh;
  farPlacements: readonly CrowdPreviewPlacement[];
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  materials: THREE.Material[];
  nearPlacements: readonly CrowdPreviewPlacement[];
  snapshotBase: CrowdResourceSnapshotBase;
}
