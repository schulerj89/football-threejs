import type {
  CameraShotPolicy,
  CinematicsSetting,
  GameplayCameraMode,
  PresentationOrbitShotName,
} from './CameraTypes';

export function resolveCameraShotPolicy(
  cameraMode: GameplayCameraMode,
  cinematicsSetting: CinematicsSetting,
): CameraShotPolicy {
  if (cameraMode === 'tacticalOrthographic') {
    return {
      allowCrowdCutaway: false,
      allowPerspectiveOverride: false,
      allowPostPlayOrbit: false,
      allowPrePlayOrbit: false,
      allowSubtleSettle: false,
    };
  }

  if (cameraMode === 'offensePerspective') {
    return {
      allowCrowdCutaway: false,
      allowPerspectiveOverride: cinematicsSetting !== 'off',
      allowPostPlayOrbit: cinematicsSetting !== 'off',
      allowPrePlayOrbit: false,
      allowSubtleSettle: true,
    };
  }

  return {
    allowCrowdCutaway: false,
    allowPerspectiveOverride: cinematicsSetting !== 'off',
    allowPostPlayOrbit: cinematicsSetting !== 'off',
    allowPrePlayOrbit: cinematicsSetting === 'full',
    allowSubtleSettle: true,
  };
}

export function isPresentationShotAllowed(
  shotName: PresentationOrbitShotName,
  policy: CameraShotPolicy,
): boolean {
  if (shotName === 'prePlayOrbit180') {
    return policy.allowPrePlayOrbit;
  }

  if (shotName === 'firstDownCrowdCutaway' || shotName === 'touchdownCrowdCutaway') {
    return policy.allowCrowdCutaway;
  }

  return policy.allowPostPlayOrbit;
}
