import type { Camera } from 'three';
import type { GameplaySnapshot } from '../playState';
import { GAMEPLAY_CAMERA_CONFIG, PRESENTATION_CAMERA_CONFIG } from './CameraConfiguration';
import { resolveOffensePerspectiveFocus } from './CameraFocusResolver';
import { normalizeDirection, toPlainVector } from './CameraMath';
import { GameplayCameraRig } from './CameraRig';
import type {
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
  private previousPlayState: GameplaySnapshot['playState'] | null = null;
  private resetLineOfScrimmageSeconds = 0;
  private readonly rig: GameplayCameraRig;
  private readonly shotPreview: PresentationOrbitShotName | null;

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

    if (mode === 'offensePerspective') {
      this.isPerspectiveInitialized = false;
    }

    if (mode === 'cinematicBroadcast') {
      this.presentationDirector.reset();
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
    return skipped;
  }

  update(
    snapshot: GameplaySnapshot,
    deltaSeconds: number,
    options: GameplayCameraUpdateOptions = {},
  ): void {
    if (this.previousPlayState === 'dead' && snapshot.playState === 'preSnap') {
      this.resetLineOfScrimmageSeconds = 0.7;
    }

    if (this.updatePresentationOverride(snapshot, deltaSeconds, options)) {
      this.previousPlayState = snapshot.playState;
      return;
    }

    if (this.mode === 'tacticalOrthographic') {
      this.cameraState = 'tacticalOverview';
      this.lastGameplayFocus = null;
      this.rig.positionTacticalCamera();
    } else if (this.mode === 'cinematicBroadcast') {
      this.updateCinematicBroadcastCamera(snapshot, deltaSeconds, options);
    } else {
      this.updateOffensePerspectiveCamera(snapshot, deltaSeconds);
    }

    this.previousPlayState = snapshot.playState;
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
    if (
      this.mode === 'cinematicBroadcast' ||
      (this.cinematics === 'off' && !this.shotPreview)
    ) {
      this.presentationOverrideActive = false;
      return false;
    }

    this.cinematicDebug = this.presentationDirector.update(
      snapshot,
      this.rig.perspectiveCamera,
      deltaSeconds,
      {
        aspectRatio: this.rig.activeAspectRatio,
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
