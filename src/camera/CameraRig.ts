import * as THREE from 'three';
import { GAMEPLAY_CAMERA_CONFIG } from './CameraConfiguration';
import type { GameplayCameraFocus, GameplayCameraMode, PresentationCameraConfig } from './CameraTypes';
import { calculateSmoothingAlpha, smoothVectorWithSpeedLimit, toVector3 } from './CameraMath';
import type { PresentationCameraShot } from './PresentationShotDefinitions';

export class GameplayCameraRig {
  readonly orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  readonly perspectiveCamera = new THREE.PerspectiveCamera(
    GAMEPLAY_CAMERA_CONFIG.offensePerspective.fieldOfView,
    1,
    0.1,
    500,
  );
  readonly smoothedFocus = new THREE.Vector3();
  readonly smoothedTarget = new THREE.Vector3();
  private height: number;
  private width: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.resize(width, height);
  }

  get activeAspectRatio(): number {
    return this.width / this.height;
  }

  getActiveCamera(mode: GameplayCameraMode, presentationOverrideActive: boolean): THREE.Camera {
    if (presentationOverrideActive) {
      return this.perspectiveCamera;
    }

    return mode === 'tacticalOrthographic' ? this.orthographicCamera : this.perspectiveCamera;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.updateOrthographicProjection();
    this.updatePerspectiveProjection();
  }

  positionTacticalCamera(): void {
    const config = GAMEPLAY_CAMERA_CONFIG.tacticalOrthographic;
    const target = new THREE.Vector3(config.target.x, config.target.y, config.target.z);

    this.orthographicCamera.position.set(config.position.x, config.position.y, config.position.z);
    this.orthographicCamera.lookAt(target);
    this.smoothedFocus.copy(target);
    this.smoothedTarget.copy(target);
  }

  applyOffensePerspective(
    framing: GameplayCameraFocus,
    playDirection: { x: number; z: number },
    isInitialized: boolean,
    deltaSeconds: number,
  ): void {
    const config = GAMEPLAY_CAMERA_CONFIG.offensePerspective;
    const focus = toVector3(framing.focus);
    const target = toVector3(framing.target);
    const desiredCameraPosition = new THREE.Vector3(
      focus.x - playDirection.x * config.distanceBehindFocus,
      config.height,
      focus.z - playDirection.z * config.distanceBehindFocus,
    );
    const positionAlpha = isInitialized
      ? calculateSmoothingAlpha(config.positionSmoothing, deltaSeconds)
      : 1;
    const targetAlpha = isInitialized
      ? calculateSmoothingAlpha(config.targetSmoothing, deltaSeconds)
      : 1;

    this.perspectiveCamera.position.lerp(desiredCameraPosition, positionAlpha);
    this.smoothedFocus.lerp(focus, targetAlpha);
    this.smoothedTarget.lerp(target, targetAlpha);
    this.perspectiveCamera.lookAt(this.smoothedTarget);
  }

  usePresentationTargets(focus: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
    this.smoothedFocus.set(focus.x, focus.y, focus.z);
    this.smoothedTarget.set(target.x, target.y, target.z);
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
}

export class PresentationCameraRig {
  readonly smoothedPosition = new THREE.Vector3();
  readonly smoothedTarget = new THREE.Vector3();
  private initialized = false;

  reset(): void {
    this.initialized = false;
  }

  applyShot(
    camera: THREE.PerspectiveCamera,
    shot: PresentationCameraShot,
    config: PresentationCameraConfig,
    deltaSeconds: number,
  ): void {
    if (!this.initialized) {
      this.smoothedPosition.copy(shot.position);
      this.smoothedTarget.copy(shot.lookTarget);
      this.initialized = true;
    } else {
      const phaseConfig = config.phases[shot.phase];
      this.smoothedPosition.copy(smoothVectorWithSpeedLimit(
        this.smoothedPosition,
        shot.position,
        phaseConfig.positionSmoothing ?? config.positionSmoothing,
        deltaSeconds,
        config.maximumTransitionSpeed,
      ));
      this.smoothedTarget.copy(smoothVectorWithSpeedLimit(
        this.smoothedTarget,
        shot.lookTarget,
        phaseConfig.targetSmoothing ?? config.targetSmoothing,
        deltaSeconds,
        config.maximumTransitionSpeed,
      ));
    }

    camera.position.copy(this.smoothedPosition);
    camera.lookAt(this.smoothedTarget);
  }
}
