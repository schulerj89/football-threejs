import * as THREE from 'three';
import {
  CROWD_BENCHMARK_COUNTS as BENCHMARK_COUNTS,
  DEFAULT_BENCHMARK_DURATION_SECONDS,
  CROWD_COUNT_DEFAULT,
  clampCrowdCount as clampRequestedCrowdCount,
} from './crowd/CrowdConfiguration';
import { CrowdFrameMetrics, createPerInstanceStorageSnapshot } from './crowd/CrowdMetrics';
import { CrowdResourceOwner } from './crowd/CrowdResourceOwner';
import type {
  CrowdPreviewBenchmarkReport,
  CrowdPreviewCameraView,
  CrowdPreviewControllerOptions,
  CrowdPreviewSnapshot,
} from './crowd/CrowdTypes';

export type {
  CrowdPerInstanceStorageSnapshot,
  CrowdPreviewBenchmarkReport,
  CrowdPreviewCameraView,
  CrowdPreviewControllerOptions,
  CrowdPreviewPlacement,
  CrowdPreviewSnapshot,
  CrowdRendererMemorySnapshot,
  CrowdRendererRenderSnapshot,
  CrowdResources,
} from './crowd/CrowdTypes';
export {
  CROWD_BENCHMARK_COUNTS,
  clampCrowdCount,
  resolveCrowdBenchmarkDurationSeconds,
} from './crowd/CrowdConfiguration';
export { createCrowdPlacements, stableHash } from './crowd/CrowdLayout';
export {
  applyDetailedInstances,
  applyFarInstances,
  createCrowdResources,
  markInstanceAttributesDirty,
  resolveSkinColor,
  resolveUniformColor,
  setPartMatrix,
} from './crowd/CrowdMeshFactory';
export {
  countCrowdDrawCalls,
  countCrowdTriangles,
  estimateInstanceBufferBytes,
} from './crowd/CrowdMetrics';
export { disposeCrowdResources } from './crowd/CrowdResourceOwner';

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
  private readonly frameMetrics = new CrowdFrameMetrics();
  private height: number;
  private requestedCount: number;
  private readonly resourceOwner: CrowdResourceOwner;
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
    this.requestedCount = benchmarkEnabled ? BENCHMARK_COUNTS[0] : clampRequestedCrowdCount(requestedCount);
    this.resourceOwner = new CrowdResourceOwner(this.requestedCount, 'crowd-preview');
    this.group.add(this.resourceOwner.group);
    this.resize(width, height);

    if (benchmarkEnabled) {
      this.benchmarkActive = true;
    }
  }

  dispose(): void {
    this.resourceOwner.dispose();
  }

  setCameraView(view: CrowdPreviewCameraView): void {
    this.cameraView = view;
    applyCrowdPreviewCameraView(this.camera, view);
  }

  setCount(requestedCount: number): void {
    this.group.remove(this.resourceOwner.group);
    this.requestedCount = clampRequestedCrowdCount(requestedCount);
    const resources = this.resourceOwner.rebuild(this.requestedCount, 'crowd-preview');
    this.group.add(resources.group);
    this.frameMetrics.reset();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    applyCrowdPreviewCameraView(this.camera, this.cameraView);
  }

  updateBeforeRender(): void {
    if (!this.benchmarkActive || this.benchmarkElapsedSeconds < this.benchmarkDurationSeconds) {
      return;
    }

    this.benchmarkReports.push(createBenchmarkReport(this.getSnapshot()));
    this.benchmarkIndex += 1;
    this.benchmarkElapsedSeconds = 0;

    if (this.benchmarkIndex >= BENCHMARK_COUNTS.length) {
      this.benchmarkActive = false;
      this.benchmarkCompleted = true;
      console.info('Crowd benchmark report', JSON.stringify(this.benchmarkReports));
      return;
    }

    this.setCount(BENCHMARK_COUNTS[this.benchmarkIndex]);
  }

  recordFrame(deltaSeconds: number, renderer: THREE.WebGLRenderer): void {
    this.frameMetrics.recordFrame(deltaSeconds, renderer);

    if (this.benchmarkActive) {
      this.benchmarkElapsedSeconds += Math.max(0, Math.min(deltaSeconds, 0.25));
    }
  }

  getSnapshot(): CrowdPreviewSnapshot {
    const base = this.resourceOwner.resources.snapshotBase;
    const frame = this.frameMetrics.getSnapshot();

    return {
      ...base,
      averageFrameTimeMs: frame.averageFrameTimeMs,
      benchmark: {
        active: this.benchmarkActive,
        completed: this.benchmarkCompleted,
        currentCount: this.benchmarkActive ? this.requestedCount : null,
        reports: this.benchmarkReports.map((report) => ({ ...report })),
      },
      cameraView: this.cameraView,
      frameCount: frame.frameCount,
      gameplayPlayerCount: 0,
      minimumObservedFps: frame.minimumObservedFps,
      perInstanceStorage: createPerInstanceStorageSnapshot(),
      requestedSpectatorCount: this.requestedCount,
      rendererMemory: frame.rendererMemory,
      rendererRender: frame.rendererRender,
    };
  }
}

export function resolveCrowdPreviewEnabled(searchParams: URLSearchParams): boolean {
  return searchParams.get('crowdPreview') === '1';
}

export function resolveCrowdPreviewCount(searchParams: URLSearchParams): number {
  return clampRequestedCrowdCount(Number(searchParams.get('crowdCount') ?? CROWD_COUNT_DEFAULT));
}

export function resolveCrowdPreviewCameraView(value: string | null): CrowdPreviewCameraView {
  if (value === 'sideline' || value === 'endZone' || value === 'close') {
    return value;
  }

  return 'wide';
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

function formatBenchmark(snapshot: CrowdPreviewSnapshot): string {
  if (snapshot.benchmark.active) {
    return `running ${snapshot.benchmark.currentCount} reports ${snapshot.benchmark.reports.length}`;
  }

  if (snapshot.benchmark.completed) {
    return `complete reports ${snapshot.benchmark.reports.length}`;
  }

  return 'off';
}
