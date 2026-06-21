import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIELD_BOUNDS, FIELD_DIMENSIONS } from './fieldSpec';

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
  perInstanceStorage: {
    colorBytes: number;
    customReactionDataBytes: number;
    farMeshesPerSpectator: number;
    nearMeshesPerSpectator: number;
    transformMatrixBytes: number;
  };
  requestedSpectatorCount: number;
  rendererMemory: {
    geometries: number;
    textures: number;
  };
  rendererRender: {
    calls: number;
    triangles: number;
  };
  textureCount: number;
}

export interface CrowdPreviewPlacement {
  colorSeed: number;
  facingRadians: number;
  lod: 'far' | 'near';
  scale: number;
  stand: 'endZoneFar' | 'endZoneNear' | 'sidelineLeft' | 'sidelineRight';
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

interface CrowdResources {
  detailedArmLeft: THREE.InstancedMesh;
  detailedArmRight: THREE.InstancedMesh;
  detailedHead: THREE.InstancedMesh;
  detailedTorso: THREE.InstancedMesh;
  farBody: THREE.InstancedMesh;
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  materials: THREE.Material[];
  seatingShell: THREE.Mesh;
  snapshotBase: {
    actualSpectatorCount: number;
    crowdDrawCalls: number;
    crowdTriangles: number;
    estimatedInstanceBufferBytes: number;
    farInstanceCount: number;
    geometryCount: number;
    materialCount: number;
    nearInstanceCount: number;
    textureCount: number;
  };
}

interface FrameStats {
  elapsedSeconds: number;
  frameCount: number;
  minFps: number;
}

const CROWD_COUNT_DEFAULT = 500;
const CROWD_COUNT_MAX = 10_000;
const CROWD_COUNT_MIN = 0;
const CROWD_BENCHMARK_COUNTS = [500, 2_000, 5_000, 10_000] as const;
const DEFAULT_BENCHMARK_DURATION_SECONDS = 1.2;
const TRANSFORM_MATRIX_BYTES = 16 * Float32Array.BYTES_PER_ELEMENT;
const INSTANCE_COLOR_BYTES = 3 * Float32Array.BYTES_PER_ELEMENT;
const CUSTOM_REACTION_BYTES = 0;
const NEAR_MESHES_PER_SPECTATOR = 4;
const FAR_MESHES_PER_SPECTATOR = 1;
const NEAR_LOD_RATIO = 0.58;
const NEAR_LOD_MAX = 2_500;

const CROWD_PREVIEW_CONFIG = {
  endZone: {
    rowCount: 22,
    rowDepth: 0.86,
    rowRise: 0.38,
    seatSpacing: 0.78,
    width: FIELD_DIMENSIONS.fieldWidth + 32,
    zOffset: 13,
  },
  sideline: {
    depth: FIELD_DIMENSIONS.fieldLength + 16,
    rowCount: 28,
    rowDepth: 0.86,
    rowRise: 0.38,
    seatSpacing: 0.78,
    xOffset: 12,
  },
  spectator: {
    armHeight: 0.33,
    armLength: 0.42,
    farHeight: 0.64,
    farWidth: 0.34,
    headRadius: 0.13,
    torsoHeight: 0.48,
  },
} as const;

export class CrowdPreviewController {
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 520);
  readonly group = new THREE.Group();

  private benchmarkActive = false;
  private benchmarkCompleted = false;
  private benchmarkDurationSeconds: number;
  private benchmarkElapsedSeconds = 0;
  private benchmarkIndex = 0;
  private benchmarkReports: CrowdPreviewBenchmarkReport[] = [];
  private cameraView: CrowdPreviewCameraView;
  private frameStats: FrameStats = createEmptyFrameStats();
  private height: number;
  private requestedCount: number;
  private resources: CrowdResources;
  private width: number;

