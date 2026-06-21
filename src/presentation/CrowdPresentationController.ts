import * as THREE from 'three';
import type { PresentationAudioEvent } from '../audio/PresentationEventBridge';
import type { StorageLike } from '../audio/AudioSettings';
import { CrowdFrameMetrics, countCrowdDrawCalls, countCrowdTriangles, createPerInstanceStorageSnapshot } from '../crowd/CrowdMetrics';
import { markInstanceAttributesDirty, setPartMatrix } from '../crowd/CrowdMeshFactory';
import {
  CROWD_DENSITY_PRESETS as DENSITY_PRESETS,
  CROWD_PRESENTATION_CONFIG,
  CrowdReactionSequencer,
  DEFAULT_CROWD_PRESENTATION_SETTINGS as DEFAULT_SETTINGS,
  calculateCrowdPose,
  normalizeCrowdPresentationSettings as normalizeSettings,
} from '../crowd/CrowdReactionModel';
import { CrowdResourceOwner } from '../crowd/CrowdResourceOwner';
import type {
  ActiveCrowdReaction,
  CrowdDensity,
  CrowdPresentationSettings,
  CrowdReactionHistoryEntry,
  CrowdReactionState,
} from '../crowd/CrowdReactionModel';
import type { GameplaySnapshot } from '../playState';
import type { FramePerformanceProfiler } from '../performance/FramePerformanceProfiler';

export type {
  CrowdDensity,
  CrowdPresentationSettings,
  CrowdReactionHistoryEntry,
  CrowdReactionState,
} from '../crowd/CrowdReactionModel';
export {
  CROWD_DENSITY_PRESETS,
  DEFAULT_CROWD_PRESENTATION_SETTINGS,
  applyCrowdPresentationQuerySettings,
  normalizeCrowdPresentationSettings,
} from '../crowd/CrowdReactionModel';

export interface CrowdPresentationSnapshot {
  actualSpectatorCount: number;
  averageFrameTimeMs: number;
  crowdDrawCalls: number;
  crowdTriangles: number;
  density: CrowdDensity;
  deterministicSubsets: boolean;
  estimatedInstanceBufferBytes: number;
  farInstanceCount: number;
  frameCount: number;
  geometryCount: number;
  materialCount: number;
  minimumObservedFps: number;
  nearInstanceCount: number;
  noPerSpectatorObject3D: boolean;
  pageActive: boolean;
  perInstanceStorage: {
    colorBytes: number;
    customReactionDataBytes: number;
    farMeshesPerSpectator: number;
    nearMeshesPerSpectator: number;
    transformMatrixBytes: number;
  };
  reactionHistory: CrowdReactionHistoryEntry[];
  reactionState: CrowdReactionState;
  reactionUpdateCount: number;
  reactionUpdateHz: number;
  reactionsEnabled: boolean;
  rendererMemory: {
    geometries: number;
    textures: number;
  };
  rendererRender: {
    calls: number;
    triangles: number;
  };
  requestedSpectatorCount: number;
  settings: CrowdPresentationSettings;
  textureCount: number;
  visualsEnabled: boolean;
}

interface CrowdPresentationControllerOptions {
  settings: CrowdPresentationSettings;
}

const CROWD_PRESENTATION_STORAGE_KEY = 'football-threejs.crowdPresentationSettings.v1';

export class CrowdPresentationController {
  readonly group: THREE.Group;

  private readonly clock = new THREE.Clock(false);
  private readonly frameMetrics = new CrowdFrameMetrics();
  private lastRenderedState: CrowdReactionState | null = null;
  private matrixUpdateAccumulatorSeconds = 0;
  private readonly reactionSequencer = new CrowdReactionSequencer();
  private reactionTimeSeconds = 0;
  private reactionUpdateCount = 0;
  private readonly resourceOwner: CrowdResourceOwner;
  private readonly settings: CrowdPresentationSettings;
  private readonly scratchMatrix = new THREE.Matrix4();

  constructor({ settings }: CrowdPresentationControllerOptions) {
    this.settings = normalizeSettings(settings);
    this.resourceOwner = new CrowdResourceOwner(DENSITY_PRESETS[this.settings.crowdDensity], 'crowd-presentation');
    this.resourceOwner.enableDynamicInstanceMatrices();
    this.group = this.resourceOwner.group;
    this.group.userData.crowdPresentation = true;
    this.clock.start();
  }

