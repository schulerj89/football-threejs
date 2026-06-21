import * as THREE from 'three';
import type { GameplaySnapshot, PlayState } from '../playState';
import type { PlayerSnapshot } from '../playerModel';
import { PLAYER_BODY_ROOT_NAME } from '../playerVisual';

export type PlayerPoseIntent = 'locomotion' | 'neutral' | 'readyDefense' | 'readyOffense';

export interface PlayerPoseConfig {
  maxDeltaSeconds: number;
  movingSpeedThreshold: number;
  maxVisualDistancePerFrame: number;
  strideRadiansPerWorldUnit: number;
  readyBlendRate: number;
  locomotionBlendRate: number;
  readyOffense: ReadyPoseConfig;
  readyDefense: ReadyPoseConfig;
  locomotion: LocomotionPoseConfig;
  safeLimits: PoseLimitConfig;
}

export interface ReadyPoseConfig {
  armForwardRotationX: number;
  armSpreadRotationZ: number;
  legForwardRotationX: number;
  legSpreadRotationZ: number;
  torsoLeanX: number;
}

export interface LocomotionPoseConfig {
  armSwingRotationX: number;
  footSwingRotationX: number;
  legSwingRotationX: number;
  legSpreadRotationZ: number;
  torsoLeanX: number;
  torsoSwayRotationZ: number;
}

export interface PoseLimitConfig {
  armRotationX: number;
  armRotationZ: number;
  footRotationX: number;
  legRotationX: number;
  legRotationZ: number;
  torsoRotationX: number;
  torsoRotationZ: number;
}

export interface PlayerPoseValues {
  leftArmRotationX: number;
  leftArmRotationZ: number;
  leftFootRotationX: number;
  leftLegRotationX: number;
  leftLegRotationZ: number;
  rightArmRotationX: number;
  rightArmRotationZ: number;
  rightFootRotationX: number;
  rightLegRotationX: number;
  rightLegRotationZ: number;
  shoulderRotationX: number;
  torsoRotationX: number;
  torsoRotationZ: number;
}

export interface PlayerPoseSnapshot {
  intent: PlayerPoseIntent;
  phaseRadians: number;
  phaseOffsetRadians: number;
  playerId: string;
  speed: number;
}

interface PlayerPoseState {
  appliedPose: PlayerPoseValues;
  intent: PlayerPoseIntent;
  lastPosition: { x: number; z: number } | null;
  phaseRadians: number;
  phaseOffsetRadians: number;
  speed: number;
}

interface PlayerVisualParts {
  bodyRoot: THREE.Object3D | null;
  leftArmPivot: THREE.Object3D | null;
  leftFoot: THREE.Object3D | null;
  leftLegPivot: THREE.Object3D | null;
  rightArmPivot: THREE.Object3D | null;
  rightFoot: THREE.Object3D | null;
  rightLegPivot: THREE.Object3D | null;
  shoulderPads: THREE.Object3D | null;
  torso: THREE.Object3D | null;
}

export const PLAYER_POSE_CONFIG: PlayerPoseConfig = {
  maxDeltaSeconds: 0.05,
  movingSpeedThreshold: 0.18,
  maxVisualDistancePerFrame: 4,
  strideRadiansPerWorldUnit: 3.25,
  readyBlendRate: 8.5,
  locomotionBlendRate: 11,
  readyOffense: {
    armForwardRotationX: -0.12,
    armSpreadRotationZ: 0.08,
    legForwardRotationX: 0,
    legSpreadRotationZ: 0,
    torsoLeanX: 0.08,
  },
  readyDefense: {
    armForwardRotationX: -0.08,
    armSpreadRotationZ: 0.14,
    legForwardRotationX: 0,
    legSpreadRotationZ: 0,
    torsoLeanX: 0.05,
  },
  locomotion: {
    armSwingRotationX: 0.46,
    footSwingRotationX: 0.12,
    legSwingRotationX: 0.48,
    legSpreadRotationZ: 0,
    torsoLeanX: 0.09,
    torsoSwayRotationZ: 0.035,
  },
  safeLimits: {
    armRotationX: 0.58,
    armRotationZ: 0.26,
    footRotationX: 0.18,
    legRotationX: 0.54,
    legRotationZ: 0.2,
    torsoRotationX: 0.12,
    torsoRotationZ: 0.05,
  },
};

const TWO_PI = Math.PI * 2;

const NEUTRAL_POSE: PlayerPoseValues = {
  leftArmRotationX: 0,
  leftArmRotationZ: 0,
  leftFootRotationX: 0,
  leftLegRotationX: 0,
  leftLegRotationZ: 0,
  rightArmRotationX: 0,
  rightArmRotationZ: 0,
  rightFootRotationX: 0,
  rightLegRotationX: 0,
  rightLegRotationZ: 0,
  shoulderRotationX: 0,
  torsoRotationX: 0,
  torsoRotationZ: 0,
};