  constructor({
    benchmarkDurationSeconds = DEFAULT_BENCHMARK_DURATION_SECONDS,
    benchmarkEnabled = false,
    height,
    requestedCount,
    view = 'wide',
    width,
  }: CrowdPreviewControllerOptions) {
    this.group.name = 'crowd-preview-root';
    this.width = width;
    this.height = height;
    this.cameraView = view;
    this.benchmarkDurationSeconds = benchmarkDurationSeconds;
    this.requestedCount = benchmarkEnabled ? CROWD_BENCHMARK_COUNTS[0] : clampCrowdCount(requestedCount);
    this.resources = createCrowdResources(this.requestedCount);
    this.group.add(this.resources.group);
    this.resize(width, height);

    if (benchmarkEnabled) {
      this.benchmarkActive = true;
    }
  }

  dispose(): void {
    disposeCrowdResources(this.resources);
  }

  setCameraView(view: CrowdPreviewCameraView): void {
    this.cameraView = view;
    applyCrowdPreviewCameraView(this.camera, view);
  }

  setCount(requestedCount: number): void {
    this.group.remove(this.resources.group);
    disposeCrowdResources(this.resources);
    this.requestedCount = clampCrowdCount(requestedCount);
    this.resources = createCrowdResources(this.requestedCount);
    this.group.add(this.resources.group);
    this.frameStats = createEmptyFrameStats();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    applyCrowdPreviewCameraView(this.camera, this.cameraView);
  }

  updateBeforeRender(): void {
    if (!this.benchmarkActive) {
      return;
    }

    if (this.benchmarkElapsedSeconds < this.benchmarkDurationSeconds) {
      return;
    }

    this.benchmarkReports.push(createBenchmarkReport(this.getSnapshot()));
    this.benchmarkIndex += 1;
    this.benchmarkElapsedSeconds = 0;

    if (this.benchmarkIndex >= CROWD_BENCHMARK_COUNTS.length) {
      this.benchmarkActive = false;
      this.benchmarkCompleted = true;
      console.info('Crowd benchmark report', JSON.stringify(this.benchmarkReports));
      return;
    }

    this.setCount(CROWD_BENCHMARK_COUNTS[this.benchmarkIndex]);
  }

  recordFrame(deltaSeconds: number, renderer: THREE.WebGLRenderer): void {
    const clampedDelta = Math.max(0, Math.min(deltaSeconds, 0.25));
    this.frameStats.frameCount += 1;
    this.frameStats.elapsedSeconds += clampedDelta;

    if (clampedDelta > 0) {
      this.frameStats.minFps = Math.min(this.frameStats.minFps, 1 / clampedDelta);
    }

    if (this.benchmarkActive) {
      this.benchmarkElapsedSeconds += clampedDelta;
    }

    this.lastRendererMemory = {
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    };
    this.lastRendererRender = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  }

  getSnapshot(): CrowdPreviewSnapshot {
    const averageFrameTimeMs = this.frameStats.frameCount > 0
      ? (this.frameStats.elapsedSeconds / this.frameStats.frameCount) * 1000
      : 0;
    const minimumObservedFps = Number.isFinite(this.frameStats.minFps)
      ? this.frameStats.minFps
      : 0;

    return {
      ...this.resources.snapshotBase,
      averageFrameTimeMs,
      benchmark: {
        active: this.benchmarkActive,
        completed: this.benchmarkCompleted,
        currentCount: this.benchmarkActive ? this.requestedCount : null,
        reports: this.benchmarkReports.map((report) => ({ ...report })),
      },
      cameraView: this.cameraView,
      frameCount: this.frameStats.frameCount,
      gameplayPlayerCount: 0,
      perInstanceStorage: {
        colorBytes: INSTANCE_COLOR_BYTES,
        customReactionDataBytes: CUSTOM_REACTION_BYTES,
        farMeshesPerSpectator: FAR_MESHES_PER_SPECTATOR,
        nearMeshesPerSpectator: NEAR_MESHES_PER_SPECTATOR,
        transformMatrixBytes: TRANSFORM_MATRIX_BYTES,
      },
      requestedSpectatorCount: this.requestedCount,
      rendererMemory: { ...this.lastRendererMemory },
      rendererRender: { ...this.lastRendererRender },
      minimumObservedFps,
    };
  }

