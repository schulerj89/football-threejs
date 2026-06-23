import type * as THREE from 'three';
import type { StadiumSectionId } from '../stadium/StadiumTypes';

export type CrowdPreviewCameraView = 'close' | 'endZone' | 'sideline' | 'wide';

export interface CrowdPreviewBenchmarkReport {
  actualSpectatorCount: number;
  averageFrameTimeMs: number;
  crowdDrawCalls: number;
  crowdTriangles: number;
  estimatedInstanceBufferBytes: number;
  estimatedStaticBufferBytes: number;
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
  activeNearSpectators: number;
  averageFrameTimeMs: number;
  benchmark: {
    active: boolean;
    completed: boolean;
    currentCount: number | null;
    reports: CrowdPreviewBenchmarkReport[];
  };
  cameraView: CrowdPreviewCameraView;
  crowdDrawCalls: number;
  crowdFullness: CrowdFullness;
  crowdTriangles: number;
  estimatedInstanceBufferBytes: number;
  estimatedStaticBufferBytes: number;
  farMosaicSeatCount: number;
  farSeatOccupancy: number;
  farInstanceCount: number;
  frameCount: number;
  gameplayPlayerCount: number;
  geometryCount: number;
  materialCount: number;
  minimumObservedFps: number;
  nearInstanceCount: number;
  perInstanceStorage: CrowdPerInstanceStorageSnapshot;
  reactingSpectatorLimit: number;
  requestedSpectatorCount: number;
  rendererMemory: CrowdRendererMemorySnapshot;
  rendererRender: CrowdRendererRenderSnapshot;
  textureCount: number;
  visualAttendance: number;
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
  activeNearSpectators: number;
  crowdDrawCalls: number;
  crowdFullness: CrowdFullness;
  crowdTriangles: number;
  estimatedInstanceBufferBytes: number;
  estimatedStaticBufferBytes: number;
  farMosaicSeatCount: number;
  farSeatOccupancy: number;
  farInstanceCount: number;
  geometryCount: number;
  materialCount: number;
  nearInstanceCount: number;
  reactingSpectatorLimit: number;
  textureCount: number;
  visualAttendance: number;
}

export interface CrowdResources {
  detailedArmLeft: THREE.InstancedMesh;
  detailedArmRight: THREE.InstancedMesh;
  detailedHead: THREE.InstancedMesh;
  detailedTorso: THREE.InstancedMesh;
  farMosaic: THREE.Points;
  farPlacements: readonly CrowdPreviewPlacement[];
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  materials: THREE.Material[];
  nearPlacements: readonly CrowdPreviewPlacement[];
  snapshotBase: CrowdResourceSnapshotBase;
}

export type CrowdFullness = 'adaptive' | 'full' | 'sparse' | 'standard';

export interface CrowdAttendanceProfile {
  activeNearSpectators: number;
  crowdFullness: CrowdFullness;
  farSeatOccupancy: number;
  nearSpectatorCount: number;
  reactingSpectatorLimit: number;
  visualAttendance: number;
  visualSeatCount: number;
}

export interface CrowdFullnessProfile extends CrowdAttendanceProfile {
  nearSpectatorCount: number;
  visualSeatCount: number;
}
