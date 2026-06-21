import * as THREE from 'three';
import { PLAYABLE_FIELD_BOUNDS } from '../field';
import type { GameplaySnapshot } from '../playState';
import type { PlayerSnapshot, Vector2 } from '../playerModel';

export type GameplayCameraMode = 'offensePerspective' | 'tacticalOrthographic';

export type GameplayCameraState =
  | 'carrierFollow'
  | 'deadBall'
  | 'gameOver'
  | 'passFlight'
  | 'preSnapFormation'
  | 'resetLineOfScrimmage'
  | 'tacticalOverview';

export interface GameplayCameraDebugSnapshot {
  cameraPosition: { x: number; y: number; z: number };
  focusPosition: { x: number; y: number; z: number };
  mode: GameplayCameraMode;
  state: GameplayCameraState;
  targetPosition: { x: number; y: number; z: number };
}

interface GameplayCameraControllerOptions {
  height: number;
  initialMode?: GameplayCameraMode;
  width: number;
}

interface CameraFocus {
  focus: THREE.Vector3;
  state: GameplayCameraState;
  target: THREE.Vector3;
}

export const GAMEPLAY_CAMERA_CONFIG = {
  offensePerspective: {
    distanceBehindFocus: 30,
    fieldOfView: 48,
    forwardLookAhead: 18,
    height: 17,
    maximumFieldPosition: {
      x: PLAYABLE_FIELD_BOUNDS.maxX,
      z: PLAYABLE_FIELD_BOUNDS.maxZ,
    },
    minimumFieldPosition: {
      x: PLAYABLE_FIELD_BOUNDS.minX,
      z: PLAYABLE_FIELD_BOUNDS.minZ,
    },
    positionSmoothing: 8,
    targetSmoothing: 10,
  },
  playDirection: {
    x: 0,
    z: 1,
  },
  tacticalOrthographic: {
    narrowAspectThreshold: 0.75,
    narrowViewHeight: 155,
    position: {
      x: 18,
      y: 74,
      z: -110,
    },
    target: {
      x: 0,
      y: 0,
      z: 0,
    },
    wideViewHeight: 96,
  },
} as const;

export class GameplayCameraController {
  private readonly orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  private readonly perspectiveCamera = new THREE.PerspectiveCamera(
    GAMEPLAY_CAMERA_CONFIG.offensePerspective.fieldOfView,
    1,
    0.1,
    500,
  );
  private readonly playDirection = normalizeDirection(GAMEPLAY_CAMERA_CONFIG.playDirection);
  private readonly smoothedFocus = new THREE.Vector3();
  private readonly smoothedTarget = new THREE.Vector3();
  private cameraState: GameplayCameraState = 'tacticalOverview';
  private height: number;
  private isPerspectiveInitialized = false;
  private mode: GameplayCameraMode;
  private resetLineOfScrimmageSeconds = 0;
  private previousPlayState: GameplaySnapshot['playState'] | null = null;
  private width: number;

  constructor({ height, initialMode = 'tacticalOrthographic', width }: GameplayCameraControllerOptions) {
    this.height = height;
    this.mode = initialMode;
    this.width = width;
    this.resize(width, height);
  }

  get camera(): THREE.Camera {
    return this.mode === 'tacticalOrthographic' ? this.orthographicCamera : this.perspectiveCamera;
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

    if (snapshot) {
      this.update(snapshot, 0);
    }
  }

  toggleMode(snapshot?: GameplaySnapshot): GameplayCameraMode {
    const nextMode = this.mode === 'tacticalOrthographic' ? 'offensePerspective' : 'tacticalOrthographic';
    this.setMode(nextMode, snapshot);
    return nextMode;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.updateOrthographicProjection();
    this.updatePerspectiveProjection();
  }

  update(snapshot: GameplaySnapshot, deltaSeconds: number): void {
    if (this.previousPlayState === 'dead' && snapshot.playState === 'preSnap') {
      this.resetLineOfScrimmageSeconds = 0.7;
    }

    if (this.mode === 'tacticalOrthographic') {
      this.cameraState = 'tacticalOverview';
      this.positionTacticalCamera();
    } else {
      this.updateOffensePerspectiveCamera(snapshot, deltaSeconds);
    }

    this.previousPlayState = snapshot.playState;
  }

  getDebugSnapshot(): GameplayCameraDebugSnapshot {
    const activeCamera = this.camera;

    return {
      cameraPosition: toPlainVector(activeCamera.position),
      focusPosition: toPlainVector(this.smoothedFocus),
      mode: this.mode,
      state: this.cameraState,
      targetPosition: toPlainVector(this.smoothedTarget),
    };
  }

  private updateOrthographicProjection(): void {
    const aspect = this.width / this.height;
    const config = GAMEPLAY_CAMERA_CONFIG.tacticalOrthographic;
    const viewHeight = aspect < config.narrowAspectThreshold
      ? config.narrowViewHeight
      : config.wideViewHeight;
    const viewWidth = viewHeight * aspect;

    this.orthographicCamera.left = -viewWidth / 2;
    this.orthographicCamera.right = viewWidth / 2;
    this.orthographicCamera.top = viewHeight / 2;
    this.orthographicCamera.bottom = -viewHeight / 2;
    this.orthographicCamera.updateProjectionMatrix();
    this.positionTacticalCamera();
  }

  private updatePerspectiveProjection(): void {
    this.perspectiveCamera.aspect = this.width / this.height;
    this.perspectiveCamera.fov = GAMEPLAY_CAMERA_CONFIG.offensePerspective.fieldOfView;
    this.perspectiveCamera.updateProjectionMatrix();
  }