  dispose(): void {
    this.resourceOwner.dispose();
  }

  setPageActive(active: boolean): void {
    this.reactionSequencer.setPageActive(active);
  }

  skipReactionHold(): boolean {
    if (!this.reactionSequencer.skipReactionHold()) {
      return false;
    }

    this.renderReactionState('idle', null);
    return true;
  }

  update(
    snapshot: GameplaySnapshot,
    events: readonly PresentationAudioEvent[],
    deltaSeconds: number,
    profiler?: FramePerformanceProfiler,
  ): void {
    const delta = Math.min(
      CROWD_PRESENTATION_CONFIG.maxDeltaSeconds,
      Math.max(0, deltaSeconds),
    );

    this.reactionSequencer.processEvents(events, this.settings.crowdReactionsEnabled);
    this.reactionTimeSeconds += delta;
    this.reactionSequencer.advance(delta);

    const state = this.reactionSequencer.resolveDisplayState(snapshot.playState);

    if (!this.reactionSequencer.isPageActive) {
      this.lastRenderedState = state;
      return;
    }

    if (!this.settings.crowdReactionsEnabled && state !== 'idle') {
      this.renderReactionState('idle', null);
      return;
    }

    this.matrixUpdateAccumulatorSeconds += delta;
    const updateIntervalSeconds = 1 / CROWD_PRESENTATION_CONFIG.reactionUpdateHz;
    const shouldUpdate =
      state !== this.lastRenderedState ||
      state === 'anticipation' ||
      this.reactionSequencer.active !== null;

    if (shouldUpdate && this.matrixUpdateAccumulatorSeconds >= updateIntervalSeconds) {
      this.matrixUpdateAccumulatorSeconds %= updateIntervalSeconds;
      if (profiler?.enabled) {
        profiler.measure('crowdInstanceUpdates', () => {
          this.renderReactionState(state, this.reactionSequencer.active);
        });
      } else {
        this.renderReactionState(state, this.reactionSequencer.active);
      }
    }
  }

  recordFrame(deltaSeconds: number, renderer: THREE.WebGLRenderer): void {
    this.frameMetrics.recordFrame(deltaSeconds, renderer);
  }

  getSnapshot(): CrowdPresentationSnapshot {
    const base = this.resourceOwner.resources.snapshotBase;
    const frame = this.frameMetrics.getSnapshot();

    return {
      actualSpectatorCount: base.actualSpectatorCount,
      averageFrameTimeMs: frame.averageFrameTimeMs,
      crowdDrawCalls: countCrowdDrawCalls(this.group),
      crowdTriangles: countCrowdTriangles(this.group),
      density: this.settings.crowdDensity,
      deterministicSubsets: true,
      estimatedInstanceBufferBytes: base.estimatedInstanceBufferBytes,
      farInstanceCount: base.farInstanceCount,
      frameCount: frame.frameCount,
      geometryCount: base.geometryCount,
      materialCount: base.materialCount,
      minimumObservedFps: frame.minimumObservedFps,
      nearInstanceCount: base.nearInstanceCount,
      noPerSpectatorObject3D: true,
      pageActive: this.reactionSequencer.isPageActive,
      perInstanceStorage: createPerInstanceStorageSnapshot(),
      reactionHistory: this.reactionSequencer.getHistory(),
      reactionState: this.lastRenderedState ?? 'idle',
      reactionUpdateCount: this.reactionUpdateCount,
      reactionUpdateHz: CROWD_PRESENTATION_CONFIG.reactionUpdateHz,
      reactionsEnabled: this.settings.crowdReactionsEnabled,
      rendererMemory: frame.rendererMemory,
      rendererRender: frame.rendererRender,
      requestedSpectatorCount: DENSITY_PRESETS[this.settings.crowdDensity],
      settings: { ...this.settings },
      textureCount: base.textureCount,
      visualsEnabled: this.settings.crowdVisualsEnabled,
    };
  }

  private renderReactionState(
    state: CrowdReactionState,
    activeReaction: ActiveCrowdReaction | null,
  ): void {
    this.applyNearInstances(state, activeReaction);
    this.applyFarInstances(state, activeReaction);
    this.lastRenderedState = state;
    this.reactionUpdateCount += 1;
  }

