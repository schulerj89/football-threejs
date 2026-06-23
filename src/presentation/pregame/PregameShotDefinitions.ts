import * as THREE from 'three';
import { FIELD_BOUNDS, FIELD_DIMENSIONS } from '../../fieldSpec';
import type { CinematicsSetting } from '../../camera/CameraTypes';
import type { PresentationCameraShot } from '../../camera/PresentationShotDefinitions';
import type {
  PregamePresentationContext,
  PregameSequenceStep,
  PregameShotId,
  PregameSubjectBounds,
} from './PregamePresentationTypes';
import {
  QUARTERBACK_SPOTLIGHT_CONFIG,
  createQuarterbackSpotlightShotVectors,
  resolveQuarterbackSpotlightBounds,
} from './QuarterbackSpotlightShot';

export const PREGAME_SHOT_DURATIONS = {
  centerOrbitBrief: 9.5,
  centerOrbitFull: 15,
  matchupCombined: 3.4,
  matchupWide: 4.2,
  opponentTeamPan: 5,
  opponentWarmupPan: 4.8,
  quarterbackSpotlight: QUARTERBACK_SPOTLIGHT_CONFIG.minimumSeconds,
  stadiumEstablish: 2.5,
  transitionToGameplay: 2,
  userTeamTunnelOrSideline: 5,
  userWarmupPan: 4.8,
  weatherAndField: 3.5,
} as const;

const CENTER_ORBIT_CONFIG = {
  briefAngleRadians: Math.PI * 1.35,
  briefHeight: 52,
  briefRadius: 118,
  fullAngleRadians: Math.PI * 2,
  fullHeight: 58,
  fullRadius: 124,
  startAngleRadians: -Math.PI * 0.72,
} as const;

export function createPregameSequence(cinematics: CinematicsSetting): PregameSequenceStep[] {
  if (cinematics === 'off') {
    return [];
  }

  if (cinematics === 'brief') {
    return [
      {
        commentaryLineIds: ['welcome', 'matchup', 'weather'],
        minimumSeconds: PREGAME_SHOT_DURATIONS.centerOrbitBrief,
        shotId: 'stadiumCenterOrbit',
        waitForCommentaryLineIds: ['welcome', 'matchup', 'weather'],
      },
      {
        commentaryLineId: 'quarterback',
        minimumSeconds: PREGAME_SHOT_DURATIONS.quarterbackSpotlight,
        shotId: 'quarterbackFrontSpotlight',
        waitForCommentaryLineId: 'quarterback',
      },
      {
        minimumSeconds: PREGAME_SHOT_DURATIONS.transitionToGameplay,
        shotId: 'transitionToCoinToss',
      },
    ];
  }

  return [
    {
      commentaryLineIds: ['welcome', 'matchup', 'weather'],
      minimumSeconds: PREGAME_SHOT_DURATIONS.centerOrbitFull,
      shotId: 'stadiumCenterOrbit360',
      waitForCommentaryLineIds: ['welcome', 'matchup', 'weather'],
    },
    {
      commentaryLineId: 'quarterback',
      minimumSeconds: PREGAME_SHOT_DURATIONS.quarterbackSpotlight,
      shotId: 'quarterbackFrontSpotlight',
      waitForCommentaryLineId: 'quarterback',
    },
    {
      minimumSeconds: PREGAME_SHOT_DURATIONS.transitionToGameplay,
      shotId: 'transitionToCoinToss',
    },
  ];
}

export function createPregameCameraShot(
  step: PregameSequenceStep,
  context: PregamePresentationContext,
  rawProgress: number,
): PresentationCameraShot {
  const progress = easeInOut(clamp(rawProgress, 0, 1));
  const subjectBounds = resolvePregameSubjectBounds(step.shotId, context);
  const focus = new THREE.Vector3(
    subjectBounds.center.x,
    subjectBounds.center.y,
    subjectBounds.center.z,
  );
  const shot = createShotVectors(step.shotId, context, focus, subjectBounds, progress, rawProgress);

  return {
    activeShotName: null,
    fieldOfView: shot.fieldOfView,
    focus,
    lookTarget: shot.lookTarget,
    orbitCenter: null,
    orbitRadius: null,
    phase: step.shotId === 'transitionToGameplay' || step.shotId === 'transitionToCoinToss'
      ? 'transitionToGameplay'
      : 'preSnapEstablish',
    position: preventCameraClipping(shot.position),
    restoreCamera: context.targetGameplayCamera,
    shotProgress: rawProgress,
  };
}

