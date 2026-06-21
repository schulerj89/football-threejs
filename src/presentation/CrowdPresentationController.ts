import * as THREE from 'three';
import type {
  PresentationAudioEvent,
  PresentationAudioEventType,
} from '../audio/PresentationEventBridge';
import type { StorageLike } from '../audio/AudioSettings';
import {
  CROWD_BENCHMARK_COUNTS,
  type CrowdPreviewPlacement,
  type CrowdResources,
  countCrowdDrawCalls,
  countCrowdTriangles,
  createCrowdResources,
  disposeCrowdResources,
  markInstanceAttributesDirty,
  setPartMatrix,
  stableHash,
} from '../crowdPreview';
import type { GameplaySnapshot } from '../playState';

export type CrowdDensity = 'high' | 'low' | 'medium';

export type CrowdReactionState =
  | 'anticipation'
  | 'disappointment'
  | 'firstDown'
  | 'idle'
  | 'touchdown';

export interface CrowdPresentationSettings {
  crowdDensity: CrowdDensity;
  crowdReactionsEnabled: boolean;
  crowdVisualsEnabled: boolean;
}

export interface CrowdReactionHistoryEntry {
  eventId: string;
  eventType: PresentationAudioEventType;
  reason:
    | 'crowdReactionsDisabled'
    | 'duplicateEvent'
    | 'pageHidden'
    | 'supersededByTouchdown'
    | 'unsupportedEvent'
    | null;
  state: CrowdReactionState | null;
  status: 'started' | 'suppressed';
}

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

interface ActiveCrowdReaction {
  durationSeconds: number;
  elapsedSeconds: number;
  eventId: string;
  participantRatio: number;
  state: Exclude<CrowdReactionState, 'anticipation' | 'idle'>;
}

interface FrameStats {
  elapsedSeconds: number;
  frameCount: number;
  minFps: number;
}

const CROWD_PRESENTATION_STORAGE_KEY = 'football-threejs.crowdPresentationSettings.v1';

export const CROWD_DENSITY_PRESETS: Record<CrowdDensity, number> = {
  high: CROWD_BENCHMARK_COUNTS[2],
  low: CROWD_BENCHMARK_COUNTS[0],
  medium: CROWD_BENCHMARK_COUNTS[1],
} as const;

export const DEFAULT_CROWD_PRESENTATION_SETTINGS: CrowdPresentationSettings = {
  crowdDensity: 'low',
  crowdReactionsEnabled: true,
  crowdVisualsEnabled: false,
};

const CROWD_PRESENTATION_CONFIG = {
  disappointmentDurationSeconds: 2.1,
  disappointmentParticipantRatio: 0.42,
  firstDownDurationSeconds: 1.6,
  firstDownParticipantRatio: 0.34,
  maxDeltaSeconds: 0.1,
  reactionHistoryLimit: 20,
  reactionUpdateHz: 12,
  touchdownDurationSeconds: 3.5,
  touchdownParticipantRatio: 0.78,
} as const;

const TRANSFORM_MATRIX_BYTES = 16 * Float32Array.BYTES_PER_ELEMENT;
const INSTANCE_COLOR_BYTES = 3 * Float32Array.BYTES_PER_ELEMENT;
const CUSTOM_REACTION_BYTES = 0;
const NEAR_MESHES_PER_SPECTATOR = 4;
const FAR_MESHES_PER_SPECTATOR = 1;

const REACTION_EVENT_PRIORITIES: Partial<Record<PresentationAudioEventType, number>> = {
  firstDown: 2,
  incomplete: 1,
  outOfBounds: 1,
  sack: 1,
  touchdown: 4,
  turnoverOnDowns: 3,
};

export class CrowdPresentationController {
  readonly group: THREE.Group;

  private activeReaction: ActiveCrowdReaction | null = null;
  private readonly clock = new THREE.Clock(false);
  private frameStats: FrameStats = createEmptyFrameStats();
  private lastRendererMemory = { geometries: 0, textures: 0 };
  private lastRendererRender = { calls: 0, triangles: 0 };
  private lastRenderedState: CrowdReactionState | null = null;
  private matrixUpdateAccumulatorSeconds = 0;
  private pageActive = true;
  private processedEventIds = new Set<string>();
  private readonly reactionHistory: CrowdReactionHistoryEntry[] = [];
  private reactionTimeSeconds = 0;
  private reactionUpdateCount = 0;
  private readonly resources: CrowdResources;
  private readonly settings: CrowdPresentationSettings;
  private readonly scratchMatrix = new THREE.Matrix4();