  private lastRendererMemory = {
    geometries: 0,
    textures: 0,
  };

  private lastRendererRender = {
    calls: 0,
    triangles: 0,
  };
}

export function resolveCrowdPreviewEnabled(searchParams: URLSearchParams): boolean {
  return searchParams.get('crowdPreview') === '1';
}

export function resolveCrowdPreviewCount(searchParams: URLSearchParams): number {
  return clampCrowdCount(Number(searchParams.get('crowdCount') ?? CROWD_COUNT_DEFAULT));
}

export function resolveCrowdPreviewCameraView(value: string | null): CrowdPreviewCameraView {
  if (value === 'sideline' || value === 'endZone' || value === 'close') {
    return value;
  }

  return 'wide';
}

export function resolveCrowdBenchmarkDurationSeconds(value: string | null): number {
  const parsed = Number(value ?? DEFAULT_BENCHMARK_DURATION_SECONDS);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_BENCHMARK_DURATION_SECONDS;
  }

  return Math.min(10, Math.max(0.05, parsed));
}

export function clampCrowdCount(value: number): number {
  if (!Number.isFinite(value)) {
    return CROWD_COUNT_DEFAULT;
  }

  return Math.min(CROWD_COUNT_MAX, Math.max(CROWD_COUNT_MIN, Math.floor(value)));
}

export function createCrowdPlacements(requestedCount: number): readonly CrowdPreviewPlacement[] {
  const actualCount = clampCrowdCount(requestedCount);
  const placementCandidates = createPlacementCandidates();
  const nearCount = Math.min(
    actualCount,
    Math.min(NEAR_LOD_MAX, Math.floor(actualCount * NEAR_LOD_RATIO)),
  );
  const placements: CrowdPreviewPlacement[] = [];

  for (let index = 0; index < actualCount; index += 1) {
    const candidate = placementCandidates[index % placementCandidates.length];
    placements.push({
      ...candidate,
      colorSeed: stableHash(`${candidate.stand}:${candidate.x.toFixed(2)}:${candidate.z.toFixed(2)}:${index}`),
      lod: index < nearCount ? 'near' : 'far',
      scale: 0.86 + (stableHash(`scale:${index}`) % 17) / 100,
    });
  }

  return placements;
}

export function createCrowdPreviewOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'crowd-preview-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncCrowdPreviewOverlay(
  element: HTMLElement,
  snapshot: CrowdPreviewSnapshot,
): void {
  element.textContent = [
    'CROWD PREVIEW',
    `REQUESTED ${snapshot.requestedSpectatorCount}`,
    `ACTUAL ${snapshot.actualSpectatorCount}`,
    `LOD near ${snapshot.nearInstanceCount} far ${snapshot.farInstanceCount}`,
    `CAM ${snapshot.cameraView}`,
    `CROWD_CALLS ${snapshot.crowdDrawCalls}`,
    `CROWD_TRIS ${snapshot.crowdTriangles}`,
    `GEOMS ${snapshot.geometryCount}`,
    `MATS ${snapshot.materialCount}`,
    `TEX ${snapshot.textureCount}`,
    `INSTANCE_BYTES ${snapshot.estimatedInstanceBufferBytes}`,
    `PER_INSTANCE matrix ${snapshot.perInstanceStorage.transformMatrixBytes} color ${snapshot.perInstanceStorage.colorBytes} reaction ${snapshot.perInstanceStorage.customReactionDataBytes}`,
    `AVG_FRAME_MS ${snapshot.averageFrameTimeMs.toFixed(2)}`,
    `MIN_FPS ${snapshot.minimumObservedFps.toFixed(1)}`,
    `RENDER calls ${snapshot.rendererRender.calls} tris ${snapshot.rendererRender.triangles}`,
    `MEM geoms ${snapshot.rendererMemory.geometries} tex ${snapshot.rendererMemory.textures}`,
    `BENCH ${formatBenchmark(snapshot)}`,
    'VIEWS 1 wide | 2 sideline | 3 end-zone | 4 close',
  ].join('\n');
}

