import * as THREE from 'three';
import { PLAYABLE_FIELD_BOUNDS } from '../field';
import type { GameplaySnapshot, PlayState } from '../playState';
import type { PlayerSnapshot, Vector2 } from '../playerModel';

export type PresentationCameraPhase =
  | 'deadBallResult'
  | 'liveCarrier'
  | 'passFlight'
  | 'preSnapEstablish'
  | 'returnToPreSnap'
  | 'touchdownResult'
  | 'transitionToGameplay';

export interface FieldPlaneBounds {
  center: { x: number; z: number };
  max: { x: number; z: number };
  min: { x: number; z: number };
  playerIds: string[];
  size: { x: number; z: number };
}

export interface PresentationCameraDebugSnapshot {
  cameraPosition: { x: number; y: number; z: number };
  focusTarget: { x: number; y: number; z: number };
  formationBounds: FieldPlaneBounds;
  lookTarget: { x: number; y: number; z: number };
  phase: PresentationCameraPhase;
}

export interface PresentationCameraConfig {
  fieldOfView: number;
  maximumTransitionSpeed: number;
  maxDeltaSeconds: number;
  minimumFieldPosition: { x: number; z: number };
  maximumFieldPosition: { x: number; z: number };
  playDirection: Vector2;
  positionSmoothing: number;
  targetSmoothing: number;
  phases: Record<PresentationCameraPhase, PresentationCameraShotConfig>;
}

export interface PresentationCameraShotConfig {
  distance: number;
  height: number;
  lookAhead: number;
  positionSmoothing?: number;
  shotDuration: number;
  sidelineOffset?: number;
  targetSmoothing?: number;
}

interface PresentationCameraShot {
  focus: THREE.Vector3;
  lookTarget: THREE.Vector3;
  phase: PresentationCameraPhase;
  position: THREE.Vector3;
}

export const PRESENTATION_CAMERA_CONFIG: PresentationCameraConfig = {
  fieldOfView: 44,
  maximumFieldPosition: {
    x: PLAYABLE_FIELD_BOUNDS.maxX,
    z: PLAYABLE_FIELD_BOUNDS.maxZ,
  },
  maximumTransitionSpeed: 85,
  maxDeltaSeconds: 0.05,
  minimumFieldPosition: {
    x: PLAYABLE_FIELD_BOUNDS.minX,
    z: PLAYABLE_FIELD_BOUNDS.minZ,
  },
  phases: {
    deadBallResult: {
      distance: 22,
      height: 12,
      lookAhead: 4,
      shotDuration: 0.8,
    },
    liveCarrier: {
      distance: 24,
      height: 13,
      lookAhead: 16,
      positionSmoothing: 7.5,
      shotDuration: 0,
      targetSmoothing: 9,
    },
    passFlight: {
      distance: 28,
      height: 18,
      lookAhead: 6,
      positionSmoothing: 9,
      shotDuration: 0,
      targetSmoothing: 11,
    },
    preSnapEstablish: {
      distance: 44,
      height: 38,
      lookAhead: 6,
      positionSmoothing: 5.5,
      shotDuration: 1.2,
      sidelineOffset: 8,
      targetSmoothing: 6,
    },
    returnToPreSnap: {
      distance: 30,
      height: 19,
      lookAhead: 10,
      shotDuration: 0.8,
    },
    touchdownResult: {
      distance: 18,
      height: 8,
      lookAhead: -6,
      positionSmoothing: 6,
      shotDuration: 0.95,
      sidelineOffset: 7,
      targetSmoothing: 8,
    },
    transitionToGameplay: {
      distance: 30,
      height: 20,
      lookAhead: 14,
      positionSmoothing: 8,
      shotDuration: 0.45,
      targetSmoothing: 9,
    },
  },
  playDirection: {
    x: 0,
    z: 1,
  },
  positionSmoothing: 7,
  targetSmoothing: 8,
} as const;

export class PresentationCameraDirector {
  private debugSnapshot: PresentationCameraDebugSnapshot = createEmptyDebugSnapshot();
  private readonly playDirection: Vector2;
  private readonly sidelineDirection: Vector2;
  private phase: PresentationCameraPhase = 'preSnapEstablish';
  private phaseElapsedSeconds = 0;
  private previousPlayState: PlayState | null = null;
  private returnToPreSnapSeconds = 0;
  private smoothedPosition = new THREE.Vector3();
  private smoothedTarget = new THREE.Vector3();
  private transitionToGameplaySeconds = 0;
  private initialized = false;