  constructor({ settings }: CrowdPresentationControllerOptions) {
    this.settings = normalizeCrowdPresentationSettings(settings);
    this.resources = createCrowdResources(CROWD_DENSITY_PRESETS[this.settings.crowdDensity]);
    this.resources.group.name = 'crowd-presentation';
    this.group = this.resources.group;
    this.group.userData.crowdPresentation = true;
    this.enableDynamicInstanceMatrices();
    this.clock.start();
  }

  dispose(): void {
    disposeCrowdResources(this.resources);
  }

  setPageActive(active: boolean): void {
    this.pageActive = active;
  }

  skipReactionHold(): boolean {
    if (!this.activeReaction) {
      return false;
    }

    this.activeReaction = null;
    this.renderReactionState('idle', null);
    return true;
  }

  update(
    snapshot: GameplaySnapshot,
    events: readonly PresentationAudioEvent[],
    deltaSeconds: number,
  ): void {
    const delta = Math.min(
      CROWD_PRESENTATION_CONFIG.maxDeltaSeconds,
      Math.max(0, deltaSeconds),
    );

    this.processEvents(events);
    this.reactionTimeSeconds += delta;

    if (this.activeReaction) {
      this.activeReaction.elapsedSeconds += delta;
      if (this.activeReaction.elapsedSeconds >= this.activeReaction.durationSeconds) {
        this.activeReaction = null;
      }
    }

    const state = this.resolveDisplayState(snapshot);

    if (!this.pageActive) {
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
      this.activeReaction !== null;

    if (shouldUpdate && this.matrixUpdateAccumulatorSeconds >= updateIntervalSeconds) {
      this.matrixUpdateAccumulatorSeconds %= updateIntervalSeconds;
      this.renderReactionState(state, this.activeReaction);
    }
  }

  recordFrame(deltaSeconds: number, renderer: THREE.WebGLRenderer): void {
    const clampedDelta = Math.max(0, Math.min(deltaSeconds, 0.25));
    this.frameStats.frameCount += 1;
    this.frameStats.elapsedSeconds += clampedDelta;

    if (clampedDelta > 0) {
      this.frameStats.minFps = Math.min(this.frameStats.minFps, 1 / clampedDelta);
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

  getSnapshot(): CrowdPresentationSnapshot {
    const base = this.resources.snapshotBase;
    const averageFrameTimeMs = this.frameStats.frameCount > 0
      ? (this.frameStats.elapsedSeconds / this.frameStats.frameCount) * 1000
      : 0;
    const minimumObservedFps = Number.isFinite(this.frameStats.minFps)
      ? this.frameStats.minFps
      : 0;

    return {
      actualSpectatorCount: base.actualSpectatorCount,
      averageFrameTimeMs,
      crowdDrawCalls: countCrowdDrawCalls(this.group),
      crowdTriangles: countCrowdTriangles(this.group),
      density: this.settings.crowdDensity,
      deterministicSubsets: true,
      estimatedInstanceBufferBytes: base.estimatedInstanceBufferBytes,
      farInstanceCount: base.farInstanceCount,
      frameCount: this.frameStats.frameCount,
      geometryCount: base.geometryCount,
      materialCount: base.materialCount,
      minimumObservedFps,
      nearInstanceCount: base.nearInstanceCount,
      noPerSpectatorObject3D: true,
      pageActive: this.pageActive,
      perInstanceStorage: {
        colorBytes: INSTANCE_COLOR_BYTES,
        customReactionDataBytes: CUSTOM_REACTION_BYTES,
        farMeshesPerSpectator: FAR_MESHES_PER_SPECTATOR,
        nearMeshesPerSpectator: NEAR_MESHES_PER_SPECTATOR,
        transformMatrixBytes: TRANSFORM_MATRIX_BYTES,
      },
      reactionHistory: this.reactionHistory.map((entry) => ({ ...entry })),
      reactionState: this.lastRenderedState ?? 'idle',
      reactionUpdateCount: this.reactionUpdateCount,
      reactionUpdateHz: CROWD_PRESENTATION_CONFIG.reactionUpdateHz,
      reactionsEnabled: this.settings.crowdReactionsEnabled,
      rendererMemory: { ...this.lastRendererMemory },
      rendererRender: { ...this.lastRendererRender },
      requestedSpectatorCount: CROWD_DENSITY_PRESETS[this.settings.crowdDensity],
      settings: { ...this.settings },
      textureCount: base.textureCount,
      visualsEnabled: this.settings.crowdVisualsEnabled,
    };
  }

  private enableDynamicInstanceMatrices(): void {
    const meshes = [
      this.resources.detailedTorso,
      this.resources.detailedHead,
      this.resources.detailedArmLeft,
      this.resources.detailedArmRight,
      this.resources.farBody,
    ];

    for (const mesh of meshes) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }

  private processEvents(events: readonly PresentationAudioEvent[]): void {
    const event = selectHighestPriorityReactionEvent(events);

    if (!event) {
      return;
    }

    if (this.processedEventIds.has(event.id)) {
      this.recordHistory(event, null, 'suppressed', 'duplicateEvent');
      return;
    }

    this.processedEventIds.add(event.id);

    if (!this.pageActive) {
      this.recordHistory(event, null, 'suppressed', 'pageHidden');
      return;
    }

    if (!this.settings.crowdReactionsEnabled) {
      this.recordHistory(event, null, 'suppressed', 'crowdReactionsDisabled');
      return;
    }

    const reaction = createReactionForEvent(event);

    if (!reaction) {
      this.recordHistory(event, null, 'suppressed', 'unsupportedEvent');
      return;
    }

    if (
      event.type === 'touchdown' &&
      this.activeReaction?.state === 'firstDown'
    ) {
      this.recordHistory(event, this.activeReaction.state, 'suppressed', 'supersededByTouchdown');
    }

    this.activeReaction = reaction;
    this.recordHistory(event, reaction.state, 'started', null);
  }

  private resolveDisplayState(snapshot: GameplaySnapshot): CrowdReactionState {
    if (this.activeReaction) {
      return this.activeReaction.state;
    }

    return snapshot.playState === 'live' ? 'anticipation' : 'idle';
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

    this.resources.nearPlacements.forEach((placement, index) => {
      const pose = calculateCrowdPose({
        activeReaction,
        index,
        placement,
        state,
        timeSeconds: this.reactionTimeSeconds,
      });

      setPartMatrix(matrix, placement, 0, 0.48 + pose.verticalOffset, 0, pose.torsoLean, placement.scale, 1);
      this.resources.detailedTorso.setMatrixAt(index, matrix);

      setPartMatrix(matrix, placement, 0, 0.87 + pose.verticalOffset, 0, pose.headTilt, placement.scale, 1);
      this.resources.detailedHead.setMatrixAt(index, matrix);

      setPartMatrix(
        matrix,
        placement,
        -0.23,
        0.52 + pose.verticalOffset,
        0,
        0.58 + pose.leftArmLift,
        placement.scale,
        0.68,
      );
      this.resources.detailedArmLeft.setMatrixAt(index, matrix);

      setPartMatrix(
        matrix,
        placement,
        0.23,
        0.52 + pose.verticalOffset,
        0,
        -0.58 - pose.rightArmLift,
        placement.scale,
        0.68,
      );
      this.resources.detailedArmRight.setMatrixAt(index, matrix);
    });

    markInstanceAttributesDirty(
      this.resources.detailedTorso,
      this.resources.detailedHead,
      this.resources.detailedArmLeft,
      this.resources.detailedArmRight,
    );
  }

  private applyFarInstances(
    state: CrowdReactionState,
    activeReaction: ActiveCrowdReaction | null,
  ): void {
    const matrix = this.scratchMatrix;

    this.resources.farPlacements.forEach((placement, index) => {
      const pose = calculateCrowdPose({
        activeReaction,
        index: index + this.resources.nearPlacements.length,
        placement,
        state,
        timeSeconds: this.reactionTimeSeconds,
      });
      setPartMatrix(matrix, placement, 0, 0.45 + pose.verticalOffset * 0.75, 0, 0, placement.scale, 1);
      this.resources.farBody.setMatrixAt(index, matrix);
    });

    markInstanceAttributesDirty(this.resources.farBody);
  }

  private recordHistory(
    event: PresentationAudioEvent,
    state: CrowdReactionState | null,
    status: CrowdReactionHistoryEntry['status'],
    reason: CrowdReactionHistoryEntry['reason'],
  ): void {
    this.reactionHistory.unshift({
      eventId: event.id,
      eventType: event.type,
      reason,
      state,
      status,
    });
    this.reactionHistory.splice(CROWD_PRESENTATION_CONFIG.reactionHistoryLimit);
  }
}

export function loadCrowdPresentationSettings(
  storage = getLocalStorage(),
): CrowdPresentationSettings {
  if (!storage) {
    return { ...DEFAULT_CROWD_PRESENTATION_SETTINGS };
  }

  const stored = storage.getItem(CROWD_PRESENTATION_STORAGE_KEY);

  if (!stored) {
    return { ...DEFAULT_CROWD_PRESENTATION_SETTINGS };
  }

  try {
    return normalizeCrowdPresentationSettings(JSON.parse(stored) as Partial<CrowdPresentationSettings>);
  } catch {
    return { ...DEFAULT_CROWD_PRESENTATION_SETTINGS };
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
    JSON.stringify(normalizeCrowdPresentationSettings(settings)),
  );
}

export function applyCrowdPresentationQuerySettings(
  settings: CrowdPresentationSettings,
  searchParams: URLSearchParams,
): CrowdPresentationSettings {
  const crowdVisualsQuery = searchParams.get('crowdVisuals');
  const crowdReactionsQuery = searchParams.get('crowdReactions');
  const densityQuery = searchParams.get('crowdDensity');

  return normalizeCrowdPresentationSettings({
    ...settings,
    crowdDensity: isCrowdDensity(densityQuery) ? densityQuery : settings.crowdDensity,
    crowdReactionsEnabled:
      crowdReactionsQuery === '0'
        ? false
        : crowdReactionsQuery === '1'
          ? true
          : settings.crowdReactionsEnabled,
    crowdVisualsEnabled:
      crowdVisualsQuery === '0'
        ? false
        : crowdVisualsQuery === '1'
          ? true
          : settings.crowdVisualsEnabled,
  });
}

export function normalizeCrowdPresentationSettings(
  settings: Partial<CrowdPresentationSettings>,
): CrowdPresentationSettings {
  return {
    crowdDensity: isCrowdDensity(settings.crowdDensity)
      ? settings.crowdDensity
      : DEFAULT_CROWD_PRESENTATION_SETTINGS.crowdDensity,
    crowdReactionsEnabled:
      settings.crowdReactionsEnabled ??
      DEFAULT_CROWD_PRESENTATION_SETTINGS.crowdReactionsEnabled,
    crowdVisualsEnabled:
      settings.crowdVisualsEnabled ??
      DEFAULT_CROWD_PRESENTATION_SETTINGS.crowdVisualsEnabled,
  };
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

function createReactionForEvent(event: PresentationAudioEvent): ActiveCrowdReaction | null {
  if (event.type === 'firstDown') {
    return {
      durationSeconds: CROWD_PRESENTATION_CONFIG.firstDownDurationSeconds,
      elapsedSeconds: 0,
      eventId: event.id,
      participantRatio: CROWD_PRESENTATION_CONFIG.firstDownParticipantRatio,
      state: 'firstDown',
    };
  }

  if (event.type === 'touchdown') {
    return {
      durationSeconds: CROWD_PRESENTATION_CONFIG.touchdownDurationSeconds,
      elapsedSeconds: 0,
      eventId: event.id,
      participantRatio: CROWD_PRESENTATION_CONFIG.touchdownParticipantRatio,
      state: 'touchdown',
    };
  }

  if (
    event.type === 'incomplete' ||
    event.type === 'outOfBounds' ||
    event.type === 'sack' ||
    event.type === 'turnoverOnDowns'
  ) {
    return {
      durationSeconds: CROWD_PRESENTATION_CONFIG.disappointmentDurationSeconds,
      elapsedSeconds: 0,
      eventId: event.id,
      participantRatio: CROWD_PRESENTATION_CONFIG.disappointmentParticipantRatio,
      state: 'disappointment',
    };
  }

  return null;
}

function selectHighestPriorityReactionEvent(
  events: readonly PresentationAudioEvent[],
): PresentationAudioEvent | null {
  let selected: PresentationAudioEvent | null = null;
  let selectedPriority = 0;

  for (const event of events) {
    const priority = REACTION_EVENT_PRIORITIES[event.type] ?? 0;
    if (priority > selectedPriority) {
      selected = event;
      selectedPriority = priority;
    }
  }

  return selected;
}

function calculateCrowdPose(options: {
  activeReaction: ActiveCrowdReaction | null;
  index: number;
  placement: CrowdPreviewPlacement;
  state: CrowdReactionState;
  timeSeconds: number;
}): {
  headTilt: number;
  leftArmLift: number;
  rightArmLift: number;
  torsoLean: number;
  verticalOffset: number;
} {
  const participant = isReactionParticipant(options);
  const phase = hashToUnit(`${options.placement.colorSeed}:${options.index}:phase`) * Math.PI * 2;

  if (!participant || options.state === 'idle') {
    return {
      headTilt: 0,
      leftArmLift: 0,
      rightArmLift: 0,
      torsoLean: 0,
      verticalOffset: 0,
    };
  }

  const wave = Math.sin(options.timeSeconds * reactionFrequency(options.state) + phase);
  const envelope = calculateReactionEnvelope(options.activeReaction);

  if (options.state === 'anticipation') {
    return {
      headTilt: 0.03 * wave,
      leftArmLift: 0.08 * wave,
      rightArmLift: -0.08 * wave,
      torsoLean: 0.02 * wave,
      verticalOffset: 0.018 * wave,
    };
  }

  if (options.state === 'disappointment') {
    return {
      headTilt: -0.12 * envelope,
      leftArmLift: -0.18 * envelope,
      rightArmLift: -0.18 * envelope,
      torsoLean: -0.04 * envelope,
      verticalOffset: -0.012 * envelope,
    };
  }

  const touchdownScale = options.state === 'touchdown' ? 1.45 : 1;
  const alternatingWave = Math.max(0, wave);

  return {
    headTilt: 0.08 * wave * envelope,
    leftArmLift: 0.55 * touchdownScale * envelope * (0.65 + alternatingWave * 0.35),
    rightArmLift: 0.5 * touchdownScale * envelope * (0.65 + Math.max(0, -wave) * 0.35),
    torsoLean: 0.045 * wave * envelope,
    verticalOffset: 0.07 * touchdownScale * alternatingWave * envelope,
  };
}

function isReactionParticipant(options: {
  activeReaction: ActiveCrowdReaction | null;
  index: number;
  placement: CrowdPreviewPlacement;
  state: CrowdReactionState;
}): boolean {
  if (options.state === 'anticipation') {
    return hashToUnit(`anticipation:${options.placement.colorSeed}:${options.index}`) < 0.22;
  }

  if (!options.activeReaction) {
    return false;
  }

  return hashToUnit(`${options.activeReaction.eventId}:${options.index}`) < options.activeReaction.participantRatio;
}

function calculateReactionEnvelope(activeReaction: ActiveCrowdReaction | null): number {
  if (!activeReaction) {
    return 1;
  }

  const progress = activeReaction.elapsedSeconds / Math.max(0.001, activeReaction.durationSeconds);
  return Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
}

function reactionFrequency(state: CrowdReactionState): number {
  if (state === 'touchdown') {
    return 18;
  }

  if (state === 'firstDown') {
    return 13;
  }

  return 6;
}

function isCrowdDensity(value: unknown): value is CrowdDensity {
  return value === 'low' || value === 'medium' || value === 'high';
}

function hashToUnit(value: string): number {
  return (stableHash(value) % 10_000) / 10_000;
}

function createEmptyFrameStats(): FrameStats {
  return {
    elapsedSeconds: 0,
    frameCount: 0,
    minFps: Number.POSITIVE_INFINITY,
  };
}

function getLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