function createCrowdResources(requestedCount: number): CrowdResources {
  const placements = createCrowdPlacements(requestedCount);
  const nearPlacements = placements.filter((placement) => placement.lod === 'near');
  const farPlacements = placements.filter((placement) => placement.lod === 'far');
  const group = new THREE.Group();
  group.name = 'crowd-preview';

  const geometries = createSharedCrowdGeometries();
  const materials = createSharedCrowdMaterials();
  const seatingShell = createSeatingShellMesh(materials.seating);
  group.add(seatingShell);
  const detailedTorso = new THREE.InstancedMesh(geometries.torso, materials.uniform, nearPlacements.length);
  const detailedHead = new THREE.InstancedMesh(geometries.head, materials.skin, nearPlacements.length);
  const detailedArmLeft = new THREE.InstancedMesh(geometries.arm, materials.uniform, nearPlacements.length);
  const detailedArmRight = new THREE.InstancedMesh(geometries.arm, materials.uniform, nearPlacements.length);
  const farBody = new THREE.InstancedMesh(geometries.farBody, materials.farBody, farPlacements.length);
  const crowdMeshes = [detailedTorso, detailedHead, detailedArmLeft, detailedArmRight, farBody];

  for (const mesh of crowdMeshes) {
    mesh.name = `crowd-${mesh.geometry.name || 'instances'}`;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.userData.crowdPreview = true;
    group.add(mesh);
  }

  applyDetailedInstances(nearPlacements, detailedTorso, detailedHead, detailedArmLeft, detailedArmRight);
  applyFarInstances(farPlacements, farBody);

  const ownedGeometries = [
    geometries.torso,
    geometries.head,
    geometries.arm,
    geometries.farBody,
    seatingShell.geometry,
  ];
  const ownedMaterials = [materials.uniform, materials.skin, materials.farBody, materials.seating];
  const snapshotBase = {
    actualSpectatorCount: placements.length,
    crowdDrawCalls: countCrowdDrawCalls(group),
    crowdTriangles: countCrowdTriangles(group),
    estimatedInstanceBufferBytes: estimateInstanceBufferBytes(nearPlacements.length, farPlacements.length),
    farInstanceCount: farPlacements.length,
    geometryCount: ownedGeometries.length,
    materialCount: ownedMaterials.length,
    nearInstanceCount: nearPlacements.length,
    textureCount: 0,
  };

  return {
    detailedArmLeft,
    detailedArmRight,
    detailedHead,
    detailedTorso,
    farBody,
    geometries: ownedGeometries,
    group,
    materials: ownedMaterials,
    seatingShell,
    snapshotBase,
  };
}

function createPlacementCandidates(): Omit<CrowdPreviewPlacement, 'colorSeed' | 'lod' | 'scale'>[] {
  const candidates: Omit<CrowdPreviewPlacement, 'colorSeed' | 'lod' | 'scale'>[] = [];

  candidates.push(...createSidelinePlacementCandidates('sidelineLeft', -1));
  candidates.push(...createSidelinePlacementCandidates('sidelineRight', 1));
  candidates.push(...createEndZonePlacementCandidates('endZoneNear', -1));
  candidates.push(...createEndZonePlacementCandidates('endZoneFar', 1));

  return candidates.sort((a, b) => {
    const rowDistanceA = Math.hypot(Math.abs(a.x) - FIELD_DIMENSIONS.fieldWidth / 2, Math.abs(a.z) - FIELD_DIMENSIONS.fieldLength / 2);
    const rowDistanceB = Math.hypot(Math.abs(b.x) - FIELD_DIMENSIONS.fieldWidth / 2, Math.abs(b.z) - FIELD_DIMENSIONS.fieldLength / 2);

    return rowDistanceA - rowDistanceB || a.stand.localeCompare(b.stand) || a.z - b.z || a.x - b.x;
  });
}