  constructor(private readonly config: PresentationCameraConfig = PRESENTATION_CAMERA_CONFIG) {
    this.playDirection = normalizeDirection(config.playDirection);
    this.sidelineDirection = { x: this.playDirection.z, z: -this.playDirection.x };
  }

  reset(): void {
    this.phase = 'preSnapEstablish';
    this.phaseElapsedSeconds = 0;
    this.previousPlayState = null;
    this.returnToPreSnapSeconds = 0;
    this.transitionToGameplaySeconds = 0;
    this.initialized = false;
  }

  update(
    snapshot: GameplaySnapshot,
    camera: THREE.PerspectiveCamera,
    deltaSeconds: number,
  ): PresentationCameraDebugSnapshot {
    const delta = clamp(deltaSeconds, 0, this.config.maxDeltaSeconds);

    this.updateTransitionTimers(snapshot, delta);
    const nextPhase = this.selectPhase(snapshot);

    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.phaseElapsedSeconds = 0;
    } else {
      this.phaseElapsedSeconds += delta;
    }

    const formationBounds = calculateFormationBounds(snapshot.players);
    const shot = this.createShot(snapshot, formationBounds, this.phase);

    camera.fov = this.config.fieldOfView;
    camera.updateProjectionMatrix();
    this.applyShot(camera, shot, delta);
    this.previousPlayState = snapshot.playState;

    this.debugSnapshot = {
      cameraPosition: toPlainVector(camera.position),
      focusTarget: toPlainVector(shot.focus),
      formationBounds,
      lookTarget: toPlainVector(this.smoothedTarget),
      phase: this.phase,
    };

