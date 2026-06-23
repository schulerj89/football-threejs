import * as THREE from 'three';
import type { CinematicsSetting, GameplayCameraMode } from '../../camera/CameraTypes';
import type { PresentationCameraShot } from '../../camera/PresentationShotDefinitions';

const HALFTIME_SHOT_CONFIG = {
  briefDurationSeconds: 12,
  fullDurationSeconds: 16,
  height: 58,
  radius: 128,
  startAngleRadians: -Math.PI * 0.68,
} as const;

export function getHalftimeShotDuration(cinematics: CinematicsSetting): number {
  if (cinematics === 'off') {
    return 0;
  }
  return cinematics === 'full'
    ? HALFTIME_SHOT_CONFIG.fullDurationSeconds
    : HALFTIME_SHOT_CONFIG.briefDurationSeconds;
}

export function createHalftimeCameraShot(options: {
  cinematics: CinematicsSetting;
  elapsedSeconds: number;
  restoreCamera: GameplayCameraMode;
}): PresentationCameraShot {
  const duration = Math.max(0.001, getHalftimeShotDuration(options.cinematics));
  const rawProgress = Math.min(1, Math.max(0, options.elapsedSeconds / duration));
  const eased = easeInOutCubic(rawProgress);
  const sweep = options.cinematics === 'full' ? Math.PI * 2 : Math.PI * 1.35;
  const angle = HALFTIME_SHOT_CONFIG.startAngleRadians + sweep * eased;
  const focus = new THREE.Vector3(0, 2.2, 0);
  const position = new THREE.Vector3(
    Math.sin(angle) * HALFTIME_SHOT_CONFIG.radius,
    HALFTIME_SHOT_CONFIG.height,
    Math.cos(angle) * HALFTIME_SHOT_CONFIG.radius,
  );

  return {
    activeShotName: null,
    fieldOfView: 48,
    focus,
    lookTarget: focus.clone(),
    orbitCenter: focus.clone(),
    orbitRadius: HALFTIME_SHOT_CONFIG.radius,
    phase: 'deadBallResult',
    position,
    restoreCamera: options.restoreCamera,
    shotProgress: rawProgress,
  };
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