  private applyNearInstances(
    state: CrowdReactionState,
    activeReaction: ActiveCrowdReaction | null,
  ): void {
    const matrix = this.scratchMatrix;
    const resources = this.resourceOwner.resources;

    resources.nearPlacements.forEach((placement, index) => {
      const pose = calculateCrowdPose({
        activeReaction,
        index,
        placement,
        state,
        timeSeconds: this.reactionTimeSeconds,
      });

      setPartMatrix(matrix, placement, 0, 0.48 + pose.verticalOffset, 0, pose.torsoLean, placement.scale, 1);
      resources.detailedTorso.setMatrixAt(index, matrix);

      setPartMatrix(matrix, placement, 0, 0.87 + pose.verticalOffset, 0, pose.headTilt, placement.scale, 1);
      resources.detailedHead.setMatrixAt(index, matrix);

      setPartMatrix(matrix, placement, -0.23, 0.52 + pose.verticalOffset, 0, 0.58 + pose.leftArmLift, placement.scale, 0.68);
      resources.detailedArmLeft.setMatrixAt(index, matrix);

      setPartMatrix(matrix, placement, 0.23, 0.52 + pose.verticalOffset, 0, -0.58 - pose.rightArmLift, placement.scale, 0.68);
      resources.detailedArmRight.setMatrixAt(index, matrix);
    });

    markInstanceAttributesDirty(
      resources.detailedTorso,
      resources.detailedHead,
      resources.detailedArmLeft,
      resources.detailedArmRight,
    );
  }

  private applyFarInstances(
    state: CrowdReactionState,
    activeReaction: ActiveCrowdReaction | null,
  ): void {
    const matrix = this.scratchMatrix;
    const resources = this.resourceOwner.resources;

    resources.farPlacements.forEach((placement, index) => {
      const pose = calculateCrowdPose({
        activeReaction,
        index: index + resources.nearPlacements.length,
        placement,
        state,
        timeSeconds: this.reactionTimeSeconds,
      });
      setPartMatrix(matrix, placement, 0, 0.45 + pose.verticalOffset * 0.75, 0, 0, placement.scale, 1);
      resources.farBody.setMatrixAt(index, matrix);
    });

    markInstanceAttributesDirty(resources.farBody);
  }
}

export function loadCrowdPresentationSettings(
  storage = getLocalStorage(),
): CrowdPresentationSettings {
  if (!storage) {
    return { ...DEFAULT_SETTINGS };
  }

  const stored = storage.getItem(CROWD_PRESENTATION_STORAGE_KEY);

  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    return normalizeSettings(JSON.parse(stored) as Partial<CrowdPresentationSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveCrowdPresentationSettings(
  settings: CrowdPresentationSettings,
  storage = getLocalStorage(),
): void {
  if (!storage) {
    return;
  }

  storage.setItem(
    CROWD_PRESENTATION_STORAGE_KEY,
    JSON.stringify(normalizeSettings(settings)),
  );
}

export function createCrowdPresentationOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'crowd-presentation-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncCrowdPresentationOverlay(
  element: HTMLElement,
  snapshot: CrowdPresentationSnapshot,
): void {
  element.textContent = [
    'CROWD PRESENTATION',
    `VISUALS ${snapshot.visualsEnabled ? 'on' : 'off'} density ${snapshot.density} count ${snapshot.actualSpectatorCount}`,
    `REACTIONS ${snapshot.reactionsEnabled ? 'on' : 'off'} state ${snapshot.reactionState}`,
    `UPDATES ${snapshot.reactionUpdateCount} @ ${snapshot.reactionUpdateHz}hz`,
    `CALLS ${snapshot.crowdDrawCalls} TRIS ${snapshot.crowdTriangles}`,
    `GEOMS ${snapshot.geometryCount} MATS ${snapshot.materialCount} TEX ${snapshot.textureCount}`,
    `FRAME_MS ${snapshot.averageFrameTimeMs.toFixed(2)} MIN_FPS ${snapshot.minimumObservedFps.toFixed(1)}`,
    `AUDIO_SYNC ${snapshot.reactionHistory[0]?.eventType ?? 'none'} ${snapshot.reactionHistory[0]?.status ?? ''}`,
  ].join('\n');
}

function getLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