export function resolvePregameSubjectBounds(
  shotId: PregameShotId,
  context: PregamePresentationContext,
): PregameSubjectBounds {
  if (shotId === 'userTeamTunnelOrSideline') {
    return zoneToSubjectBounds(
      findPreferredTeamZone(context, 'user-tunnel', 'user-sideline'),
      shotId,
    );
  }

  if (shotId === 'opponentTeamPan') {
    return zoneToSubjectBounds(
      findPreferredTeamZone(context, 'opponent-tunnel', 'opponent-sideline'),
      shotId,
    );
  }

  if (shotId === 'userWarmupPan') {
    return resolveWarmupTeamBounds(context, 'user') ?? fieldSubjectBounds(shotId);
  }

  if (shotId === 'opponentWarmupPan') {
    return resolveWarmupTeamBounds(context, 'opponent') ?? fieldSubjectBounds(shotId);
  }

  if (shotId === 'matchupCombined' || shotId === 'matchupWide') {
    const warmup = resolveCombinedWarmupBounds(context);
    if (warmup) {
      return warmup;
    }

    const user = findPreferredTeamZone(context, 'user-sideline', 'user-tunnel');
    const opponent = findPreferredTeamZone(context, 'opponent-sideline', 'opponent-tunnel');
    if (user && opponent) {
      return {
        center: { x: (user.center.x + opponent.center.x) / 2, y: 1.5, z: 0 },
        max: {
          x: Math.max(user.bounds.maxX, opponent.bounds.maxX),
          z: Math.max(user.bounds.maxZ, opponent.bounds.maxZ),
        },
        min: {
          x: Math.min(user.bounds.minX, opponent.bounds.minX),
          z: Math.min(user.bounds.minZ, opponent.bounds.minZ),
        },
        size: {
          x: Math.abs(opponent.center.x - user.center.x),
          z: Math.max(user.bounds.maxZ - user.bounds.minZ, opponent.bounds.maxZ - opponent.bounds.minZ),
        },
        source: shotId === 'matchupWide' ? 'matchupWide' : 'field',
      };
    }
  }

  if (shotId === 'weatherAndField') {
    return {
      center: { x: 0, y: 3.2, z: FIELD_BOUNDS.maxZ - 10 },
      max: { x: FIELD_BOUNDS.maxX, z: FIELD_BOUNDS.maxZ },
      min: { x: FIELD_BOUNDS.minX, z: FIELD_BOUNDS.maxZ - 22 },
      size: { x: FIELD_DIMENSIONS.fieldWidth, z: 22 },
      source: 'field',
    };
  }

  if (shotId === 'quarterbackSpotlight' || shotId === 'quarterbackFrontSpotlight') {
    return resolveQuarterbackSpotlightBounds(context);
  }

  const snap = context.gameplaySnapshot.nextSnapSpot ?? context.gameplaySnapshot.currentBallSpot;
  const centerZ = shotId === 'transitionToGameplay' ? snap.z : 0;
  return {
    center: { x: shotId === 'transitionToGameplay' ? snap.x : 0, y: 1.6, z: centerZ },
    max: { x: FIELD_BOUNDS.maxX, z: FIELD_BOUNDS.maxZ },
    min: { x: FIELD_BOUNDS.minX, z: FIELD_BOUNDS.minZ },
        size: { x: FIELD_DIMENSIONS.fieldWidth, z: FIELD_DIMENSIONS.fieldLength },
    source: 'field',
  };
}

