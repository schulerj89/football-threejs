import * as THREE from 'three';
import { GAMEPLAY_CAMERA_CONFIG } from './CameraConfiguration';
import type { GameplayCameraFocus, GameplayCameraMode, PresentationCameraConfig } from './CameraTypes';
import {
  calculateLookDirectionAngle,
  limitLookTargetAngularChange,
  smoothNumber,
  smoothVectorWithSpeedLimit,
  toPlainVector,
  toVector3,
} from './CameraMath';
import type { PresentationCameraShot } from './PresentationShotDefinitions';

export interface CameraRigStabilityMetrics {
  desiredCameraPosition: { x: number; y: number; z: number };
  desiredLookTarget: { x: number; y: number; z: number };
  perFrameAngularChange: number;
  perFrameDisplacement: number;
}

const ZERO_VECTOR = { x: 0, y: 0, z: 0 };

function createEmptyStabilityMetrics(): CameraRigStabilityMetrics {
  return {
    desiredCameraPosition: { ...ZERO_VECTOR },
    desiredLookTarget: { ...ZERO_VECTOR },
    perFrameAngularChange: 0,
    perFrameDisplacement: 0,
  };
}

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
  private stabilityMetrics = createEmptyStabilityMetrics();
  private smoothedDistanceBehindFocus: number = GAMEPLAY_CAMERA_CONFIG.offensePerspective.distanceBehindFocus;
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
    const previousPosition = this.orthographicCamera.position.clone();
    const previousTarget = this.smoothedTarget.clone();

    this.orthographicCamera.position.set(config.position.x, config.position.y, config.position.z);
    this.orthographicCamera.lookAt(target);
    this.smoothedFocus.copy(target);
    this.smoothedTarget.copy(target);
    this.stabilityMetrics = {
      desiredCameraPosition: toPlainVector(this.orthographicCamera.position),
      desiredLookTarget: toPlainVector(target),
      perFrameAngularChange: calculateLookDirectionAngle(
        previousPosition,
        previousTarget,
        this.orthographicCamera.position,
        target,
      ),
      perFrameDisplacement: this.orthographicCamera.position.distanceTo(previousPosition),
    };
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
    const desiredDistanceBehindFocus = framing.cameraDistanceBehindFocus ?? config.distanceBehindFocus;
    const cameraHeight = framing.cameraHeight ?? config.height;
    const cameraFieldOfView = framing.cameraFieldOfView ?? config.fieldOfView;
    const delta = Math.min(Math.max(0, deltaSeconds), config.maxDeltaSeconds);
    const previousPosition = this.perspectiveCamera.position.clone();
    const previousTarget = this.smoothedTarget.clone();
    this.smoothedDistanceBehindFocus = isInitialized
      ? smoothNumber(
        this.smoothedDistanceBehindFocus,
        desiredDistanceBehindFocus,
        config.framingDistanceDamping,
        delta,
      )
      : desiredDistanceBehindFocus;
    const desiredCameraPosition = new THREE.Vector3(
      focus.x - playDirection.x * this.smoothedDistanceBehindFocus,
      cameraHeight,
      focus.z - playDirection.z * this.smoothedDistanceBehindFocus,
    );

    this.perspectiveCamera.fov = cameraFieldOfView;
    this.perspectiveCamera.updateProjectionMatrix();
    if (!isInitialized) {
      this.perspectiveCamera.position.copy(desiredCameraPosition);
      this.smoothedFocus.copy(focus);
      this.smoothedTarget.copy(target);
    } else {
      this.perspectiveCamera.position.copy(smoothVectorWithSpeedLimit(
        this.perspectiveCamera.position,
        desiredCameraPosition,
        config.positionSmoothing,
        delta,
        config.maximumCameraTranslationPerSecond,
      ));
      this.smoothedFocus.copy(smoothVectorWithSpeedLimit(
        this.smoothedFocus,
        focus,
        config.focusDamping,
        delta,
        config.maximumLookTargetTranslationPerSecond,
      ));
      const speedLimitedTarget = smoothVectorWithSpeedLimit(
        this.smoothedTarget,
        target,
        config.targetSmoothing,
        delta,
        config.maximumLookTargetTranslationPerSecond,
      );
      this.smoothedTarget.copy(limitLookTargetAngularChange(
        previousPosition,
        previousTarget,
        this.perspectiveCamera.position,
        speedLimitedTarget,
        config.maximumAngularChangePerSecond * delta,
      ));
    }
    this.perspectiveCamera.lookAt(this.smoothedTarget);
    this.stabilityMetrics = {
      desiredCameraPosition: toPlainVector(desiredCameraPosition),
      desiredLookTarget: toPlainVector(target),
      perFrameAngularChange: calculateLookDirectionAngle(
        previousPosition,
        previousTarget,
        this.perspectiveCamera.position,
        this.smoothedTarget,
      ),
      perFrameDisplacement: this.perspectiveCamera.position.distanceTo(previousPosition),
    };
  }

  usePresentationTargets(focus: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
    this.smoothedFocus.set(focus.x, focus.y, focus.z);
    this.smoothedTarget.set(target.x, target.y, target.z);
  }

  getStabilityMetrics(): CameraRigStabilityMetrics {
    return {
      desiredCameraPosition: { ...this.stabilityMetrics.desiredCameraPosition },
      desiredLookTarget: { ...this.stabilityMetrics.desiredLookTarget },
      perFrameAngularChange: this.stabilityMetrics.perFrameAngularChange,
      perFrameDisplacement: this.stabilityMetrics.perFrameDisplacement,
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
}

export class PresentationCameraRig {
  readonly smoothedPosition = new THREE.Vector3();
  readonly smoothedTarget = new THREE.Vector3();
  private initialized = false;
  private stabilityMetrics = createEmptyStabilityMetrics();

  reset(): void {
    this.initialized = false;
    this.stabilityMetrics = createEmptyStabilityMetrics();
  }

  applyShot(
    camera: THREE.PerspectiveCamera,
    shot: PresentationCameraShot,
    config: PresentationCameraConfig,
    deltaSeconds: number,
  ): void {
    const previousPosition = camera.position.clone();
    const previousTarget = this.smoothedTarget.clone();

    if (!this.initialized) {
      this.smoothedPosition.copy(shot.position);
      this.smoothedTarget.copy(shot.lookTarget);
      this.initialized = true;
    } else {
      const maxDelta = Math.min(Math.max(0, deltaSeconds), config.maxDeltaSeconds);
      const phaseConfig = config.phases[shot.phase];
      this.smoothedPosition.copy(smoothVectorWithSpeedLimit(
        this.smoothedPosition,
        shot.position,
        phaseConfig.positionSmoothing ?? config.positionSmoothing,
        maxDelta,
        config.maximumTransitionSpeed,
      ));
      const speedLimitedTarget = smoothVectorWithSpeedLimit(
        this.smoothedTarget,
        shot.lookTarget,
        phaseConfig.targetSmoothing ?? config.targetSmoothing,
        maxDelta,
        config.maximumLookTargetSpeed,
      );
      this.smoothedTarget.copy(limitLookTargetAngularChange(
        previousPosition,
        previousTarget,
        this.smoothedPosition,
        speedLimitedTarget,
        config.maximumAngularChangePerSecond * maxDelta,
      ));
    }

    camera.position.copy(this.smoothedPosition);
    camera.lookAt(this.smoothedTarget);
    this.stabilityMetrics = {
      desiredCameraPosition: toPlainVector(shot.position),
      desiredLookTarget: toPlainVector(shot.lookTarget),
      perFrameAngularChange: calculateLookDirectionAngle(
        previousPosition,
        previousTarget,
        camera.position,
        this.smoothedTarget,
      ),
      perFrameDisplacement: camera.position.distanceTo(previousPosition),
    };
  }

  getStabilityMetrics(): CameraRigStabilityMetrics {
    return {
      desiredCameraPosition: { ...this.stabilityMetrics.desiredCameraPosition },
      desiredLookTarget: { ...this.stabilityMetrics.desiredLookTarget },
      perFrameAngularChange: this.stabilityMetrics.perFrameAngularChange,
      perFrameDisplacement: this.stabilityMetrics.perFrameDisplacement,
    };
  }
}
