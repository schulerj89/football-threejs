import * as THREE from 'three';
import type { PresentationAudioEvent } from '../audio/PresentationEventBridge';
import { PLAYABLE_FIELD_BOUNDS } from '../field';
import { FIELD_BOUNDS, FIELD_DIMENSIONS } from '../fieldSpec';
import type { GameplaySnapshot, PlayState } from '../playState';
import type { PlayerSnapshot, Vector2 } from '../playerModel';

export type CinematicsSetting = 'brief' | 'full' | 'off';

export type PresentationOrbitShotName =
  | 'firstDownCrowdCutaway'
  | 'prePlayOrbit180'
  | 'touchdownCrowdCutaway'
  | 'touchdownOrbit360';

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
  activeShotName: PresentationOrbitShotName | null;
  cameraPosition: { x: number; y: number; z: number };
  focusTarget: { x: number; y: number; z: number };
  formationBounds: FieldPlaneBounds;
  lookTarget: { x: number; y: number; z: number };
  orbitCenter: { x: number; y: number; z: number } | null;
  orbitRadius: number | null;
  phase: PresentationCameraPhase;
  restoreCamera: string | null;
  shotProgress: number | null;
}

export interface PresentationCameraConfig {
  cinematics: {
    fieldPadding: number;
    firstDownCrowdCutaway: PresentationOrbitShotConfig;
    minimumCameraHeight: number;
    prePlayOrbit180: PresentationOrbitShotConfig;
    touchdownCrowdCutaway: PresentationOrbitShotConfig;
    touchdownOrbit360: PresentationOrbitShotConfig;
  };
  fieldOfView: number;
  holdPreSnapEstablish?: boolean;
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

export interface PresentationOrbitShotConfig {
  briefDuration: number;
  briefSweepDegrees: number;
  distance: number;
  fieldOfView: number;
  fullDuration: number;
  fullSweepDegrees: number;
  height: number;
  lookAhead: number;
  maximumRadius: number;
  minimumRadius: number;
  sidelineOffset?: number;
}

interface PresentationCameraShot {
  activeShotName: PresentationOrbitShotName | null;
  fieldOfView: number;
  focus: THREE.Vector3;
  lookTarget: THREE.Vector3;
  orbitCenter: THREE.Vector3 | null;
  orbitRadius: number | null;
  phase: PresentationCameraPhase;
  position: THREE.Vector3;
  restoreCamera: string | null;
  shotProgress: number | null;
}

interface PresentationCameraDirectorOptions {
  cinematics?: CinematicsSetting;
  config?: PresentationCameraConfig;
  shotPreview?: PresentationOrbitShotName | null;
}

interface PresentationCameraUpdateOptions {
  aspectRatio?: number;
  crowdCutawaysEnabled?: boolean;
  presentationEvents?: readonly PresentationAudioEvent[];
  restoreCameraMode?: string;
}

interface ActiveOrbitShot {
  elapsedSeconds: number;
  key: string;
  lockedCenter?: THREE.Vector3;
  name: PresentationOrbitShotName;
  preview: boolean;
  resultCenter?: THREE.Vector3;
  resultId?: number;
}

export const PRESENTATION_CAMERA_CONFIG: PresentationCameraConfig = {
  cinematics: {
    fieldPadding: 52,
    firstDownCrowdCutaway: {
      briefDuration: 0.75,
      briefSweepDegrees: 12,
      distance: 16,
      fieldOfView: 34,
      fullDuration: 1.1,
      fullSweepDegrees: 20,
      height: 7,
      lookAhead: 0,
      maximumRadius: 24,
      minimumRadius: 12,
      sidelineOffset: 0,
    },
    minimumCameraHeight: 5.5,
    prePlayOrbit180: {
      briefDuration: 1.05,
      briefSweepDegrees: 145,
      distance: 32,
      fieldOfView: 42,
      fullDuration: 1.55,
      fullSweepDegrees: 180,
      height: 30,
      lookAhead: 4,
      maximumRadius: 58,
      minimumRadius: 28,
      sidelineOffset: 0,
    },
    touchdownCrowdCutaway: {
      briefDuration: 0.8,
      briefSweepDegrees: 18,
      distance: 17,
      fieldOfView: 34,
      fullDuration: 1.2,
      fullSweepDegrees: 30,
      height: 7.5,
      lookAhead: 0,
      maximumRadius: 26,
      minimumRadius: 13,
      sidelineOffset: 0,
    },
    touchdownOrbit360: {
      briefDuration: 0.8,
      briefSweepDegrees: 270,
      distance: 20,
      fieldOfView: 40,
      fullDuration: 1.05,
      fullSweepDegrees: 350,
      height: 9,
      lookAhead: -4,
      maximumRadius: 34,
      minimumRadius: 16,
      sidelineOffset: 0,
    },
  },
  fieldOfView: 44,
  holdPreSnapEstablish: false,
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
  private activeOrbitShot: ActiveOrbitShot | null = null;
  private readonly cinematics: CinematicsSetting;
  private debugSnapshot: PresentationCameraDebugSnapshot = createEmptyDebugSnapshot();
  private readonly completedEventShotKeys = new Set<string>();
  private readonly playDirection: Vector2;
  private lastCompletedPrePlayKey: string | null = null;
  private lastCompletedTouchdownResultId: number | null = null;
  private readonly sidelineDirection: Vector2;
  private phase: PresentationCameraPhase = 'preSnapEstablish';
  private phaseElapsedSeconds = 0;
  private previousPlayState: PlayState | null = null;
  private returnToPreSnapSeconds = 0;
  private readonly shotPreview: PresentationOrbitShotName | null;
  private smoothedPosition = new THREE.Vector3();
  private smoothedTarget = new THREE.Vector3();
  private transitionToGameplaySeconds = 0;
  private initialized = false;

  constructor(options: PresentationCameraConfig | PresentationCameraDirectorOptions = {}) {
    const normalizedOptions = isPresentationCameraConfig(options)
      ? { config: options }
      : options;

    this.config = normalizedOptions.config ?? PRESENTATION_CAMERA_CONFIG;
    this.cinematics = normalizedOptions.cinematics ?? 'off';
    this.shotPreview = normalizedOptions.shotPreview ?? null;
    this.playDirection = normalizeDirection(this.config.playDirection);
    this.sidelineDirection = { x: this.playDirection.z, z: -this.playDirection.x };
  }

  private readonly config: PresentationCameraConfig;

  reset(): void {
    this.activeOrbitShot = null;
    this.completedEventShotKeys.clear();
    this.phase = 'preSnapEstablish';
    this.phaseElapsedSeconds = 0;
    this.previousPlayState = null;
    this.returnToPreSnapSeconds = 0;
    this.transitionToGameplaySeconds = 0;
    this.initialized = false;
  }

  hasActiveOrbitShot(): boolean {
    return this.activeOrbitShot !== null;
  }

  skipActiveShot(): boolean {
    if (!this.activeOrbitShot) {
      return false;
    }

    this.markOrbitShotCompleted(this.activeOrbitShot);
    this.activeOrbitShot = null;
    return true;
  }

  update(
    snapshot: GameplaySnapshot,
    camera: THREE.PerspectiveCamera,
    deltaSeconds: number,
    options: PresentationCameraUpdateOptions = {},
  ): PresentationCameraDebugSnapshot {
    const delta = clamp(deltaSeconds, 0, this.config.maxDeltaSeconds);

    this.updateTransitionTimers(snapshot, delta);
    const formationBounds = calculateFormationBounds(snapshot.players);
    const orbitShot = this.updateOrbitShot(snapshot, formationBounds, delta, options);

    if (orbitShot) {
      this.phase = orbitShot.phase;
      camera.fov = smoothNumber(
        camera.fov || this.config.fieldOfView,
        orbitShot.fieldOfView,
        this.config.positionSmoothing,
        delta,
      );
      camera.updateProjectionMatrix();
      this.applyShot(camera, orbitShot, delta);
      this.previousPlayState = snapshot.playState;

      this.debugSnapshot = {
        activeShotName: orbitShot.activeShotName,
        cameraPosition: toPlainVector(camera.position),
        focusTarget: toPlainVector(orbitShot.focus),
        formationBounds,
        lookTarget: toPlainVector(this.smoothedTarget),
        orbitCenter: orbitShot.orbitCenter ? toPlainVector(orbitShot.orbitCenter) : null,
        orbitRadius: orbitShot.orbitRadius,
        phase: this.phase,
        restoreCamera: orbitShot.restoreCamera,
        shotProgress: orbitShot.shotProgress,
      };

      this.completeOrbitShotIfFinished(orbitShot);

      return this.getDebugSnapshot();
    }

    const nextPhase = this.selectPhase(snapshot);

    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.phaseElapsedSeconds = 0;
    } else {
      this.phaseElapsedSeconds += delta;
    }

    const shot = this.createShot(snapshot, formationBounds, this.phase);

    camera.fov = smoothNumber(
      camera.fov || this.config.fieldOfView,
      shot.fieldOfView,
      this.config.positionSmoothing,
      delta,
    );
    camera.updateProjectionMatrix();
    this.applyShot(camera, shot, delta);
    this.previousPlayState = snapshot.playState;

    this.debugSnapshot = {
      activeShotName: shot.activeShotName,
      cameraPosition: toPlainVector(camera.position),
      focusTarget: toPlainVector(shot.focus),
      formationBounds,
      lookTarget: toPlainVector(this.smoothedTarget),
      orbitCenter: shot.orbitCenter ? toPlainVector(shot.orbitCenter) : null,
      orbitRadius: shot.orbitRadius,
      phase: this.phase,
      restoreCamera: shot.restoreCamera,
      shotProgress: shot.shotProgress,
    };

    return this.getDebugSnapshot();
  }

