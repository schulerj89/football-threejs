import type { PresentationAudioEvent } from '../audio/PresentationEventBridge';
import type { GameplaySnapshot } from '../playState';
import type { Vector2 } from '../playerModel';

export type CinematicsSetting = 'brief' | 'full' | 'off';

export type GameplayCameraMode =
  | 'cinematicBroadcast'
  | 'offensePerspective'
  | 'tacticalOrthographic';

export type GameplayCameraState =
  | 'carrierFollow'
  | 'cinematicBroadcast'
  | 'deadBall'
  | 'gameOver'
  | 'passFlight'
  | 'preSnapFormation'
  | 'resetLineOfScrimmage'
  | 'tacticalOverview';

export type GameplayCameraFocusPhase =
  | 'deadBall'
  | 'gameOver'
  | 'livePossession'
  | 'passFlight'
  | 'preSnap'
  | 'resetLineOfScrimmage';

export type GameplayCameraFocusSource =
  | 'ball'
  | 'carrierFallback'
  | 'currentBallSpotFallback'
  | 'deadBallSpot'
  | 'inFlightStartFallback'
  | 'nextSnapSpot'
  | 'snapBall';

export interface GameplayCameraLookAhead {
  direction: Vector2;
  distance: number;
}

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

export interface GameplayCameraDebugSnapshot {
  activeShotName?: PresentationOrbitShotName | null;
  cameraPosition: { x: number; y: number; z: number };
  formationBounds?: FieldPlaneBounds;
  focusLookAhead?: GameplayCameraLookAhead;
  focusPhase?: GameplayCameraFocusPhase;
  focusPosition: { x: number; y: number; z: number };
  focusSource?: GameplayCameraFocusSource;
  lookTargetPosition?: { x: number; y: number; z: number };
  mode: GameplayCameraMode;
  orbitCenter?: { x: number; y: number; z: number } | null;
  orbitRadius?: number | null;
  presentationPhase?: PresentationCameraPhase;
  restoreCamera?: string | null;
  shotProgress?: number | null;
  state: GameplayCameraState;
  targetPosition: { x: number; y: number; z: number };
}

export interface GameplayCameraControllerOptions {
  cinematics?: CinematicsSetting;
  height: number;
  holdCinematicPreSnapEstablish?: boolean;
  initialMode?: GameplayCameraMode;
  shotPreview?: PresentationOrbitShotName | null;
  width: number;
}

export interface GameplayCameraUpdateOptions {
  crowdCutawaysEnabled?: boolean;
  presentationEvents?: readonly PresentationAudioEvent[];
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
  maximumFieldPosition: { x: number; z: number };
  maximumTransitionSpeed: number;
  maxDeltaSeconds: number;
  minimumFieldPosition: { x: number; z: number };
  phases: Record<PresentationCameraPhase, PresentationCameraShotConfig>;
  playDirection: Vector2;
  positionSmoothing: number;
  targetSmoothing: number;
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

export interface PresentationCameraDirectorOptions {
  cinematics?: CinematicsSetting;
  config?: PresentationCameraConfig;
  shotPreview?: PresentationOrbitShotName | null;
}

export interface PresentationCameraUpdateOptions {
  aspectRatio?: number;
  crowdCutawaysEnabled?: boolean;
  presentationEvents?: readonly PresentationAudioEvent[];
  restoreCameraMode?: string;
}

export interface GameplayCameraFocus {
  cameraDistanceBehindFocus?: number;
  cameraFieldOfView?: number;
  cameraHeight?: number;
  focusPosition: { x: number; y: number; z: number };
  focusSource: GameplayCameraFocusSource;
  focus: { x: number; y: number; z: number };
  framingTargetPosition?: { x: number; y: number; z: number };
  lookAhead?: GameplayCameraLookAhead;
  nextResetLineOfScrimmageSeconds: number;
  phase: GameplayCameraFocusPhase;
  state: GameplayCameraState;
  target: { x: number; y: number; z: number };
  targetPosition: { x: number; y: number; z: number };
}

export interface GameplayFocusRequest {
  deltaSeconds: number;
  resetLineOfScrimmageSeconds: number;
  snapshot: GameplaySnapshot;
}

export interface CameraFocusResult {
  cameraDistanceBehindFocus?: number;
  cameraFieldOfView?: number;
  cameraHeight?: number;
  focusPosition: { x: number; y: number; z: number };
  focusSource: GameplayCameraFocusSource;
  framingTargetPosition?: { x: number; y: number; z: number };
  lookAhead?: GameplayCameraLookAhead;
  phase: GameplayCameraFocusPhase;
  state: GameplayCameraState;
  targetPosition: { x: number; y: number; z: number };
}
