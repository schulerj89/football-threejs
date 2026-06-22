import * as THREE from 'three';
import type { GameplaySnapshot } from '../playState';
import { PRESENTATION_CAMERA_CONFIG } from './CameraConfiguration';
import { calculateFormationBounds } from './CameraFocusResolver';
import { cloneFieldPlaneBounds, clamp, normalizeDirection, smoothNumber, toPlainVector } from './CameraMath';
import { PresentationCameraRig } from './CameraRig';
import type {
  CinematicsSetting,
  PresentationCameraConfig,
  PresentationCameraDebugSnapshot,
  PresentationCameraDirectorOptions,
  PresentationCameraUpdateOptions,
} from './CameraTypes';
import type { PresentationCameraShot } from './PresentationShotDefinitions';
import { PresentationShotFactory } from './PresentationShotDefinitions';
import { PresentationShotSequencer } from './PresentationShotSequencer';

export { PRESENTATION_CAMERA_CONFIG } from './CameraConfiguration';
export { calculateFormationBounds } from './CameraFocusResolver';
export type {
  CinematicsSetting,
  FieldPlaneBounds,
  PresentationCameraConfig,
  PresentationCameraDebugSnapshot,
  PresentationCameraDirectorOptions,
  PresentationCameraPhase,
  PresentationCameraShotConfig,
  PresentationCameraUpdateOptions,
  PresentationOrbitShotConfig,
  PresentationOrbitShotName,
} from './CameraTypes';

export class PresentationCameraDirector {
  private readonly cinematics: CinematicsSetting;
  private debugSnapshot: PresentationCameraDebugSnapshot = createEmptyDebugSnapshot();
  private readonly presentationRig = new PresentationCameraRig();
  private readonly sequencer: PresentationShotSequencer;
  private readonly shotFactory: PresentationShotFactory;
  private readonly config: PresentationCameraConfig;

  constructor(options: PresentationCameraConfig | PresentationCameraDirectorOptions = {}) {
    const normalizedOptions = isPresentationCameraConfig(options)
      ? { config: options }
      : options;

    this.config = normalizedOptions.config ?? PRESENTATION_CAMERA_CONFIG;
    this.cinematics = normalizedOptions.cinematics ?? 'off';
    const playDirection = normalizeDirection(this.config.playDirection);
    const sidelineDirection = { x: playDirection.z, z: -playDirection.x };

    this.shotFactory = new PresentationShotFactory(
      this.config,
      this.cinematics,
      playDirection,
      sidelineDirection,
    );
    this.sequencer = new PresentationShotSequencer(
      this.config,
      this.cinematics,
      normalizedOptions.shotPreview ?? null,
      this.shotFactory,
    );
  }

  reset(): void {
    this.sequencer.reset();
    this.presentationRig.reset();
    this.debugSnapshot = createEmptyDebugSnapshot();
  }

  hasActiveOrbitShot(): boolean {
    return this.sequencer.hasActiveOrbitShot();
  }

  skipActiveShot(): boolean {
    const skipped = this.sequencer.skipActiveShot();
    if (skipped) {
      this.debugSnapshot = {
        ...this.debugSnapshot,
        activeShotName: null,
        orbitCenter: null,
        orbitRadius: null,
        restoreCamera: null,
        shotProgress: null,
      };
    }
    return skipped;
  }

  update(
    snapshot: GameplaySnapshot,
    camera: THREE.PerspectiveCamera,
    deltaSeconds: number,
    options: PresentationCameraUpdateOptions = {},
  ): PresentationCameraDebugSnapshot {
    const delta = clamp(deltaSeconds, 0, this.config.maxDeltaSeconds);

    this.sequencer.updateTransitionTimers(snapshot, delta);
    const formationBounds = calculateFormationBounds(snapshot.players);
    const orbitShot = this.sequencer.updateOrbitShot(snapshot, formationBounds, delta, options);

    if (orbitShot) {
      this.sequencer.useOrbitPhase(orbitShot.phase);
      this.applyShot(camera, orbitShot, delta);
      this.sequencer.finishUpdate(snapshot.playState);
      this.debugSnapshot = createDebugSnapshot({
        activePhase: this.sequencer.currentPhase,
        camera,
        formationBounds,
        lookTarget: this.presentationRig.smoothedTarget,
        preSnapSequenceId: this.sequencer.currentPreSnapSequenceId,
        stabilityMetrics: this.presentationRig.getStabilityMetrics(),
        shot: orbitShot,
      });
      this.sequencer.completeOrbitShotIfFinished(orbitShot);

      return this.getDebugSnapshot();
    }

    const previousPhase = this.sequencer.currentPhase;
    const phase = this.sequencer.selectNextPhase(snapshot);
    if (phase === previousPhase) {
      this.sequencer.advancePhaseElapsed(delta);
    }
    const shot = this.shotFactory.createShot(snapshot, formationBounds, phase);

    this.applyShot(camera, shot, delta);
    this.sequencer.finishUpdate(snapshot.playState);
    this.debugSnapshot = createDebugSnapshot({
      activePhase: this.sequencer.currentPhase,
      camera,
      formationBounds,
      lookTarget: this.presentationRig.smoothedTarget,
      preSnapSequenceId: this.sequencer.currentPreSnapSequenceId,
      stabilityMetrics: this.presentationRig.getStabilityMetrics(),
      shot,
    });

    return this.getDebugSnapshot();
  }