  getDebugSnapshot(): PresentationCameraDebugSnapshot {
    return {
      activeShotName: this.debugSnapshot.activeShotName,
      cameraPosition: { ...this.debugSnapshot.cameraPosition },
      focusTarget: { ...this.debugSnapshot.focusTarget },
      formationBounds: cloneFieldPlaneBounds(this.debugSnapshot.formationBounds),
      lookTarget: { ...this.debugSnapshot.lookTarget },
      orbitCenter: this.debugSnapshot.orbitCenter ? { ...this.debugSnapshot.orbitCenter } : null,
      orbitRadius: this.debugSnapshot.orbitRadius,
      phase: this.debugSnapshot.phase,
      restoreCamera: this.debugSnapshot.restoreCamera,
      shotProgress: this.debugSnapshot.shotProgress,
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

      if (this.config.holdPreSnapEstablish) {
        return 'preSnapEstablish';
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

    return this.createStaticShot({
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position,
    });
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

    return this.createStaticShot({
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    });
  }

  private createCarrierShot(
    snapshot: GameplaySnapshot,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const carrier = getBallCarrier(snapshot) ?? snapshot.player;
    const config = this.config.phases[phase];
    const focus = this.createFieldFocus(carrier.position.x, carrier.position.z, 1.3);

    return this.createStaticShot({
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    });
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

    return this.createStaticShot({
      focus,
      lookTarget,
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    });
  }

  private createDeadBallShot(
    snapshot: GameplaySnapshot,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const config = this.config.phases[phase];
    const spot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.nextSnapSpot;
    const focus = this.createFieldFocus(spot.x, spot.z, 1.2);

    return this.createStaticShot({
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    });
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

    return this.createStaticShot({
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position,
    });
  }

  private createReturnToPreSnapShot(
    snapshot: GameplaySnapshot,
    _formationBounds: FieldPlaneBounds,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    const config = this.config.phases[phase];
    const snap = snapshot.nextSnapSpot ?? snapshot.drive.lineOfScrimmage;
    const focus = this.createFieldFocus(snap.x, snap.z, 1.2);

    return this.createStaticShot({
      focus,
      lookTarget: this.createForwardTarget(focus, config.lookAhead),
      phase,
      position: this.offsetFromFocus(focus, {
        distanceBehind: config.distance,
        height: config.height,
      }),
    });
  }

  private createStaticShot(options: {
    focus: THREE.Vector3;
    lookTarget: THREE.Vector3;
    phase: PresentationCameraPhase;
    position: THREE.Vector3;
  }): PresentationCameraShot {
    return {
      activeShotName: null,
      fieldOfView: this.config.fieldOfView,
      focus: options.focus,
      lookTarget: options.lookTarget,
      orbitCenter: null,
      orbitRadius: null,
      phase: options.phase,
      position: this.preventCameraClipping(options.position),
      restoreCamera: null,
      shotProgress: null,
    };
  }

  private updateOrbitShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    deltaSeconds: number,
    options: PresentationCameraUpdateOptions,
  ): PresentationCameraShot | null {
    if (this.activeOrbitShot?.name === 'prePlayOrbit180' && snapshot.playState !== 'preSnap') {
      this.markOrbitShotCompleted(this.activeOrbitShot);
      this.activeOrbitShot = null;
    }

    if (!this.activeOrbitShot) {
      this.maybeStartOrbitShot(snapshot, formationBounds, options);
    }

    if (!this.activeOrbitShot) {
      return null;
    }

    this.activeOrbitShot.elapsedSeconds += deltaSeconds;
    return this.createOrbitShot(
      snapshot,
      formationBounds,
      this.activeOrbitShot,
      options.aspectRatio ?? 16 / 9,
      options.restoreCameraMode ?? null,
    );
  }

  private maybeStartOrbitShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    options: PresentationCameraUpdateOptions,
  ): void {
    if (this.shotPreview) {
      this.activeOrbitShot = {
        elapsedSeconds: 0,
        key: `preview:${this.shotPreview}`,
        name: this.shotPreview,
        preview: true,
      };
      return;
    }

    const cutawayEvent = selectHighestPriorityCutawayEvent(options.presentationEvents ?? []);
    if (
      cutawayEvent &&
      snapshot.playState === 'dead' &&
      this.cinematics === 'full' &&
      options.crowdCutawaysEnabled !== false
    ) {
      const cutawayName = cutawayEvent.type === 'touchdown'
        ? 'touchdownCrowdCutaway'
        : 'firstDownCrowdCutaway';
      const cutawayKey = `${cutawayName}:${cutawayEvent.id}`;

      if (!this.completedEventShotKeys.has(cutawayKey)) {
        this.activeOrbitShot = {
          elapsedSeconds: 0,
          key: cutawayKey,
          lockedCenter: this.createCrowdCutawayCenter(cutawayEvent, snapshot),
          name: cutawayName,
          preview: false,
          resultCenter: this.createResultSpotCenter(cutawayEvent, snapshot),
          resultId: cutawayEvent.playResult?.id,
        };
        return;
      }
    }

    if (this.cinematics === 'off') {
      return;
    }

    if (snapshot.playState === 'preSnap') {
      const prePlayKey = createPrePlayShotKey(snapshot, formationBounds);
      if (prePlayKey !== this.lastCompletedPrePlayKey) {
        this.activeOrbitShot = {
          elapsedSeconds: 0,
          key: prePlayKey,
          name: 'prePlayOrbit180',
          preview: false,
        };
      }
      return;
    }

    const touchdownResultId = snapshot.lastPlayResult?.type === 'touchdown'
      ? snapshot.lastPlayResult.id
      : null;
    if (
      snapshot.playState === 'dead' &&
      touchdownResultId !== null &&
      touchdownResultId !== this.lastCompletedTouchdownResultId
    ) {
      this.activeOrbitShot = {
        elapsedSeconds: 0,
        key: String(touchdownResultId),
        lockedCenter: this.createTouchdownOrbitCenter(snapshot),
        name: 'touchdownOrbit360',
        preview: false,
        resultId: touchdownResultId,
      };
    }
  }