function createShotVectors(
  shotId: PregameShotId,
  context: PregamePresentationContext,
  focus: THREE.Vector3,
  subject: PregameSubjectBounds,
  progress: number,
  rawProgress: number,
): { fieldOfView: number; lookTarget: THREE.Vector3; position: THREE.Vector3 } {
  const aspectScale = context.aspectRatio < 0.8 ? 1.22 : 1;

  if (shotId === 'stadiumEstablish') {
    return {
      fieldOfView: 50,
      lookTarget: new THREE.Vector3(0, 0.6, 3),
      position: new THREE.Vector3(46 * aspectScale, 78, -112),
    };
  }

  if (shotId === 'stadiumCenterOrbit' || shotId === 'stadiumCenterOrbit360') {
    const full = shotId === 'stadiumCenterOrbit360';
    const orbitProgress = Math.min(Math.max(rawProgress, 0), 1.18);
    const angle = CENTER_ORBIT_CONFIG.startAngleRadians +
      orbitProgress * (full ? CENTER_ORBIT_CONFIG.fullAngleRadians : CENTER_ORBIT_CONFIG.briefAngleRadians);
    const radius = full ? CENTER_ORBIT_CONFIG.fullRadius : CENTER_ORBIT_CONFIG.briefRadius;
    const height = full ? CENTER_ORBIT_CONFIG.fullHeight : CENTER_ORBIT_CONFIG.briefHeight;
    return {
      fieldOfView: 48,
      lookTarget: new THREE.Vector3(0, 1.6, 0),
      position: new THREE.Vector3(
        Math.sin(angle) * radius * aspectScale,
        height,
        Math.cos(angle) * radius,
      ),
    };
  }

  if (shotId === 'matchupCombined' || shotId === 'matchupWide') {
    const lateral = Math.sin((progress - 0.5) * Math.PI) * 6;
    const targetZ = subject.center.z + (progress - 0.5) * 4;
    return {
      fieldOfView: 46,
      lookTarget: new THREE.Vector3(subject.center.x, 2.4, targetZ),
      position: new THREE.Vector3(
        subject.center.x + lateral,
        32,
        subject.center.z - 88 * aspectScale,
      ),
    };
  }

  if (shotId === 'transitionToGameplay' || shotId === 'transitionToCoinToss') {
    const snap = context.gameplaySnapshot.nextSnapSpot ?? context.gameplaySnapshot.currentBallSpot;
    return {
      fieldOfView: context.targetGameplayCamera === 'tacticalOrthographic' ? 54 : 58,
      lookTarget: shotId === 'transitionToCoinToss'
        ? new THREE.Vector3(0, 1.7, 0)
        : new THREE.Vector3(snap.x, 1.5, snap.z + 10),
      position: shotId === 'transitionToCoinToss'
        ? new THREE.Vector3(0, 28, -62 * aspectScale)
        : new THREE.Vector3(snap.x, 28, snap.z - 62 * aspectScale),
    };
  }

  if (shotId === 'weatherAndField') {
    return {
      fieldOfView: 40,
      lookTarget: new THREE.Vector3(0, 7, FIELD_BOUNDS.maxZ - 10),
      position: new THREE.Vector3(-34 * aspectScale, 24, FIELD_BOUNDS.maxZ + 26),
    };
  }

  if (shotId === 'quarterbackSpotlight' || shotId === 'quarterbackFrontSpotlight') {
    return createQuarterbackSpotlightShotVectors(context, subject, progress);
  }

  if (shotId === 'userWarmupPan' || shotId === 'opponentWarmupPan') {
    const sideSign = subject.center.x < 0 ? -1 : 1;
    const startZ = subject.min.z + subject.size.z * 0.22;
    const endZ = subject.max.z - subject.size.z * 0.18;
    const panZ = lerp(startZ, endZ, progress);
    const sideOffset = shotId === 'userWarmupPan' ? -10 : 10;
    return {
      fieldOfView: 34,
      lookTarget: new THREE.Vector3(subject.center.x, 1.7, panZ),
      position: new THREE.Vector3(
        subject.center.x + sideSign * (15 * aspectScale),
        7.8,
        panZ - 13 + sideOffset * 0.08,
      ),
    };
  }

  const sideSign = focus.x < 0 ? -1 : 1;
  const panZ = subject.min.z + (subject.max.z - subject.min.z) * progress;
  const panFocus = new THREE.Vector3(focus.x, 1.8, Number.isFinite(panZ) ? panZ : focus.z);
  return {
    fieldOfView: 34,
    lookTarget: panFocus,
    position: new THREE.Vector3(
      focus.x + sideSign * 17 * aspectScale,
      8.5,
      panFocus.z - 12,
    ),
  };
}