function createSidelinePlacementCandidates(
  stand: 'sidelineLeft' | 'sidelineRight',
  sideSign: -1 | 1,
): Omit<CrowdPreviewPlacement, 'colorSeed' | 'lod' | 'scale'>[] {
  const candidates: Omit<CrowdPreviewPlacement, 'colorSeed' | 'lod' | 'scale'>[] = [];
  const config = CROWD_PREVIEW_CONFIG.sideline;
  const seatsPerRow = Math.floor(config.depth / config.seatSpacing);
  const startZ = -config.depth / 2;
  const baseX = sideSign * (FIELD_DIMENSIONS.fieldWidth / 2 + config.xOffset);

  for (let row = 0; row < config.rowCount; row += 1) {
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const jitter = ((stableHash(`${stand}:${row}:${seat}`) % 100) / 100 - 0.5) * 0.13;
      candidates.push({
        facingRadians: sideSign > 0 ? -Math.PI / 2 : Math.PI / 2,
        stand,
        x: baseX + sideSign * row * config.rowDepth,
        y: 0.25 + row * config.rowRise,
        z: startZ + seat * config.seatSpacing + jitter,
      });
    }
  }

  return candidates;
}

function createEndZonePlacementCandidates(
  stand: 'endZoneFar' | 'endZoneNear',
  endSign: -1 | 1,
): Omit<CrowdPreviewPlacement, 'colorSeed' | 'lod' | 'scale'>[] {
  const candidates: Omit<CrowdPreviewPlacement, 'colorSeed' | 'lod' | 'scale'>[] = [];
  const config = CROWD_PREVIEW_CONFIG.endZone;
  const seatsPerRow = Math.floor(config.width / config.seatSpacing);
  const startX = -config.width / 2;
  const baseZ = endSign * (FIELD_DIMENSIONS.fieldLength / 2 + config.zOffset);

  for (let row = 0; row < config.rowCount; row += 1) {
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const jitter = ((stableHash(`${stand}:${row}:${seat}`) % 100) / 100 - 0.5) * 0.13;
      candidates.push({
        facingRadians: endSign > 0 ? Math.PI : 0,
        stand,
        x: startX + seat * config.seatSpacing + jitter,
        y: 0.25 + row * config.rowRise,
        z: baseZ + endSign * row * config.rowDepth,
      });
    }
  }

  return candidates;
}

function createSeatingShellMesh(material: THREE.Material): THREE.Mesh {
  const boxes: THREE.BufferGeometry[] = [];
  addSidelineSeatingBoxes(boxes, -1);
  addSidelineSeatingBoxes(boxes, 1);
  addEndZoneSeatingBoxes(boxes, -1);
  addEndZoneSeatingBoxes(boxes, 1);

  const geometry = mergeGeometries(boxes, false);
  for (const box of boxes) {
    box.dispose();
  }

  if (!geometry) {
    throw new Error('Unable to create crowd seating shell geometry.');
  }

  geometry.name = 'crowd-seating-shell';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'crowd-seating-shell';
  mesh.userData.crowdPreview = true;
  return mesh;
}

function addSidelineSeatingBoxes(boxes: THREE.BufferGeometry[], sideSign: -1 | 1): void {
  const config = CROWD_PREVIEW_CONFIG.sideline;
  const width = FIELD_DIMENSIONS.fieldLength + 18;
  const baseX = sideSign * (FIELD_DIMENSIONS.fieldWidth / 2 + config.xOffset - 0.4);

  for (let row = 0; row < config.rowCount; row += 1) {
    const geometry = new THREE.BoxGeometry(width, 0.12, config.rowDepth);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(
      baseX + sideSign * row * config.rowDepth,
      0.05 + row * config.rowRise,
      0,
    );
    boxes.push(geometry);
  }
}

function addEndZoneSeatingBoxes(boxes: THREE.BufferGeometry[], endSign: -1 | 1): void {
  const config = CROWD_PREVIEW_CONFIG.endZone;
  const baseZ = endSign * (FIELD_DIMENSIONS.fieldLength / 2 + config.zOffset - 0.4);

  for (let row = 0; row < config.rowCount; row += 1) {
    const geometry = new THREE.BoxGeometry(config.width, 0.12, config.rowDepth);
    geometry.translate(
      0,
      0.05 + row * config.rowRise,
      baseZ + endSign * row * config.rowDepth,
    );
    boxes.push(geometry);
  }
}

