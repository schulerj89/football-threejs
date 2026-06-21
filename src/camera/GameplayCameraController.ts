import type { Camera } from 'three';
import type { GameplaySnapshot } from '../playState';
import { GAMEPLAY_CAMERA_CONFIG, PRESENTATION_CAMERA_CONFIG } from './CameraConfiguration';
import { resolveOffensePerspectiveFocus } from './CameraFocusResolver';
import { normalizeDirection, toPlainVector } from './CameraMath';
import { GameplayCameraRig } from './CameraRig';
import { resolveCameraShotPolicy } from './CameraShotPolicy';
import type {
  CameraShotPolicy,
  CameraTargetChangeReason,
  CinematicsSetting,
  GameplayCameraFocus,
  GameplayCameraDebugSnapshot,
  GameplayCameraMode,
  GameplayCameraState,
  GameplayCameraControllerOptions,
  GameplayCameraUpdateOptions,
  PresentationCameraDebugSnapshot,
  PresentationOrbitShotName,
} from './CameraTypes';
import { PresentationCameraDirector } from './PresentationCameraDirector';

export type {
  CinematicsSetting,
  GameplayCameraDebugSnapshot,
  GameplayCameraMode,
  GameplayCameraState,
  GameplayCameraControllerOptions,
  GameplayCameraUpdateOptions,
} from './CameraTypes';
export { GAMEPLAY_CAMERA_CONFIG } from './CameraConfiguration';

export class GameplayCameraController {
  private readonly cinematics: CinematicsSetting;
  private cinematicDebug: PresentationCameraDebugSnapshot;
  private cameraState: GameplayCameraState = 'tacticalOverview';
  private isPerspectiveInitialized = false;
  private mode: GameplayCameraMode;
  private readonly playDirection = normalizeDirection(GAMEPLAY_CAMERA_CONFIG.playDirection);
  private readonly presentationDirector: PresentationCameraDirector;
  private presentationOverrideActive = false;
  private lastGameplayFocus: GameplayCameraFocus | null = null;
  private previousActiveShotName: GameplayCameraDebugSnapshot['activeShotName'] = null;
  private previousPreSnapAnchorKey: string | null = null;
  private previousPlayState: GameplaySnapshot['playState'] | null = null;
  private previousSelectedPlayId: string | null = null;
  private preSnapSequenceId = 0;
  private resetLineOfScrimmageSeconds = 0;
  private readonly rig: GameplayCameraRig;
  private readonly shotPreview: PresentationOrbitShotName | null;
  private stabilityReason: CameraTargetChangeReason = 'initial';

  constructor({
    cinematics = 'off',
    height,
    holdCinematicPreSnapEstablish = false,
    initialMode = 'tacticalOrthographic',
    shotPreview = null,
    width,
  }: GameplayCameraControllerOptions) {
    this.cinematics = cinematics;
    this.shotPreview = shotPreview;
    this.presentationDirector = new PresentationCameraDirector({
      cinematics,
      config: holdCinematicPreSnapEstablish
        ? { ...PRESENTATION_CAMERA_CONFIG, holdPreSnapEstablish: true }
        : PRESENTATION_CAMERA_CONFIG,
      shotPreview,
    });
    this.cinematicDebug = this.presentationDirector.getDebugSnapshot();
    this.mode = initialMode;
    this.rig = new GameplayCameraRig(width, height);
  }

  get camera(): Camera {
    return this.rig.getActiveCamera(this.mode, this.presentationOverrideActive);
  }

  getMode(): GameplayCameraMode {
    return this.mode;
  }