    return this.getDebugSnapshot();
  }

  getDebugSnapshot(): PresentationCameraDebugSnapshot {
    return {
      cameraPosition: { ...this.debugSnapshot.cameraPosition },
      focusTarget: { ...this.debugSnapshot.focusTarget },
      formationBounds: cloneFieldPlaneBounds(this.debugSnapshot.formationBounds),
      lookTarget: { ...this.debugSnapshot.lookTarget },
      phase: this.debugSnapshot.phase,
    };
  }

  private updateTransitionTimers(snapshot: GameplaySnapshot, deltaSeconds: number): void {
    if (this.previousPlayState === 'preSnap' && snapshot.playState === 'live') {
      this.transitionToGameplaySeconds = this.config.phases.transitionToGameplay.shotDuration;
    }

    if (this.previousPlayState === 'dead' && snapshot.playState === 'preSnap') {
      this.returnToPreSnapSeconds = this.config.phases.returnToPreSnap.shotDuration;
    }

    this.transitionToGameplaySeconds = Math.max(
      0,
      this.transitionToGameplaySeconds - deltaSeconds,
    );
    this.returnToPreSnapSeconds = Math.max(0, this.returnToPreSnapSeconds - deltaSeconds);
  }

  private selectPhase(snapshot: GameplaySnapshot): PresentationCameraPhase {
    if (snapshot.playState === 'preSnap') {
      if (this.returnToPreSnapSeconds > 0) {
        return 'returnToPreSnap';
      }

      if (
        this.phase === 'preSnapEstablish' &&
        this.phaseElapsedSeconds < this.config.phases.preSnapEstablish.shotDuration
      ) {
        return 'preSnapEstablish';
      }

      return 'transitionToGameplay';
    }

    if (snapshot.playState === 'live') {
      if (snapshot.ball.state.kind === 'inFlight') {
        return 'passFlight';
      }

      if (this.transitionToGameplaySeconds > 0) {
        return 'transitionToGameplay';
      }

      return 'liveCarrier';
    }

    if (snapshot.lastPlayResult?.type === 'touchdown') {
      return 'touchdownResult';
    }

    return 'deadBallResult';
  }

  private createShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    if (phase === 'preSnapEstablish') {
      return this.createFormationEstablishShot(snapshot, formationBounds, phase);
    }

    if (phase === 'transitionToGameplay') {
      return this.createTransitionShot(snapshot, formationBounds, phase);
    }

    if (phase === 'passFlight') {
      return this.createPassFlightShot(snapshot, phase);
    }

    if (phase === 'touchdownResult') {
      return this.createTouchdownShot(snapshot, phase);
    }

    if (phase === 'deadBallResult') {
      return this.createDeadBallShot(snapshot, phase);
    }

    if (phase === 'returnToPreSnap') {
      return this.createReturnToPreSnapShot(snapshot, formationBounds, phase);
    }

    return this.createCarrierShot(snapshot, phase);
  }

  private createFormationEstablishShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const config = this.config.phases[phase];
    const focus = this.createFieldFocus(
      formationBounds.center.x,
      formationBounds.center.z,
      1.3,
    );
    const distance = config.distance + formationBounds.size.z * 0.28;
    const sidelineOffset = (config.sidelineOffset ?? 0) + formationBounds.size.x * 0.12;
    const position = this.offsetFromFocus(focus, {
      distanceBehind: distance,
      height: config.height,
      sidelineOffset,
    });

    return {
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position,
    };
  }

  private createTransitionShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const carrier = getBallCarrier(snapshot) ?? snapshot.player;
    const focus = snapshot.playState === 'live'
      ? this.createFieldFocus(carrier.position.x, carrier.position.z, 1.25)
      : this.createFieldFocus(formationBounds.center.x, snapshot.drive.lineOfScrimmage.z, 1.2);
    const config = this.config.phases[phase];

    return {
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    };
  }

  private createCarrierShot(
    snapshot: GameplaySnapshot,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const carrier = getBallCarrier(snapshot) ?? snapshot.player;
    const config = this.config.phases[phase];
    const focus = this.createFieldFocus(carrier.position.x, carrier.position.z, 1.3);

    return {
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    };
  }

  private createPassFlightShot(
    snapshot: GameplaySnapshot,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const config = this.config.phases[phase];

    if (snapshot.ball.state.kind !== 'inFlight') {
      return this.createCarrierShot(snapshot, 'liveCarrier');
    }

    const ball = snapshot.ball.position;
    const target = snapshot.ball.state.target;
    const focus = this.createFieldFocus(
      (ball.x + target.x) / 2,
      (ball.z + target.z) / 2,
      Math.max(1.4, Math.min(5, (ball.y + target.y) / 2 + 1.1)),
    );
    const lookTarget = this.createFieldFocus(target.x, target.z, Math.max(1.1, target.y + 1));

    return {
      focus,
      lookTarget,
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    };
  }

  private createDeadBallShot(
    snapshot: GameplaySnapshot,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const config = this.config.phases[phase];
    const spot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.nextSnapSpot;
    const focus = this.createFieldFocus(spot.x, spot.z, 1.2);

    return {
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    };
  }

  private createTouchdownShot(
    snapshot: GameplaySnapshot,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const config = this.config.phases[phase];
    const spot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.player.position;
    const focus = this.createFieldFocus(spot.x, spot.z, 1.25);
    const position = this.offsetFromFocus(focus, {
      distanceBehind: -config.distance,
      height: config.height,
      sidelineOffset: config.sidelineOffset ?? 0,
    });

    return {
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position,
    };
  }

  private createReturnToPreSnapShot(
    snapshot: GameplaySnapshot,
    _formationBounds: FieldPlaneBounds,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const config = this.config.phases[phase];
    const snap = snapshot.nextSnapSpot ?? snapshot.drive.lineOfScrimmage;
    const focus = this.createFieldFocus(snap.x, snap.z, 1.2);

    return {
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    };
  }

  private applyShot(
    camera: THREE.PerspectiveCamera,
    shot: PresentationCameraShot,
    deltaSeconds: number,
  ): void {
    if (!this.initialized) {
      this.smoothedPosition.copy(shot.position);
      this.smoothedTarget.copy(shot.lookTarget);
      this.initialized = true;
    } else {
      const phaseConfig = this.config.phases[shot.phase];
      this.smoothedPosition.copy(smoothVectorWithSpeedLimit(
        this.smoothedPosition,
        shot.position,
        phaseConfig.positionSmoothing ?? this.config.positionSmoothing,
        deltaSeconds,
        this.config.maximumTransitionSpeed,
      ));
      this.smoothedTarget.copy(smoothVectorWithSpeedLimit(
        this.smoothedTarget,
        shot.lookTarget,
        phaseConfig.targetSmoothing ?? this.config.targetSmoothing,
        deltaSeconds,
        this.config.maximumTransitionSpeed,
      ));
    }

    camera.position.copy(this.smoothedPosition);
    camera.lookAt(this.smoothedTarget);
  }

  private offsetFromFocus(
    focus: THREE.Vector3,
    options: {
      distanceBehind: number;
      height: number;
      sidelineOffset?: number;
    },
  ): THREE.Vector3 {
    return new THREE.Vector3(
      focus.x -
        this.playDirection.x * options.distanceBehind +
        this.sidelineDirection.x * (options.sidelineOffset ?? 0),
      options.height,
      focus.z -
        this.playDirection.z * options.distanceBehind +
        this.sidelineDirection.z * (options.sidelineOffset ?? 0),
    );
  }

  private createForwardTarget(focus: THREE.Vector3, lookAhead: number): THREE.Vector3 {
    return this.createFieldFocus(
      focus.x + this.playDirection.x * lookAhead,
      focus.z + this.playDirection.z * lookAhead,
      Math.max(1, focus.y * 0.7),
    );
  }

  private createFieldFocus(x: number, z: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(
      clamp(x, this.config.minimumFieldPosition.x, this.config.maximumFieldPosition.x),
      y,
      clamp(z, this.config.minimumFieldPosition.z, this.config.maximumFieldPosition.z),
    );
  }
}