export class PlayerPoseController {
  private readonly enabled: boolean;
  private readonly states = new Map<string, PlayerPoseState>();

  constructor(
    private readonly config: PlayerPoseConfig = PLAYER_POSE_CONFIG,
    options: { enabled?: boolean } = {},
  ) {
    this.enabled = options.enabled ?? true;
  }

  update(
    gameplay: GameplaySnapshot,
    playerVisuals: Map<string, THREE.Object3D>,
    deltaSeconds: number,
  ): void {
    const clampedDelta = clamp(deltaSeconds, 0, this.config.maxDeltaSeconds);
    const activePlayerIds = new Set(gameplay.players.map((player) => player.id));

    for (const player of gameplay.players) {
      const state = this.getOrCreateState(player.id);
      const visual = playerVisuals.get(player.id);
      const speed = calculatePlayerSpeed(player);
      const intent = this.enabled
        ? derivePlayerPoseIntent(player, gameplay.playState, this.config)
        : 'neutral';

      state.intent = intent;
      state.speed = speed;
      state.phaseRadians = updateLocomotionPhase(
        state,
        player,
        intent,
        clampedDelta,
        this.config,
      );
      state.lastPosition = { ...player.position };

      const targetPose = this.enabled
        ? createPoseTarget(intent, state.phaseRadians, this.config)
        : NEUTRAL_POSE;
      const blendRate = intent === 'locomotion'
        ? this.config.locomotionBlendRate
        : this.config.readyBlendRate;
      state.appliedPose = blendPoseValues(
        state.appliedPose,
        targetPose,
        calculateBlendAlpha(blendRate, clampedDelta),
      );

      if (visual) {
        applyPoseToPlayerVisual(visual, state.appliedPose);
      }
    }

    for (const playerId of [...this.states.keys()]) {
      if (!activePlayerIds.has(playerId)) {
        this.states.delete(playerId);
      }
    }
  }

  getPoseSnapshots(): PlayerPoseSnapshot[] {
    return [...this.states.entries()]
      .map(([playerId, state]) => ({
        intent: state.intent,
        phaseOffsetRadians: state.phaseOffsetRadians,
        phaseRadians: state.phaseRadians,
        playerId,
        speed: state.speed,
      }))
      .sort((a, b) => a.playerId.localeCompare(b.playerId));
  }

  private getOrCreateState(playerId: string): PlayerPoseState {
    const existing = this.states.get(playerId);

    if (existing) {
      return existing;
    }

    const phaseOffsetRadians = calculateStablePhaseOffset(playerId);
    const state: PlayerPoseState = {
      appliedPose: { ...NEUTRAL_POSE },
      intent: 'neutral',
      lastPosition: null,
      phaseOffsetRadians,
      phaseRadians: phaseOffsetRadians,
      speed: 0,
    };
    this.states.set(playerId, state);
    return state;
  }
}

export function derivePlayerPoseIntent(
  player: PlayerSnapshot,
  playState: PlayState,
  config: Pick<PlayerPoseConfig, 'movingSpeedThreshold'> = PLAYER_POSE_CONFIG,
): PlayerPoseIntent {
  if (playState === 'gameOver') {
    return 'neutral';
  }

  const speed = calculatePlayerSpeed(player);
  const canUseLocomotion = playState !== 'preSnap' && player.currentState !== 'idle';

  if (canUseLocomotion && speed > config.movingSpeedThreshold) {
    return 'locomotion';
  }

  return player.team === 'offense' ? 'readyOffense' : 'readyDefense';
}

export function calculatePlayerSpeed(player: Pick<PlayerSnapshot, 'velocity'>): number {
  return Math.hypot(player.velocity.x, player.velocity.z);
}

export function calculateStablePhaseOffset(playerId: string): number {
  let hash = 2166136261;

  for (let index = 0; index < playerId.length; index += 1) {
    hash ^= playerId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) / 0xffffffff) * TWO_PI;
}

export function calculateStridePhaseAdvance(
  distanceTraveled: number,
  speed: number,
  deltaSeconds: number,
  config: Pick<
    PlayerPoseConfig,
    'maxVisualDistancePerFrame' | 'strideRadiansPerWorldUnit'
  > = PLAYER_POSE_CONFIG,
): number {
  const visualDistance =
    distanceTraveled > 0 && distanceTraveled <= config.maxVisualDistancePerFrame
      ? distanceTraveled
      : Math.max(0, speed) * Math.max(0, deltaSeconds);

  return visualDistance * config.strideRadiansPerWorldUnit;
}