  setMode(mode: GameplayCameraMode, snapshot?: GameplaySnapshot): void {
    if (this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.presentationOverrideActive = false;
    this.presentationDirector.reset();
    this.cinematicDebug = this.presentationDirector.getDebugSnapshot();

    if (mode === 'offensePerspective') {
      this.isPerspectiveInitialized = false;
    }

    if (snapshot) {
      this.update(snapshot, 0);
    }
  }

  toggleMode(snapshot?: GameplaySnapshot): GameplayCameraMode {
    const nextMode = this.mode === 'tacticalOrthographic'
      ? 'offensePerspective'
      : this.mode === 'offensePerspective'
        ? 'cinematicBroadcast'
        : 'tacticalOrthographic';
    this.setMode(nextMode, snapshot);
    return nextMode;
  }

  resize(width: number, height: number): void {
    this.rig.resize(width, height);
  }

  resetPresentation(): void {
    this.presentationDirector.reset();
    this.presentationOverrideActive = false;
    this.cinematicDebug = this.presentationDirector.getDebugSnapshot();
  }

  skipPresentationShot(): boolean {
    const skipped = this.presentationDirector.skipActiveShot();
    this.presentationOverrideActive = false;
    this.cinematicDebug = this.presentationDirector.getDebugSnapshot();
    return skipped;
  }

  update(
    snapshot: GameplaySnapshot,
    deltaSeconds: number,
    options: GameplayCameraUpdateOptions = {},
  ): void {
    const cameraDeltaSeconds = Math.min(
      Math.max(0, deltaSeconds),
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.maxDeltaSeconds,
    );
    const targetChangeReason = this.updatePreSnapSequenceTracking(snapshot);

    if (this.previousPlayState === 'dead' && snapshot.playState === 'preSnap') {
      this.resetLineOfScrimmageSeconds = 0.7;
    }

    if (this.updatePresentationOverride(snapshot, cameraDeltaSeconds, options)) {
      this.finishCameraUpdate(snapshot, targetChangeReason);
      return;
    }

    if (this.mode === 'tacticalOrthographic') {
      this.cameraState = 'tacticalOverview';
      this.lastGameplayFocus = null;
      this.rig.positionTacticalCamera();
    } else if (this.mode === 'cinematicBroadcast') {
      this.updateCinematicBroadcastCamera(snapshot, cameraDeltaSeconds, options);
    } else {
      this.updateOffensePerspectiveCamera(snapshot, cameraDeltaSeconds);
    }

    this.finishCameraUpdate(snapshot, targetChangeReason);
  }

  getDebugSnapshot(): GameplayCameraDebugSnapshot {
    const activeCamera = this.camera;
    const lookTargetPosition = toPlainVector(this.rig.smoothedTarget);

    const baseSnapshot: GameplayCameraDebugSnapshot = {
      cameraPosition: toPlainVector(activeCamera.position),
      focusLookAhead: this.lastGameplayFocus?.lookAhead,
      focusPhase: this.lastGameplayFocus?.phase,
      focusPosition: toPlainVector(this.rig.smoothedFocus),
      focusSource: this.lastGameplayFocus?.focusSource,
      lookTargetPosition,
      mode: this.mode,
      state: this.cameraState,
      stability: this.createStabilityDebugSnapshot(),
      targetPosition: this.lastGameplayFocus?.framingTargetPosition ?? lookTargetPosition,
    };

    if (this.mode !== 'cinematicBroadcast' && !this.presentationOverrideActive) {
      return baseSnapshot;
    }

    return {
      ...baseSnapshot,
      activeShotName: this.cinematicDebug.activeShotName,
      formationBounds: this.cinematicDebug.formationBounds,
      focusPosition: this.cinematicDebug.focusTarget,
      lookTargetPosition: this.cinematicDebug.lookTarget,
      orbitCenter: this.cinematicDebug.orbitCenter,
      orbitRadius: this.cinematicDebug.orbitRadius,
      presentationPhase: this.cinematicDebug.phase,
      restoreCamera: this.cinematicDebug.restoreCamera,
      shotProgress: this.cinematicDebug.shotProgress,
      stability: this.createStabilityDebugSnapshot(),
      targetPosition: this.cinematicDebug.lookTarget,
    };
  }

  private updateOffensePerspectiveCamera(snapshot: GameplaySnapshot, deltaSeconds: number): void {
    const framing = resolveOffensePerspectiveFocus({
      deltaSeconds,
      resetLineOfScrimmageSeconds: this.resetLineOfScrimmageSeconds,
      snapshot,
    });
    this.resetLineOfScrimmageSeconds = framing.nextResetLineOfScrimmageSeconds;
    this.lastGameplayFocus = framing;
    this.rig.applyOffensePerspective(
      framing,
      this.playDirection,
      this.isPerspectiveInitialized,
      deltaSeconds,
    );
    this.cameraState = framing.state;
    this.isPerspectiveInitialized = true;
  }

  private updateCinematicBroadcastCamera(
    snapshot: GameplaySnapshot,
    deltaSeconds: number,
    options: GameplayCameraUpdateOptions,
  ): void {
    this.cinematicDebug = this.presentationDirector.update(
      snapshot,
      this.rig.perspectiveCamera,
      deltaSeconds,
      {
        aspectRatio: this.rig.activeAspectRatio,
        cameraShotPolicy: this.getCameraShotPolicy(),
        crowdCutawaysEnabled: options.crowdCutawaysEnabled,
        presentationEvents: options.presentationEvents,
        restoreCameraMode: this.mode,
      },
    );
    this.cameraState = 'cinematicBroadcast';
    this.lastGameplayFocus = null;
    this.rig.usePresentationTargets(this.cinematicDebug.focusTarget, this.cinematicDebug.lookTarget);
  }

  private updatePresentationOverride(
    snapshot: GameplaySnapshot,
    deltaSeconds: number,
    options: GameplayCameraUpdateOptions,
  ): boolean {
    const policy = this.getCameraShotPolicy();
    const allowDebugPreview = this.shotPreview !== null;

    if (
      this.mode === 'cinematicBroadcast' ||
      (!policy.allowPerspectiveOverride && !allowDebugPreview)
    ) {
      if (this.presentationOverrideActive) {
        this.presentationDirector.reset();
        this.cinematicDebug = this.presentationDirector.getDebugSnapshot();
      }
      this.presentationOverrideActive = false;
      return false;
    }

    this.cinematicDebug = this.presentationDirector.update(
      snapshot,
      this.rig.perspectiveCamera,
      deltaSeconds,
      {
        aspectRatio: this.rig.activeAspectRatio,
        cameraShotPolicy: policy,
        crowdCutawaysEnabled: options.crowdCutawaysEnabled,
        presentationEvents: options.presentationEvents,
        restoreCameraMode: this.mode,
      },
    );

    this.presentationOverrideActive = this.cinematicDebug.activeShotName !== null;
    if (!this.presentationOverrideActive) {
      return false;
    }

    this.cameraState = 'cinematicBroadcast';
    this.lastGameplayFocus = null;
    this.rig.usePresentationTargets(this.cinematicDebug.focusTarget, this.cinematicDebug.lookTarget);

    if (this.mode === 'offensePerspective') {
      this.isPerspectiveInitialized = true;
    }

    return true;
  }

  private getCameraShotPolicy(): CameraShotPolicy {
    return resolveCameraShotPolicy(this.mode, this.cinematics);
  }

  private createStabilityDebugSnapshot(): GameplayCameraDebugSnapshot['stability'] {
    const activeShot = (this.mode === 'cinematicBroadcast' || this.presentationOverrideActive)
      ? this.cinematicDebug.activeShotName
      : null;
    const metrics = (this.mode === 'cinematicBroadcast' || this.presentationOverrideActive)
      ? {
        desiredCameraPosition: this.cinematicDebug.desiredCameraPosition,
        desiredLookTarget: this.cinematicDebug.desiredLookTarget,
        perFrameAngularChange: this.cinematicDebug.perFrameAngularChange,
        perFrameDisplacement: this.cinematicDebug.perFrameDisplacement,
      }
      : this.rig.getStabilityMetrics();
    const activeCamera = this.camera;

    return {
      activeShot,
      cameraPosition: toPlainVector(activeCamera.position),
      desiredCameraPosition: { ...metrics.desiredCameraPosition },
      desiredLookTarget: { ...metrics.desiredLookTarget },
      lookTarget: (this.mode === 'cinematicBroadcast' || this.presentationOverrideActive)
        ? { ...this.cinematicDebug.lookTarget }
        : toPlainVector(this.rig.smoothedTarget),
      perFrameAngularChange: metrics.perFrameAngularChange,
      perFrameDisplacement: metrics.perFrameDisplacement,
      preSnapSequenceId: (this.mode === 'cinematicBroadcast' || this.presentationOverrideActive)
        ? this.cinematicDebug.preSnapSequenceId
        : this.preSnapSequenceId,
      reasonCameraTargetChanged: this.stabilityReason,
      selectedPlayId: this.previousSelectedPlayId ?? '',
    };
  }

  private updatePreSnapSequenceTracking(snapshot: GameplaySnapshot): CameraTargetChangeReason {
    const selectedPlayChanged = this.previousSelectedPlayId !== null &&
      this.previousSelectedPlayId !== snapshot.selectedPlay.id;

    if (snapshot.playState !== 'preSnap') {
      if (this.previousPlayState !== null && this.previousPlayState !== snapshot.playState) {
        return 'playStateChanged';
      }

      return selectedPlayChanged ? 'selectedPlayChangedPreservedAnchor' : 'stable';
    }

    const anchorKey = createPreSnapAnchorKey(snapshot);
    if (this.previousPlayState !== 'preSnap') {
      this.preSnapSequenceId += 1;
      this.previousPreSnapAnchorKey = anchorKey;
      return 'preSnapSequenceChanged';
    }

    if (anchorKey !== this.previousPreSnapAnchorKey) {
      this.preSnapSequenceId += 1;
      this.previousPreSnapAnchorKey = anchorKey;
      return 'snapLocationChanged';
    }

    if (selectedPlayChanged) {
      return 'selectedPlayChangedPreservedAnchor';
    }

    return 'stable';
  }

  private finishCameraUpdate(
    snapshot: GameplaySnapshot,
    targetChangeReason: CameraTargetChangeReason,
  ): void {
    const activeShot = (this.mode === 'cinematicBroadcast' || this.presentationOverrideActive)
      ? this.cinematicDebug.activeShotName
      : null;
    this.stabilityReason = this.previousActiveShotName !== activeShot
      ? 'activeShotChanged'
      : targetChangeReason;
    this.previousActiveShotName = activeShot;
    this.previousPlayState = snapshot.playState;
    this.previousSelectedPlayId = snapshot.selectedPlay.id;
  }
}

function createPreSnapAnchorKey(snapshot: GameplaySnapshot): string {
  return [
    snapshot.playbookId,
    snapshot.snapLane,
    snapshot.nextSnapSpot.x.toFixed(2),
    snapshot.nextSnapSpot.z.toFixed(2),
    snapshot.drive.currentDown,
    snapshot.drive.yardsToFirstDown.toFixed(2),
    snapshot.score,
  ].join('|');
}

export function resolveGameplayCameraMode(value: string | null): GameplayCameraMode {
  if (value === 'cinematic' || value === 'cinematicBroadcast') {
    return 'cinematicBroadcast';
  }

  if (value === 'offense' || value === 'offensePerspective') {
    return 'offensePerspective';
  }

  return 'tacticalOrthographic';
}

export function resolveCinematicsSetting(value: string | null): CinematicsSetting {
  if (value === 'off' || value === 'brief' || value === 'full') {
    return value;
  }

  return 'off';
}

export function resolvePresentationShotPreview(
  value: string | null,
): PresentationOrbitShotName | null {
  if (value === 'prePlayOrbit180' || value === 'touchdownOrbit360') {
    return value;
  }

  if (value === 'firstDownCrowdCutaway' || value === 'touchdownCrowdCutaway') {
    return value;
  }

  return null;
}