  applyExternalShot(
    camera: THREE.PerspectiveCamera,
    shot: PresentationCameraShot,
    deltaSeconds: number,
    options: {
      formationBounds?: PresentationCameraDebugSnapshot['formationBounds'];
      preSnapSequenceId?: number;
    } = {},
  ): PresentationCameraDebugSnapshot {
    const delta = clamp(deltaSeconds, 0, this.config.maxDeltaSeconds);
    this.applyShot(camera, shot, delta);
    this.debugSnapshot = createDebugSnapshot({
      activePhase: shot.phase,
      camera,
      formationBounds: options.formationBounds ?? calculateFormationBounds([]),
      lookTarget: this.presentationRig.smoothedTarget,
      preSnapSequenceId: options.preSnapSequenceId ?? 0,
      stabilityMetrics: this.presentationRig.getStabilityMetrics(),
      shot,
    });
    return this.getDebugSnapshot();
  }

  getDebugSnapshot(): PresentationCameraDebugSnapshot {
    return {
      activeShotName: this.debugSnapshot.activeShotName,
      cameraPosition: { ...this.debugSnapshot.cameraPosition },
      desiredCameraPosition: { ...this.debugSnapshot.desiredCameraPosition },
      desiredLookTarget: { ...this.debugSnapshot.desiredLookTarget },
      focusTarget: { ...this.debugSnapshot.focusTarget },
      formationBounds: cloneFieldPlaneBounds(this.debugSnapshot.formationBounds),
      lookTarget: { ...this.debugSnapshot.lookTarget },
      orbitCenter: this.debugSnapshot.orbitCenter ? { ...this.debugSnapshot.orbitCenter } : null,
      orbitRadius: this.debugSnapshot.orbitRadius,
      perFrameAngularChange: this.debugSnapshot.perFrameAngularChange,
      perFrameDisplacement: this.debugSnapshot.perFrameDisplacement,
      phase: this.debugSnapshot.phase,
      preSnapSequenceId: this.debugSnapshot.preSnapSequenceId,
      restoreCamera: this.debugSnapshot.restoreCamera,
      shotProgress: this.debugSnapshot.shotProgress,
    };
  }

  private applyShot(
    camera: THREE.PerspectiveCamera,
    shot: PresentationCameraShot,
    deltaSeconds: number,
  ): void {
    camera.fov = smoothNumber(
      camera.fov || this.config.fieldOfView,
      shot.fieldOfView,
      this.config.positionSmoothing,
      deltaSeconds,
    );
    camera.updateProjectionMatrix();
    this.presentationRig.applyShot(camera, shot, this.config, deltaSeconds);
  }
}

function createDebugSnapshot({
  activePhase,
  camera,
  formationBounds,
  lookTarget,
  preSnapSequenceId,
  stabilityMetrics,
  shot,
}: {
  activePhase: PresentationCameraDebugSnapshot['phase'];
  camera: THREE.PerspectiveCamera;
  formationBounds: PresentationCameraDebugSnapshot['formationBounds'];
  lookTarget: THREE.Vector3;
  preSnapSequenceId: number;
  stabilityMetrics: ReturnType<PresentationCameraRig['getStabilityMetrics']>;
  shot: PresentationCameraShot;
}): PresentationCameraDebugSnapshot {
  return {
    activeShotName: shot.activeShotName,
    cameraPosition: toPlainVector(camera.position),
    desiredCameraPosition: stabilityMetrics.desiredCameraPosition,
    desiredLookTarget: stabilityMetrics.desiredLookTarget,
    focusTarget: toPlainVector(shot.focus),
    formationBounds,
    lookTarget: toPlainVector(lookTarget),
    orbitCenter: shot.orbitCenter ? toPlainVector(shot.orbitCenter) : null,
    orbitRadius: shot.orbitRadius,
    perFrameAngularChange: stabilityMetrics.perFrameAngularChange,
    perFrameDisplacement: stabilityMetrics.perFrameDisplacement,
    phase: activePhase,
    preSnapSequenceId,
    restoreCamera: shot.restoreCamera,
    shotProgress: shot.shotProgress,
  };
}

function createEmptyDebugSnapshot(): PresentationCameraDebugSnapshot {
  const emptyBounds = calculateFormationBounds([]);

  return {
    activeShotName: null,
    cameraPosition: { x: 0, y: 0, z: 0 },
    desiredCameraPosition: { x: 0, y: 0, z: 0 },
    desiredLookTarget: { x: 0, y: 0, z: 0 },
    focusTarget: { x: 0, y: 0, z: 0 },
    formationBounds: emptyBounds,
    lookTarget: { x: 0, y: 0, z: 0 },
    orbitCenter: null,
    orbitRadius: null,
    perFrameAngularChange: 0,
    perFrameDisplacement: 0,
    phase: 'preSnapEstablish',
    preSnapSequenceId: 0,
    restoreCamera: null,
    shotProgress: null,
  };
}

function isPresentationCameraConfig(
  value: PresentationCameraConfig | PresentationCameraDirectorOptions,
): value is PresentationCameraConfig {
  return 'phases' in value && 'playDirection' in value;
}