function createSharedCrowdGeometries(): {
  arm: THREE.BufferGeometry;
  farBody: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
} {
  const torso = new THREE.CylinderGeometry(0.2, 0.26, CROWD_PREVIEW_CONFIG.spectator.torsoHeight, 5, 1);
  torso.name = 'spectator-torso';
  const head = new THREE.IcosahedronGeometry(CROWD_PREVIEW_CONFIG.spectator.headRadius, 0);
  head.name = 'spectator-head';
  const arm = new THREE.CylinderGeometry(0.045, 0.055, CROWD_PREVIEW_CONFIG.spectator.armLength, 5, 1);
  arm.name = 'spectator-arm';
  const farBody = new THREE.BoxGeometry(
    CROWD_PREVIEW_CONFIG.spectator.farWidth,
    CROWD_PREVIEW_CONFIG.spectator.farHeight,
    0.28,
  );
  farBody.name = 'spectator-far-body';

  return {
    arm,
    farBody,
    head,
    torso,
  };
}

function createSharedCrowdMaterials(): {
  farBody: THREE.Material;
  seating: THREE.Material;
  skin: THREE.Material;
  uniform: THREE.Material;
} {
  return {
    farBody: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    seating: new THREE.MeshLambertMaterial({ color: 0x2a3237 }),
    skin: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    uniform: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
  };
}

function applyDetailedInstances(
  placements: readonly CrowdPreviewPlacement[],
  torsoMesh: THREE.InstancedMesh,
  headMesh: THREE.InstancedMesh,
  leftArmMesh: THREE.InstancedMesh,
  rightArmMesh: THREE.InstancedMesh,
): void {
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  placements.forEach((placement, index) => {
    const uniformColor = resolveUniformColor(placement.colorSeed);
    const skinColor = resolveSkinColor(placement.colorSeed);
    setPartMatrix(matrix, placement, 0, 0.48, 0, 0, placement.scale, 1);
    torsoMesh.setMatrixAt(index, matrix);
    torsoMesh.setColorAt(index, color.setHex(uniformColor));

    setPartMatrix(matrix, placement, 0, 0.87, 0, 0, placement.scale, 1);
    headMesh.setMatrixAt(index, matrix);
    headMesh.setColorAt(index, color.setHex(skinColor));

    setPartMatrix(matrix, placement, -0.23, 0.52, 0, 0.58, placement.scale, 0.68);
    leftArmMesh.setMatrixAt(index, matrix);
    leftArmMesh.setColorAt(index, color.setHex(uniformColor));

    setPartMatrix(matrix, placement, 0.23, 0.52, 0, -0.58, placement.scale, 0.68);
    rightArmMesh.setMatrixAt(index, matrix);
    rightArmMesh.setColorAt(index, color.setHex(uniformColor));
  });

  markInstanceAttributesDirty(torsoMesh, headMesh, leftArmMesh, rightArmMesh);
}

function applyFarInstances(
  placements: readonly CrowdPreviewPlacement[],
  farBodyMesh: THREE.InstancedMesh,
): void {
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  placements.forEach((placement, index) => {
    setPartMatrix(matrix, placement, 0, 0.45, 0, 0, placement.scale, 1);
    farBodyMesh.setMatrixAt(index, matrix);
    farBodyMesh.setColorAt(index, color.setHex(resolveUniformColor(placement.colorSeed)));
  });

  markInstanceAttributesDirty(farBodyMesh);
}

function setPartMatrix(
  matrix: THREE.Matrix4,
  placement: CrowdPreviewPlacement,
  localX: number,
  localY: number,
  localZ: number,
  localRotationZ: number,
  scale: number,
  partScale: number,
): void {
  const localOffset = new THREE.Vector3(localX * scale, localY * scale, localZ * scale);
  const worldOffset = localOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), placement.facingRadians);
  const position = new THREE.Vector3(
    placement.x + worldOffset.x,
    placement.y + worldOffset.y,
    placement.z + worldOffset.z,
  );
  const rotation = new THREE.Euler(0, placement.facingRadians, localRotationZ);
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const scaleVector = new THREE.Vector3(scale * partScale, scale * partScale, scale * partScale);

  matrix.compose(position, quaternion, scaleVector);
}