  private positionTacticalCamera(): void {
    const config = GAMEPLAY_CAMERA_CONFIG.tacticalOrthographic;
    const target = new THREE.Vector3(config.target.x, config.target.y, config.target.z);

    this.orthographicCamera.position.set(config.position.x, config.position.y, config.position.z);
    this.orthographicCamera.lookAt(target);
    this.smoothedFocus.copy(target);
    this.smoothedTarget.copy(target);
  }

  private updateOffensePerspectiveCamera(snapshot: GameplaySnapshot, deltaSeconds: number): void {
    const framing = this.calculateOffensePerspectiveFocus(snapshot, deltaSeconds);
    const config = GAMEPLAY_CAMERA_CONFIG.offensePerspective;
    const desiredCameraPosition = new THREE.Vector3(
      framing.focus.x - this.playDirection.x * config.distanceBehindFocus,
      config.height,
      framing.focus.z - this.playDirection.z * config.distanceBehindFocus,
    );
    const positionAlpha = this.isPerspectiveInitialized
      ? calculateSmoothingAlpha(config.positionSmoothing, deltaSeconds)
      : 1;
    const targetAlpha = this.isPerspectiveInitialized
      ? calculateSmoothingAlpha(config.targetSmoothing, deltaSeconds)
      : 1;

    this.perspectiveCamera.position.lerp(desiredCameraPosition, positionAlpha);
    this.smoothedFocus.lerp(framing.focus, targetAlpha);
    this.smoothedTarget.lerp(framing.target, targetAlpha);
    this.perspectiveCamera.lookAt(this.smoothedTarget);
    this.cameraState = framing.state;
    this.isPerspectiveInitialized = true;
  }

  private calculateOffensePerspectiveFocus(
    snapshot: GameplaySnapshot,
    deltaSeconds: number,
  ): CameraFocus {
    if (this.resetLineOfScrimmageSeconds > 0) {
      this.resetLineOfScrimmageSeconds = Math.max(0, this.resetLineOfScrimmageSeconds - deltaSeconds);
    }

    if (snapshot.playState === 'dead') {
      const deadBallSpot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.nextSnapSpot;
      const focus = this.createFieldFocus(deadBallSpot.x, deadBallSpot.z, 1.1);

      return {
        focus,
        state: 'deadBall',
        target: this.createForwardTarget(focus),
      };
    }

    if (snapshot.playState === 'gameOver') {
      const focus = this.createFieldFocus(snapshot.currentBallSpot.x, snapshot.currentBallSpot.z, 1.1);

      return {
        focus,
        state: 'gameOver',
        target: this.createForwardTarget(focus),
      };
    }

    if (snapshot.playState === 'live' && snapshot.ball.state.kind === 'inFlight') {
      const focus = this.createFieldFocus(
        snapshot.ball.position.x,
        snapshot.ball.position.z,
        Math.max(1.1, snapshot.ball.position.y),
      );
      const target = this.createFieldFocus(
        snapshot.ball.state.target.x,
        snapshot.ball.state.target.z,
        Math.max(1.1, snapshot.ball.state.target.y),
      );

      return {
        focus,
        state: 'passFlight',
        target,
      };
    }

    if (snapshot.playState === 'live' && snapshot.ball.possession.kind === 'player') {
      const carrier = findPlayer(snapshot.players, snapshot.ball.possession.playerId) ?? snapshot.player;
      const focus = this.createFieldFocus(carrier.position.x, carrier.position.z, 1.25);

      return {
        focus,
        state: 'carrierFollow',
        target: this.createForwardTarget(focus),
      };
    }

    const formationFocusX = calculateFormationFocusX(snapshot.players);
    const focus = this.createFieldFocus(
      formationFocusX,
      snapshot.drive.lineOfScrimmage.z,
      1.15,
    );

    return {
      focus,
      state: this.resetLineOfScrimmageSeconds > 0 ? 'resetLineOfScrimmage' : 'preSnapFormation',
      target: this.createForwardTarget(focus),
    };
  }

  private createForwardTarget(focus: THREE.Vector3): THREE.Vector3 {
    const lookAhead = GAMEPLAY_CAMERA_CONFIG.offensePerspective.forwardLookAhead;

    return new THREE.Vector3(
      focus.x + this.playDirection.x * lookAhead,
      1.1,
      focus.z + this.playDirection.z * lookAhead,
    );
  }

  private createFieldFocus(x: number, z: number, y: number): THREE.Vector3 {
    const config = GAMEPLAY_CAMERA_CONFIG.offensePerspective;

    return new THREE.Vector3(
      clamp(x, config.minimumFieldPosition.x, config.maximumFieldPosition.x),
      y,
      clamp(z, config.minimumFieldPosition.z, config.maximumFieldPosition.z),
    );
  }
}

export function resolveGameplayCameraMode(value: string | null): GameplayCameraMode {
  if (value === 'offense' || value === 'offensePerspective') {
    return 'offensePerspective';
  }

  return 'tacticalOrthographic';
}

function calculateFormationFocusX(players: PlayerSnapshot[]): number {
  if (players.length === 0) {
    return 0;
  }

  const playerXs = players.map((player) => player.position.x);

  return (Math.min(...playerXs) + Math.max(...playerXs)) / 2;
}

function findPlayer(players: PlayerSnapshot[], playerId: string): PlayerSnapshot | null {
  return players.find((player) => player.id === playerId) ?? null;
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

function calculateSmoothingAlpha(smoothing: number, deltaSeconds: number): number {
  return 1 - Math.exp(-smoothing * Math.max(0, deltaSeconds));
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