export function createPoseTarget(
  intent: PlayerPoseIntent,
  phaseRadians: number,
  config: PlayerPoseConfig = PLAYER_POSE_CONFIG,
): PlayerPoseValues {
  if (intent === 'neutral') {
    return { ...NEUTRAL_POSE };
  }

  if (intent === 'readyOffense') {
    return createReadyPose(config.readyOffense, config);
  }

  if (intent === 'readyDefense') {
    return createReadyPose(config.readyDefense, config);
  }

  const stride = Math.sin(phaseRadians);
  const counterStride = -stride;
  const footStride = Math.sin(phaseRadians + Math.PI / 7);
  const torsoSway = Math.sin(phaseRadians * 0.5) * config.locomotion.torsoSwayRotationZ;

  return clampPoseValues(
    {
      leftArmRotationX: counterStride * config.locomotion.armSwingRotationX,
      leftArmRotationZ: 0,
      leftFootRotationX: -footStride * config.locomotion.footSwingRotationX,
      leftLegRotationX: stride * config.locomotion.legSwingRotationX,
      leftLegRotationZ: -config.locomotion.legSpreadRotationZ,
      rightArmRotationX: stride * config.locomotion.armSwingRotationX,
      rightArmRotationZ: 0,
      rightFootRotationX: footStride * config.locomotion.footSwingRotationX,
      rightLegRotationX: counterStride * config.locomotion.legSwingRotationX,
      rightLegRotationZ: config.locomotion.legSpreadRotationZ,
      shoulderRotationX: config.locomotion.torsoLeanX,
      torsoRotationX: config.locomotion.torsoLeanX,
      torsoRotationZ: torsoSway,
    },
    config.safeLimits,
  );
}

export function blendPoseValues(
  current: PlayerPoseValues,
  target: PlayerPoseValues,
  alpha: number,
): PlayerPoseValues {
  const clampedAlpha = clamp(alpha, 0, 1);

  return {
    leftArmRotationX: lerp(current.leftArmRotationX, target.leftArmRotationX, clampedAlpha),
    leftArmRotationZ: lerp(current.leftArmRotationZ, target.leftArmRotationZ, clampedAlpha),
    leftFootRotationX: lerp(current.leftFootRotationX, target.leftFootRotationX, clampedAlpha),
    leftLegRotationX: lerp(current.leftLegRotationX, target.leftLegRotationX, clampedAlpha),
    leftLegRotationZ: lerp(current.leftLegRotationZ, target.leftLegRotationZ, clampedAlpha),
    rightArmRotationX: lerp(current.rightArmRotationX, target.rightArmRotationX, clampedAlpha),
    rightArmRotationZ: lerp(current.rightArmRotationZ, target.rightArmRotationZ, clampedAlpha),
    rightFootRotationX: lerp(current.rightFootRotationX, target.rightFootRotationX, clampedAlpha),
    rightLegRotationX: lerp(current.rightLegRotationX, target.rightLegRotationX, clampedAlpha),
    rightLegRotationZ: lerp(current.rightLegRotationZ, target.rightLegRotationZ, clampedAlpha),
    shoulderRotationX: lerp(current.shoulderRotationX, target.shoulderRotationX, clampedAlpha),
    torsoRotationX: lerp(current.torsoRotationX, target.torsoRotationX, clampedAlpha),
    torsoRotationZ: lerp(current.torsoRotationZ, target.torsoRotationZ, clampedAlpha),
  };
}

export function createPlayerPoseDebugOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'pose-debug-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncPlayerPoseDebugOverlay(
  element: HTMLElement,
  snapshots: PlayerPoseSnapshot[],
): void {
  const lines = ['POSE DEBUG'];

  for (const snapshot of snapshots) {
    lines.push(
      `${snapshot.playerId} ${snapshot.intent} phase ${snapshot.phaseRadians.toFixed(2)}`,
    );
  }

  element.textContent = lines.join('\n');
}

function updateLocomotionPhase(
  state: PlayerPoseState,
  player: PlayerSnapshot,
  intent: PlayerPoseIntent,
  deltaSeconds: number,
  config: PlayerPoseConfig,
): number {
  if (intent !== 'locomotion') {
    return state.phaseRadians;
  }

  const distance = state.lastPosition
    ? Math.hypot(
        player.position.x - state.lastPosition.x,
        player.position.z - state.lastPosition.z,
      )
    : 0;

  return wrapRadians(
    state.phaseRadians +
      calculateStridePhaseAdvance(distance, calculatePlayerSpeed(player), deltaSeconds, config),
  );
}