function resolveCombinedWarmupBounds(
  context: PregamePresentationContext,
): PregameSubjectBounds | null {
  if (!context.warmupSnapshot.ready) {
    return null;
  }

  const bounds = combineWarmupGroups(context.warmupSnapshot.groups);
  if (!bounds) {
    return null;
  }

  return {
    ...bounds,
    source: 'warmupCombined',
  };
}

function resolveWarmupTeamBounds(
  context: PregamePresentationContext,
  teamSide: 'opponent' | 'user',
): PregameSubjectBounds | null {
  if (!context.warmupSnapshot.enabled) {
    return null;
  }

  const bounds = combineWarmupGroups(
    context.warmupSnapshot.groups.filter((group) => group.teamSide === teamSide),
  );
  if (!bounds) {
    return null;
  }

  return {
    ...bounds,
    source: teamSide === 'user' ? 'user-warmup' : 'opponent-warmup',
  };
}

function combineWarmupGroups(
  groups: PregamePresentationContext['warmupSnapshot']['groups'],
): Omit<PregameSubjectBounds, 'source'> | null {
  if (groups.length === 0) {
    return null;
  }

  const bounds = groups.reduce(
    (accumulator, group) => ({
      maxX: Math.max(accumulator.maxX, group.bounds.maxX),
      maxZ: Math.max(accumulator.maxZ, group.bounds.maxZ),
      minX: Math.min(accumulator.minX, group.bounds.minX),
      minZ: Math.min(accumulator.minZ, group.bounds.minZ),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
    },
  );

  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minZ) ||
    !Number.isFinite(bounds.maxZ)
  ) {
    return null;
  }

  return {
    center: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: 1.6,
      z: (bounds.minZ + bounds.maxZ) / 2,
    },
    max: {
      x: bounds.maxX,
      z: bounds.maxZ,
    },
    min: {
      x: bounds.minX,
      z: bounds.minZ,
    },
    size: {
      x: bounds.maxX - bounds.minX,
      z: bounds.maxZ - bounds.minZ,
    },
  };
}

function findPreferredTeamZone(
  context: PregamePresentationContext,
  preferredId: string,
  fallbackId: string,
) {
  return context.sidelineSnapshot.zones.find((zone) => zone.id === preferredId) ??
    context.sidelineSnapshot.zones.find((zone) => zone.id === fallbackId) ??
    null;
}

function zoneToSubjectBounds(
  zone: ReturnType<typeof findPreferredTeamZone>,
  source: PregameShotId,
): PregameSubjectBounds {
  if (!zone) {
    return {
      center: { x: 0, y: 1.6, z: 0 },
      max: { x: FIELD_BOUNDS.maxX, z: FIELD_BOUNDS.maxZ },
      min: { x: FIELD_BOUNDS.minX, z: FIELD_BOUNDS.minZ },
      size: { x: FIELD_DIMENSIONS.fieldWidth, z: FIELD_DIMENSIONS.fieldLength },
      source,
    };
  }

  return {
    center: { x: zone.center.x, y: 1.5, z: zone.center.z },
    max: { x: zone.bounds.maxX, z: zone.bounds.maxZ },
    min: { x: zone.bounds.minX, z: zone.bounds.minZ },
    size: {
      x: zone.bounds.maxX - zone.bounds.minX,
      z: zone.bounds.maxZ - zone.bounds.minZ,
    },
    source: zone.id,
  };
}

function fieldSubjectBounds(source: PregameShotId): PregameSubjectBounds {
  return {
    center: { x: 0, y: 1.6, z: 0 },
    max: { x: FIELD_BOUNDS.maxX, z: FIELD_BOUNDS.maxZ },
    min: { x: FIELD_BOUNDS.minX, z: FIELD_BOUNDS.minZ },
    size: { x: FIELD_DIMENSIONS.fieldWidth, z: FIELD_DIMENSIONS.fieldLength },
    source,
  };
}

function preventCameraClipping(position: THREE.Vector3): THREE.Vector3 {
  const padding = 150;
  return new THREE.Vector3(
    clamp(position.x, FIELD_BOUNDS.minX - padding, FIELD_BOUNDS.maxX + padding),
    Math.max(4.5, position.y),
    clamp(position.z, FIELD_BOUNDS.minZ - padding, FIELD_BOUNDS.maxZ + padding),
  );
}

function easeInOut(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