export function calculateFormationBounds(players: PlayerSnapshot[]): FieldPlaneBounds {
  if (players.length === 0) {
    return {
      center: { x: 0, z: 0 },
      max: { x: 0, z: 0 },
      min: { x: 0, z: 0 },
      playerIds: [],
      size: { x: 0, z: 0 },
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const player of players) {
    minX = Math.min(minX, player.position.x - player.collisionRadius);
    maxX = Math.max(maxX, player.position.x + player.collisionRadius);
    minZ = Math.min(minZ, player.position.z - player.collisionRadius);
    maxZ = Math.max(maxZ, player.position.z + player.collisionRadius);
  }

  return {
    center: {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
    },
    max: {
      x: maxX,
      z: maxZ,
    },
    min: {
      x: minX,
      z: minZ,
    },
    playerIds: players.map((player) => player.id).sort(),
    size: {
      x: maxX - minX,
      z: maxZ - minZ,
    },
  };
}

function getBallCarrier(snapshot: GameplaySnapshot): PlayerSnapshot | null {
  const possession = snapshot.ball.possession;

  if (possession.kind !== 'player') {
    return null;
  }

  return snapshot.players.find((player) => player.id === possession.playerId) ?? null;
}

function smoothVectorWithSpeedLimit(
  current: THREE.Vector3,
  target: THREE.Vector3,
  smoothing: number,
  deltaSeconds: number,
  maxSpeed: number,
): THREE.Vector3 {
  const alpha = calculateSmoothingAlpha(smoothing, deltaSeconds);
  const smoothed = current.clone().lerp(target, alpha);
  const delta = smoothed.clone().sub(current);
  const distance = delta.length();
  const maxDistance = Math.max(0, maxSpeed * Math.max(0, deltaSeconds));

  if (distance <= maxDistance || maxDistance === 0) {
    return smoothed;
  }

  return current.clone().add(delta.multiplyScalar(maxDistance / distance));
}

function calculateSmoothingAlpha(smoothing: number, deltaSeconds: number): number {
  return 1 - Math.exp(-smoothing * Math.max(0, deltaSeconds));
}

function normalizeDirection(direction: Vector2): Vector2 {
  const length = Math.hypot(direction.x, direction.z);

  if (length === 0) {
    return { x: 0, z: 1 };
  }

  return {
    x: direction.x / length,
    z: direction.z / length,
  };
}

function createEmptyDebugSnapshot(): PresentationCameraDebugSnapshot {
  const emptyBounds = calculateFormationBounds([]);

  return {
    cameraPosition: { x: 0, y: 0, z: 0 },
    focusTarget: { x: 0, y: 0, z: 0 },
    formationBounds: emptyBounds,
    lookTarget: { x: 0, y: 0, z: 0 },
    phase: 'preSnapEstablish',
  };
}

function cloneFieldPlaneBounds(bounds: FieldPlaneBounds): FieldPlaneBounds {
  return {
    center: { ...bounds.center },
    max: { ...bounds.max },
    min: { ...bounds.min },
    playerIds: [...bounds.playerIds],
    size: { ...bounds.size },
  };
}

function toPlainVector(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