function createReadyPose(
  pose: ReadyPoseConfig,
  config: PlayerPoseConfig,
): PlayerPoseValues {
  return clampPoseValues(
    {
      leftArmRotationX: pose.armForwardRotationX,
      leftArmRotationZ: -pose.armSpreadRotationZ,
      leftFootRotationX: 0,
      leftLegRotationX: pose.legForwardRotationX,
      leftLegRotationZ: -pose.legSpreadRotationZ,
      rightArmRotationX: pose.armForwardRotationX,
      rightArmRotationZ: pose.armSpreadRotationZ,
      rightFootRotationX: 0,
      rightLegRotationX: pose.legForwardRotationX,
      rightLegRotationZ: pose.legSpreadRotationZ,
      shoulderRotationX: pose.torsoLeanX,
      torsoRotationX: pose.torsoLeanX,
      torsoRotationZ: 0,
    },
    config.safeLimits,
  );
}

function applyPoseToPlayerVisual(
  playerVisual: THREE.Object3D,
  pose: PlayerPoseValues,
): void {
  const parts = getPlayerVisualParts(playerVisual);

  setRotation(parts.leftArmPivot, pose.leftArmRotationX, 0, pose.leftArmRotationZ);
  setRotation(parts.rightArmPivot, pose.rightArmRotationX, 0, pose.rightArmRotationZ);
  setRotation(parts.leftLegPivot, pose.leftLegRotationX, 0, pose.leftLegRotationZ);
  setRotation(parts.rightLegPivot, pose.rightLegRotationX, 0, pose.rightLegRotationZ);
  setRotation(parts.leftFoot, pose.leftFootRotationX, 0, 0);
  setRotation(parts.rightFoot, pose.rightFootRotationX, 0, 0);
  setRotation(parts.torso, pose.torsoRotationX, 0, pose.torsoRotationZ);
  setRotation(parts.shoulderPads, pose.shoulderRotationX, 0, pose.torsoRotationZ);

  if (parts.bodyRoot) {
    parts.bodyRoot.position.set(0, 0, 0);
  }
}

function getPlayerVisualParts(playerVisual: THREE.Object3D): PlayerVisualParts {
  return {
    bodyRoot: playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME) ?? null,
    leftArmPivot: playerVisual.getObjectByName('leftArmPivot') ?? null,
    leftFoot: playerVisual.getObjectByName('leftFoot') ?? null,
    leftLegPivot: playerVisual.getObjectByName('leftLegPivot') ?? null,
    rightArmPivot: playerVisual.getObjectByName('rightArmPivot') ?? null,
    rightFoot: playerVisual.getObjectByName('rightFoot') ?? null,
    rightLegPivot: playerVisual.getObjectByName('rightLegPivot') ?? null,
    shoulderPads: playerVisual.getObjectByName('shoulderPads') ?? null,
    torso: playerVisual.getObjectByName('torso') ?? null,
  };
}

function setRotation(
  object: THREE.Object3D | null,
  x: number,
  y: number,
  z: number,
): void {
  if (!object) {
    return;
  }

  object.rotation.set(x, y, z);
}

function clampPoseValues(
  pose: PlayerPoseValues,
  limits: PoseLimitConfig,
): PlayerPoseValues {
  return {
    leftArmRotationX: clamp(pose.leftArmRotationX, -limits.armRotationX, limits.armRotationX),
    leftArmRotationZ: clamp(pose.leftArmRotationZ, -limits.armRotationZ, limits.armRotationZ),
    leftFootRotationX: clamp(pose.leftFootRotationX, -limits.footRotationX, limits.footRotationX),
    leftLegRotationX: clamp(pose.leftLegRotationX, -limits.legRotationX, limits.legRotationX),
    leftLegRotationZ: clamp(pose.leftLegRotationZ, -limits.legRotationZ, limits.legRotationZ),
    rightArmRotationX: clamp(pose.rightArmRotationX, -limits.armRotationX, limits.armRotationX),
    rightArmRotationZ: clamp(pose.rightArmRotationZ, -limits.armRotationZ, limits.armRotationZ),
    rightFootRotationX: clamp(pose.rightFootRotationX, -limits.footRotationX, limits.footRotationX),
    rightLegRotationX: clamp(pose.rightLegRotationX, -limits.legRotationX, limits.legRotationX),
    rightLegRotationZ: clamp(pose.rightLegRotationZ, -limits.legRotationZ, limits.legRotationZ),
    shoulderRotationX: clamp(pose.shoulderRotationX, -limits.torsoRotationX, limits.torsoRotationX),
    torsoRotationX: clamp(pose.torsoRotationX, -limits.torsoRotationX, limits.torsoRotationX),
    torsoRotationZ: clamp(pose.torsoRotationZ, -limits.torsoRotationZ, limits.torsoRotationZ),
  };
}

function calculateBlendAlpha(blendRate: number, deltaSeconds: number): number {
  return 1 - Math.exp(-blendRate * deltaSeconds);
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapRadians(value: number): number {
  return ((value % TWO_PI) + TWO_PI) % TWO_PI;
}