  private createOrbitShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    activeShot: ActiveOrbitShot,
    aspectRatio: number,
    restoreCameraMode: string | null,
  ): PresentationCameraShot {
    if (
      activeShot.name === 'firstDownCrowdCutaway' ||
      activeShot.name === 'touchdownCrowdCutaway'
    ) {
      return this.createCrowdCutawayShot(activeShot, aspectRatio, restoreCameraMode);
    }

    const config = this.config.cinematics[activeShot.name];
    const duration = this.cinematics === 'full'
      ? config.fullDuration
      : config.briefDuration;
    const rawProgress = clamp(activeShot.elapsedSeconds / Math.max(0.001, duration), 0, 1);
    const progress = easeInOutCubic(rawProgress);
    const sweepRadians = THREE.MathUtils.degToRad(
      this.cinematics === 'full'
        ? config.fullSweepDegrees
        : config.briefSweepDegrees,
    );
    const center = activeShot.lockedCenter
      ? activeShot.lockedCenter.clone()
      : activeShot.name === 'prePlayOrbit180'
      ? this.createPrePlayOrbitCenter(formationBounds)
      : this.createTouchdownOrbitCenter(snapshot);
    const phase: PresentationCameraPhase = activeShot.name === 'prePlayOrbit180'
      ? 'preSnapEstablish'
      : 'touchdownResult';
    const focus = this.createFieldFocus(center.x, center.z, center.y);
    const radius = this.calculateOrbitRadius(activeShot.name, formationBounds, aspectRatio);
    const startAngle = activeShot.name === 'prePlayOrbit180' ? -sweepRadians : 0;
    const angle = startAngle + sweepRadians * progress;
    const position = this.createOrbitPosition(center, radius, angle, config.height);
    const lookTarget = activeShot.name === 'prePlayOrbit180'
      ? this.createForwardTarget(focus, config.lookAhead * (1 - progress))
      : this.createForwardTarget(focus, config.lookAhead);

    return {
      activeShotName: activeShot.name,
      fieldOfView: config.fieldOfView,
      focus,
      lookTarget,
      orbitCenter: center.clone(),
      orbitRadius: radius,
      phase,
      position: this.preventCameraClipping(position),
      restoreCamera: restoreCameraMode,
      shotProgress: rawProgress,
    };
  }

  private createCrowdCutawayShot(
    activeShot: ActiveOrbitShot,
    aspectRatio: number,
    restoreCameraMode: string | null,
  ): PresentationCameraShot {
    const config = this.config.cinematics[activeShot.name];
    const duration = this.cinematics === 'full'
      ? config.fullDuration
      : config.briefDuration;
    const rawProgress = clamp(activeShot.elapsedSeconds / Math.max(0.001, duration), 0, 1);
    const progress = easeInOutCubic(rawProgress);
    const center = activeShot.lockedCenter ?? new THREE.Vector3(0, 5.2, 0);
    const sideSign = this.getSidelineSign(center);
    const radius = clamp(
      config.distance * (aspectRatio < 0.75 ? 1.18 : 1),
      config.minimumRadius,
      config.maximumRadius,
    );
    const sweepRadians = THREE.MathUtils.degToRad(
      this.cinematics === 'full'
        ? config.fullSweepDegrees
        : config.briefSweepDegrees,
    );
    const lateralDrift = Math.sin(-sweepRadians / 2 + sweepRadians * progress) * 3.5;
    const position = new THREE.Vector3(
      center.x - this.sidelineDirection.x * sideSign * radius + this.playDirection.x * lateralDrift,
      config.height,
      center.z - this.sidelineDirection.z * sideSign * radius + this.playDirection.z * lateralDrift,
    );
    const phase: PresentationCameraPhase = activeShot.name === 'touchdownCrowdCutaway'
      ? 'touchdownResult'
      : 'deadBallResult';
    const focus = center.clone();
    const lookTarget = new THREE.Vector3(center.x, center.y + 0.5, center.z);

    return {
      activeShotName: activeShot.name,
      fieldOfView: config.fieldOfView,
      focus,
      lookTarget,
      orbitCenter: center.clone(),
      orbitRadius: radius,
      phase,
      position: this.preventCameraClipping(position),
      restoreCamera: restoreCameraMode,
      shotProgress: rawProgress,
    };
  }

  private completeOrbitShotIfFinished(shot: PresentationCameraShot): void {
    if (!this.activeOrbitShot || shot.shotProgress === null || shot.shotProgress < 1) {
      return;
    }

    const completedShot = this.activeOrbitShot;
    this.markOrbitShotCompleted(completedShot);

    if (completedShot.preview) {
      return;
    }

    if (
      completedShot.name === 'touchdownCrowdCutaway' &&
      completedShot.resultId !== undefined &&
      !this.completedEventShotKeys.has(`touchdownOrbit360:${completedShot.resultId}`)
    ) {
      this.activeOrbitShot = {
        elapsedSeconds: 0,
        key: String(completedShot.resultId),
        lockedCenter: completedShot.resultCenter,
        name: 'touchdownOrbit360',
        preview: false,
        resultId: completedShot.resultId,
      };
      return;
    }

    this.activeOrbitShot = null;
  }

  private markOrbitShotCompleted(activeShot: ActiveOrbitShot): void {
    if (activeShot.preview) {
      return;
    }

    if (activeShot.name === 'prePlayOrbit180') {
      this.lastCompletedPrePlayKey = activeShot.key;
      return;
    }

    if (
      activeShot.name === 'firstDownCrowdCutaway' ||
      activeShot.name === 'touchdownCrowdCutaway'
    ) {
      this.completedEventShotKeys.add(activeShot.key);
      return;
    }

    this.completedEventShotKeys.add(`${activeShot.name}:${activeShot.resultId ?? activeShot.key}`);
    this.lastCompletedTouchdownResultId = activeShot.resultId ?? Number(activeShot.key);
  }

  private createPrePlayOrbitCenter(formationBounds: FieldPlaneBounds): THREE.Vector3 {
    return new THREE.Vector3(
      formationBounds.center.x,
      1.45,
      formationBounds.center.z,
    );
  }

  private createTouchdownOrbitCenter(snapshot: GameplaySnapshot): THREE.Vector3 {
    const spot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.player.position;
    const scorer = getBallCarrier(snapshot) ?? snapshot.player;
    const x = snapshot.lastPlayResult?.type === 'touchdown'
      ? spot.x
      : scorer.position.x;
    const z = snapshot.lastPlayResult?.type === 'touchdown'
      ? spot.z
      : scorer.position.z;

    return new THREE.Vector3(x, 1.55, z);
  }

  private createCrowdCutawayCenter(
    event: PresentationAudioEvent,
    snapshot: GameplaySnapshot,
  ): THREE.Vector3 {
    const spot = event.playResult?.endingBallSpot ??
      snapshot.lastPlayResult?.endingBallSpot ??
      snapshot.nextSnapSpot;
    const sideSign = spot.x >= 0 ? 1 : -1;
    const sidelineDistance = FIELD_DIMENSIONS.fieldWidth / 2 + 22;
    const downfield = clamp(spot.z, FIELD_BOUNDS.minZ + 12, FIELD_BOUNDS.maxZ - 12);

    return new THREE.Vector3(
      this.sidelineDirection.x * sideSign * sidelineDistance + this.playDirection.x * downfield,
      5.25,
      this.sidelineDirection.z * sideSign * sidelineDistance + this.playDirection.z * downfield,
    );
  }

  private createResultSpotCenter(
    event: PresentationAudioEvent,
    snapshot: GameplaySnapshot,
  ): THREE.Vector3 {
    const spot = event.playResult?.endingBallSpot ??
      snapshot.lastPlayResult?.endingBallSpot ??
      snapshot.player.position;

    return new THREE.Vector3(spot.x, 1.55, spot.z);
  }

  private getSidelineSign(point: THREE.Vector3): -1 | 1 {
    const sidelineProjection =
      point.x * this.sidelineDirection.x +
      point.z * this.sidelineDirection.z;

    return sidelineProjection >= 0 ? 1 : -1;
  }

  private calculateOrbitRadius(
    shotName: PresentationOrbitShotName,
    formationBounds: FieldPlaneBounds,
    aspectRatio: number,
  ): number {
    const config = this.config.cinematics[shotName];
    const aspectScale = aspectRatio < 0.75 ? 1.22 : 1;
    const boundsRadius = shotName === 'prePlayOrbit180'
      ? Math.max(formationBounds.size.x * 0.62, formationBounds.size.z * 0.92)
      : 0;

    return clamp(
      Math.max(config.minimumRadius, config.distance, boundsRadius) * aspectScale,
      config.minimumRadius,
      config.maximumRadius,
    );
  }

  private createOrbitPosition(
    center: THREE.Vector3,
    radius: number,
    angleRadians: number,
    height: number,
  ): THREE.Vector3 {
    const sidelineWeight = Math.sin(angleRadians) * radius;
    const playDirectionWeight = -Math.cos(angleRadians) * radius;

    return new THREE.Vector3(
      center.x +
        this.sidelineDirection.x * sidelineWeight +
        this.playDirection.x * playDirectionWeight,
      height,
      center.z +
        this.sidelineDirection.z * sidelineWeight +
        this.playDirection.z * playDirectionWeight,
    );
  }

  private preventCameraClipping(position: THREE.Vector3): THREE.Vector3 {
    const padding = this.config.cinematics.fieldPadding;

    return new THREE.Vector3(
      clamp(position.x, FIELD_BOUNDS.minX - padding, FIELD_BOUNDS.maxX + padding),
      Math.max(this.config.cinematics.minimumCameraHeight, position.y),
      clamp(position.z, FIELD_BOUNDS.minZ - padding, FIELD_BOUNDS.maxZ + padding),
    );
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

function selectHighestPriorityCutawayEvent(
  events: readonly PresentationAudioEvent[],
): PresentationAudioEvent | null {
  let selected: PresentationAudioEvent | null = null;
  let selectedPriority = 0;

  for (const event of events) {
    const priority = event.type === 'touchdown'
      ? 2
      : event.type === 'firstDown'
        ? 1
        : 0;

    if (priority > selectedPriority) {
      selected = event;
      selectedPriority = priority;
    }
  }

  return selected;
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

function smoothNumber(
  current: number,
  target: number,
  smoothing: number,
  deltaSeconds: number,
): number {
  return current + (target - current) * calculateSmoothingAlpha(smoothing, deltaSeconds);
}

function calculateSmoothingAlpha(smoothing: number, deltaSeconds: number): number {
  return 1 - Math.exp(-smoothing * Math.max(0, deltaSeconds));
}

function easeInOutCubic(value: number): number {
  const t = clamp(value, 0, 1);

  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createPrePlayShotKey(
  snapshot: GameplaySnapshot,
  formationBounds: FieldPlaneBounds,
): string {
  return [
    snapshot.selectedPlay.id,
    snapshot.nextSnapSpot.x.toFixed(2),
    snapshot.nextSnapSpot.z.toFixed(2),
    formationBounds.center.x.toFixed(2),
    formationBounds.center.z.toFixed(2),
    formationBounds.size.x.toFixed(2),
    formationBounds.size.z.toFixed(2),
    formationBounds.playerIds.join(','),
  ].join('|');
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
    activeShotName: null,
    cameraPosition: { x: 0, y: 0, z: 0 },
    focusTarget: { x: 0, y: 0, z: 0 },
    formationBounds: emptyBounds,
    lookTarget: { x: 0, y: 0, z: 0 },
    orbitCenter: null,
    orbitRadius: null,
    phase: 'preSnapEstablish',
    restoreCamera: null,
    shotProgress: null,
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

function isPresentationCameraConfig(
  value: PresentationCameraConfig | PresentationCameraDirectorOptions,
): value is PresentationCameraConfig {
  return 'phases' in value && 'playDirection' in value;
}