function markInstanceAttributesDirty(...meshes: THREE.InstancedMesh[]): void {
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

function applyCrowdPreviewCameraView(
  camera: THREE.PerspectiveCamera,
  view: CrowdPreviewCameraView,
): void {
  if (view === 'sideline') {
    camera.position.set(-88, 24, -8);
    camera.lookAt(0, 5, 0);
  } else if (view === 'endZone') {
    camera.position.set(0, 22, -112);
    camera.lookAt(0, 5, 0);
  } else if (view === 'close') {
    camera.position.set(-58, 9, -40);
    camera.lookAt(-42, 5, -36);
  } else {
    camera.position.set(0, 78, -146);
    camera.lookAt(0, 7, 0);
  }
}

function estimateInstanceBufferBytes(nearCount: number, farCount: number): number {
  const bytesPerInstancedPart = TRANSFORM_MATRIX_BYTES + INSTANCE_COLOR_BYTES + CUSTOM_REACTION_BYTES;

  return (
    nearCount * NEAR_MESHES_PER_SPECTATOR * bytesPerInstancedPart +
    farCount * FAR_MESHES_PER_SPECTATOR * bytesPerInstancedPart
  );
}

function countCrowdDrawCalls(group: THREE.Group): number {
  let drawCalls = 0;

  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.visible) {
      drawCalls += 1;
    }
  });

  return drawCalls;
}

function countCrowdTriangles(group: THREE.Group): number {
  let triangles = 0;

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const geometryTriangles = getGeometryTriangleCount(object.geometry);
    const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1;
    triangles += geometryTriangles * instanceCount;
  });

  return triangles;
}

function getGeometryTriangleCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }

  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}

function disposeCrowdResources(resources: CrowdResources): void {
  for (const geometry of new Set(resources.geometries)) {
    geometry.dispose();
  }

  for (const material of new Set(resources.materials)) {
    material.dispose();
  }
}

function createEmptyFrameStats(): FrameStats {
  return {
    elapsedSeconds: 0,
    frameCount: 0,
    minFps: Number.POSITIVE_INFINITY,
  };
}

function createBenchmarkReport(snapshot: CrowdPreviewSnapshot): CrowdPreviewBenchmarkReport {
  return {
    actualSpectatorCount: snapshot.actualSpectatorCount,
    averageFrameTimeMs: snapshot.averageFrameTimeMs,
    crowdDrawCalls: snapshot.crowdDrawCalls,
    crowdTriangles: snapshot.crowdTriangles,
    estimatedInstanceBufferBytes: snapshot.estimatedInstanceBufferBytes,
    frameCount: snapshot.frameCount,
    minimumObservedFps: snapshot.minimumObservedFps,
    requestedSpectatorCount: snapshot.requestedSpectatorCount,
    rendererMemory: snapshot.rendererMemory,
  };
}

function resolveUniformColor(seed: number): number {
  const colors = [0x354f7d, 0x7d3f35, 0x436946, 0x6e5c38, 0x4a4f57, 0x7a7341];
  return colors[seed % colors.length];
}

function resolveSkinColor(seed: number): number {
  const colors = [0xf1c7a1, 0xd8a176, 0xb97952, 0x8f563b, 0x6b3d2e, 0x4a2b22];
  return colors[Math.floor(seed / 7) % colors.length];
}

function formatBenchmark(snapshot: CrowdPreviewSnapshot): string {
  if (snapshot.benchmark.active) {
    return `running ${snapshot.benchmark.currentCount} reports ${snapshot.benchmark.reports.length}`;
  }

  if (snapshot.benchmark.completed) {
    return `complete reports ${snapshot.benchmark.reports.length}`;
  }

  return 'off';
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
