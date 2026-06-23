import * as THREE from 'three';
import {
  PLAYER_BACK_NUMBER_ANCHOR_NAME,
  PLAYER_BODY_DIMENSIONS,
  PLAYER_BODY_ROOT_NAME,
  PLAYER_HEAD_ANCHOR_NAME,
} from '../../playerVisual';

export type PoseTargetType = 'proceduralMannequin' | 'riggedSkeleton';

export interface LimbPose {
  shoulderPitch: number;
  shoulderYaw: number;
  shoulderRoll: number;
  elbowBend: number;
}

export interface LegPose {
  hipPitch: number;
  hipYaw: number;
  hipRoll: number;
  kneeBend: number;
  anklePitch: number;
}

export interface PlayerPoseDefinition {
  id: string;
  displayName: string;
  targetType: PoseTargetType;
  body: {
    torsoPitch: number;
    torsoRoll: number;
    torsoYaw: number;
    headPitch: number;
    headYaw: number;
    headRoll: number;
    crouch: number;
    stanceWidth: number;
    bodyHeightOffset: number;
    facingYaw: number;
    footAngle: number;
  };
  limbs: {
    leftArm: LimbPose;
    rightArm: LimbPose;
    leftLeg: LegPose;
    rightLeg: LegPose;
  };
}

export interface PlayerPoseClipFrame {
  poseId: string;
  timeSeconds: number;
}

export interface PlayerPoseClip {
  id: string;
  displayName: string;
  frames: readonly PlayerPoseClipFrame[];
  loop: boolean;
}

export interface PlayerPoseExportDocument {
  comments: readonly string[];
  createdAt: string;
  clips: readonly PlayerPoseClip[];
  poses: readonly PlayerPoseDefinition[];
  schemaVersion: number;
  units: 'radians';
}

export interface PlayerPoseValidationResult {
  issues: readonly string[];
  valid: boolean;
}

export interface PlayerPoseApplySnapshot {
  appliedPoseId: string;
  missingParts: readonly string[];
  targetType: PoseTargetType;
}

type NumericRange = readonly [min: number, max: number];

export const PLAYER_POSE_SCHEMA_VERSION = 1;

export const PLAYER_POSE_SAFE_RANGES = {
  body: {
    bodyHeightOffset: [-0.35, 0.35],
    crouch: [0, 1],
    facingYaw: [-Math.PI, Math.PI],
    footAngle: [-0.65, 0.65],
    headPitch: [-0.8, 0.8],
    headRoll: [-0.65, 0.65],
    headYaw: [-1.05, 1.05],
    stanceWidth: [0.28, 0.82],
    torsoPitch: [-0.75, 0.75],
    torsoRoll: [-0.55, 0.55],
    torsoYaw: [-0.7, 0.7],
  },
  leg: {
    anklePitch: [-0.75, 0.75],
    hipPitch: [-1.15, 1.15],
    hipRoll: [-0.75, 0.75],
    hipYaw: [-0.75, 0.75],
    kneeBend: [0, 1.85],
  },
  limb: {
    elbowBend: [0, 1.85],
    shoulderPitch: [-1.5, 1.5],
    shoulderRoll: [-1.25, 1.25],
    shoulderYaw: [-1.05, 1.05],
  },
} as const satisfies {
  body: Record<keyof PlayerPoseDefinition['body'], NumericRange>;
  leg: Record<keyof LegPose, NumericRange>;
  limb: Record<keyof LimbPose, NumericRange>;
};

const BODY_KEYS = Object.keys(PLAYER_POSE_SAFE_RANGES.body) as Array<keyof PlayerPoseDefinition['body']>;
const LIMB_KEYS = Object.keys(PLAYER_POSE_SAFE_RANGES.limb) as Array<keyof LimbPose>;
const LEG_KEYS = Object.keys(PLAYER_POSE_SAFE_RANGES.leg) as Array<keyof LegPose>;
const ARM_X = PLAYER_BODY_DIMENSIONS.shoulderWidth / 2 - PLAYER_BODY_DIMENSIONS.armInsetX;

export const DEFAULT_PLAYER_POSES: readonly PlayerPoseDefinition[] = [
  createPose('neutral', 'Neutral', {}),
  createPose('ready_offense', 'Ready Offense', {
    body: { crouch: 0.18, torsoPitch: 0.08, stanceWidth: 0.56 },
    limbs: {
      leftArm: { shoulderPitch: -0.14, shoulderRoll: -0.14 },
      leftLeg: { hipRoll: -0.08, kneeBend: 0.22 },
      rightArm: { shoulderPitch: -0.14, shoulderRoll: 0.14 },
      rightLeg: { hipRoll: 0.08, kneeBend: 0.22 },
    },
  }),
  createPose('ready_defense', 'Ready Defense', {
    body: { crouch: 0.26, torsoPitch: 0.11, stanceWidth: 0.64 },
    limbs: {
      leftArm: { shoulderPitch: -0.08, shoulderRoll: -0.28, elbowBend: 0.32 },
      leftLeg: { hipRoll: -0.13, kneeBend: 0.34 },
      rightArm: { shoulderPitch: -0.08, shoulderRoll: 0.28, elbowBend: 0.32 },
      rightLeg: { hipRoll: 0.13, kneeBend: 0.34 },
    },
  }),
  createPose('runner_idle', 'Runner Idle', {
    body: { crouch: 0.2, torsoPitch: 0.14, stanceWidth: 0.52 },
    limbs: {
      leftArm: { shoulderPitch: -0.35, elbowBend: 0.45 },
      leftLeg: { hipPitch: 0.1, kneeBend: 0.2 },
      rightArm: { shoulderPitch: 0.24, elbowBend: 0.4 },
      rightLeg: { hipPitch: -0.08, kneeBend: 0.15 },
    },
  }),
  createPose('running_contact_left', 'Running Contact Left', {
    body: { crouch: 0.16, torsoPitch: 0.16, torsoRoll: -0.04, stanceWidth: 0.5 },
    limbs: {
      leftArm: { shoulderPitch: 0.42, elbowBend: 0.42 },
      leftLeg: { hipPitch: -0.52, kneeBend: 0.18, anklePitch: 0.1 },
      rightArm: { shoulderPitch: -0.48, elbowBend: 0.52 },
      rightLeg: { hipPitch: 0.48, kneeBend: 0.72, anklePitch: -0.18 },
    },
  }),
  createPose('running_contact_right', 'Running Contact Right', {
    body: { crouch: 0.16, torsoPitch: 0.16, torsoRoll: 0.04, stanceWidth: 0.5 },
    limbs: {
      leftArm: { shoulderPitch: -0.48, elbowBend: 0.52 },
      leftLeg: { hipPitch: 0.48, kneeBend: 0.72, anklePitch: -0.18 },
      rightArm: { shoulderPitch: 0.42, elbowBend: 0.42 },
      rightLeg: { hipPitch: -0.52, kneeBend: 0.18, anklePitch: 0.1 },
    },
  }),
  createPose('blocker_ready', 'Blocker Ready', {
    body: { crouch: 0.34, torsoPitch: 0.2, stanceWidth: 0.68 },
    limbs: {
      leftArm: { shoulderPitch: -0.2, shoulderRoll: -0.28, elbowBend: 0.2 },
      leftLeg: { hipRoll: -0.16, kneeBend: 0.42 },
      rightArm: { shoulderPitch: -0.2, shoulderRoll: 0.28, elbowBend: 0.2 },
      rightLeg: { hipRoll: 0.16, kneeBend: 0.42 },
    },
  }),
  createPose('receiver_ready', 'Receiver Ready', {
    body: { crouch: 0.24, torsoPitch: 0.18, stanceWidth: 0.5 },
    limbs: {
      leftArm: { shoulderPitch: -0.2, shoulderRoll: -0.12, elbowBend: 0.45 },
      leftLeg: { hipPitch: 0.1, kneeBend: 0.28 },
      rightArm: { shoulderPitch: -0.2, shoulderRoll: 0.12, elbowBend: 0.45 },
      rightLeg: { hipPitch: -0.08, kneeBend: 0.24 },
    },
  }),
  createPose('quarterback_ready', 'Quarterback Ready', {
    body: { crouch: 0.14, torsoPitch: 0.06, stanceWidth: 0.54 },
    limbs: {
      leftArm: { shoulderPitch: -0.18, shoulderYaw: -0.16, elbowBend: 0.5 },
      leftLeg: { hipRoll: -0.05, kneeBend: 0.18 },
      rightArm: { shoulderPitch: -0.3, shoulderYaw: 0.18, elbowBend: 0.72 },
      rightLeg: { hipRoll: 0.05, kneeBend: 0.18 },
    },
  }),
  createPose('kickoff_kicker_ready', 'Kickoff Kicker Ready', {
    body: { crouch: 0.12, torsoPitch: 0.08, stanceWidth: 0.46 },
    limbs: {
      leftArm: { shoulderPitch: -0.12, shoulderRoll: -0.08, elbowBend: 0.2 },
      leftLeg: { hipPitch: -0.18, kneeBend: 0.18 },
      rightArm: { shoulderPitch: 0.18, shoulderRoll: 0.08, elbowBend: 0.24 },
      rightLeg: { hipPitch: 0.34, kneeBend: 0.32 },
    },
  }),
  createPose('coin_toss_captain', 'Coin Toss Captain', {
    body: { torsoPitch: 0.02, stanceWidth: 0.5 },
    limbs: {
      leftArm: { shoulderPitch: -0.08, shoulderRoll: -0.04, elbowBend: 0.16 },
      leftLeg: { kneeBend: 0.06 },
      rightArm: { shoulderPitch: -0.08, shoulderRoll: 0.04, elbowBend: 0.16 },
      rightLeg: { kneeBend: 0.06 },
    },
  }),
  createPose('touchdown_signal_placeholder', 'Touchdown Signal Placeholder', {
    body: { torsoPitch: -0.02, stanceWidth: 0.54 },
    limbs: {
      leftArm: { shoulderPitch: -1.35, shoulderRoll: -0.2, elbowBend: 0.05 },
      leftLeg: { kneeBend: 0.06 },
      rightArm: { shoulderPitch: -1.35, shoulderRoll: 0.2, elbowBend: 0.05 },
      rightLeg: { kneeBend: 0.06 },
    },
  }),
] as const;

export const DEFAULT_PLAYER_POSE_CLIPS: readonly PlayerPoseClip[] = [
  {
    displayName: 'Idle Shift',
    frames: [
      { poseId: 'ready_offense', timeSeconds: 0 },
      { poseId: 'runner_idle', timeSeconds: 0.8 },
      { poseId: 'ready_offense', timeSeconds: 1.6 },
    ],
    id: 'idle_shift',
    loop: true,
  },
  {
    displayName: 'Run Two-Pose Loop',
    frames: [
      { poseId: 'running_contact_left', timeSeconds: 0 },
      { poseId: 'running_contact_right', timeSeconds: 0.28 },
      { poseId: 'running_contact_left', timeSeconds: 0.56 },
    ],
    id: 'run_two_pose_loop',
    loop: true,
  },
  {
    displayName: 'Blocker Bounce',
    frames: [
      { poseId: 'blocker_ready', timeSeconds: 0 },
      { poseId: 'ready_defense', timeSeconds: 0.4 },
      { poseId: 'blocker_ready', timeSeconds: 0.8 },
    ],
    id: 'blocker_bounce',
    loop: true,
  },
  {
    displayName: 'QB Ready Shift',
    frames: [
      { poseId: 'quarterback_ready', timeSeconds: 0 },
      { poseId: 'runner_idle', timeSeconds: 0.7 },
      { poseId: 'quarterback_ready', timeSeconds: 1.4 },
    ],
    id: 'qb_ready_shift',
    loop: true,
  },
] as const;

export function applyPlayerPoseDefinition(
  playerVisual: THREE.Object3D,
  pose: PlayerPoseDefinition,
): PlayerPoseApplySnapshot {
  const clamped = clampPlayerPoseDefinition(pose);
  const parts = getProceduralPoseParts(playerVisual);
  const missingParts = Object.entries(parts)
    .filter(([, object]) => object === null)
    .map(([name]) => name);

  if (parts.bodyRoot) {
    parts.bodyRoot.position.y =
      clamped.body.bodyHeightOffset -
      clamped.body.crouch * 0.24;
    parts.bodyRoot.rotation.y = clamped.body.facingYaw;
  }

  setRotation(parts.torso, clamped.body.torsoPitch, clamped.body.torsoYaw, clamped.body.torsoRoll);
  setRotation(parts.shoulderPads, clamped.body.torsoPitch * 0.7, clamped.body.torsoYaw * 0.35, clamped.body.torsoRoll);
  setRotation(parts.headAnchor, clamped.body.headPitch, clamped.body.headYaw, clamped.body.headRoll);
  applyArmPose(parts.leftArmPivot, parts.leftArm, clamped.limbs.leftArm, -1);
  applyArmPose(parts.rightArmPivot, parts.rightArm, clamped.limbs.rightArm, 1);
  applyLegPose(parts.leftLegPivot, parts.leftLeg, parts.leftFoot, clamped.limbs.leftLeg, -1, clamped.body);
  applyLegPose(parts.rightLegPivot, parts.rightLeg, parts.rightFoot, clamped.limbs.rightLeg, 1, clamped.body);

  playerVisual.userData.playerPoseDefinitionId = clamped.id;
  playerVisual.userData.playerPoseTargetType = clamped.targetType;

  return {
    appliedPoseId: clamped.id,
    missingParts,
    targetType: clamped.targetType,
  };
}

export function clampPlayerPoseDefinition(pose: PlayerPoseDefinition): PlayerPoseDefinition {
  return {
    ...pose,
    body: mapBody(pose.body, (key, value) => clampToRange(value, PLAYER_POSE_SAFE_RANGES.body[key])),
    limbs: {
      leftArm: mapLimb(pose.limbs.leftArm, (key, value) => clampToRange(value, PLAYER_POSE_SAFE_RANGES.limb[key])),
      leftLeg: mapLeg(pose.limbs.leftLeg, (key, value) => clampToRange(value, PLAYER_POSE_SAFE_RANGES.leg[key])),
      rightArm: mapLimb(pose.limbs.rightArm, (key, value) => clampToRange(value, PLAYER_POSE_SAFE_RANGES.limb[key])),
      rightLeg: mapLeg(pose.limbs.rightLeg, (key, value) => clampToRange(value, PLAYER_POSE_SAFE_RANGES.leg[key])),
    },
  };
}

export function clonePlayerPoseDefinition(pose: PlayerPoseDefinition): PlayerPoseDefinition {
  return JSON.parse(JSON.stringify(pose)) as PlayerPoseDefinition;
}

export function interpolatePlayerPoseDefinitions(
  a: PlayerPoseDefinition,
  b: PlayerPoseDefinition,
  t: number,
  options: { id?: string; displayName?: string } = {},
): PlayerPoseDefinition {
  const alpha = clamp(t, 0, 1);
  return clampPlayerPoseDefinition({
    displayName: options.displayName ?? `${a.displayName} / ${b.displayName}`,
    id: options.id ?? `${a.id}_to_${b.id}`,
    targetType: a.targetType,
    body: mapBody(a.body, (key, value) => interpolateAngle(value, b.body[key], alpha)),
    limbs: {
      leftArm: mapLimb(a.limbs.leftArm, (key, value) => interpolateAngle(value, b.limbs.leftArm[key], alpha)),
      leftLeg: mapLeg(a.limbs.leftLeg, (key, value) => interpolateAngle(value, b.limbs.leftLeg[key], alpha)),
      rightArm: mapLimb(a.limbs.rightArm, (key, value) => interpolateAngle(value, b.limbs.rightArm[key], alpha)),
      rightLeg: mapLeg(a.limbs.rightLeg, (key, value) => interpolateAngle(value, b.limbs.rightLeg[key], alpha)),
    },
  });
}

export function samplePlayerPoseClip(
  clip: PlayerPoseClip,
  poses: readonly PlayerPoseDefinition[],
  elapsedSeconds: number,
): PlayerPoseDefinition {
  const poseById = new Map(poses.map((pose) => [pose.id, pose]));
  if (clip.frames.length === 0) {
    throw new Error(`Clip ${clip.id} has no frames`);
  }

  const lastFrame = clip.frames[clip.frames.length - 1]!;
  const duration = Math.max(0.001, lastFrame.timeSeconds);
  const time = clip.loop
    ? wrapTime(elapsedSeconds, duration)
    : clamp(elapsedSeconds, 0, duration);
  let previous = clip.frames[0]!;
  let next = lastFrame;
  for (let index = 1; index < clip.frames.length; index += 1) {
    const candidate = clip.frames[index]!;
    if (candidate.timeSeconds >= time) {
      next = candidate;
      break;
    }
    previous = candidate;
  }

  const previousPose = poseById.get(previous.poseId);
  const nextPose = poseById.get(next.poseId);
  if (!previousPose || !nextPose) {
    throw new Error(`Clip ${clip.id} references missing pose`);
  }

  const span = Math.max(0.001, next.timeSeconds - previous.timeSeconds);
  const alpha = previous === next ? 0 : (time - previous.timeSeconds) / span;
  return interpolatePlayerPoseDefinitions(previousPose, nextPose, alpha, {
    displayName: clip.displayName,
    id: `${clip.id}_sample`,
  });
}

export function createPlayerPoseExportDocument(
  poses: readonly PlayerPoseDefinition[],
  clips: readonly PlayerPoseClip[] = DEFAULT_PLAYER_POSE_CLIPS,
  createdAt = new Date().toISOString(),
): PlayerPoseExportDocument {
  return {
    clips: clips.map(clonePlayerPoseClip),
    comments: [
      'Football JS player pose export.',
      'All numeric rotation values are stored in radians.',
      'Pose files are team-independent and contain no Three.js Object3D references.',
    ],
    createdAt,
    poses: poses.map(clonePlayerPoseDefinition),
    schemaVersion: PLAYER_POSE_SCHEMA_VERSION,
    units: 'radians',
  };
}

export function validatePlayerPoseCollection(
  poses: readonly PlayerPoseDefinition[],
  clips: readonly PlayerPoseClip[] = [],
): PlayerPoseValidationResult {
  const issues: string[] = [];
  const poseIds = new Set<string>();

  poses.forEach((pose, index) => {
    const path = `poses[${index}]`;
    for (const issue of validatePlayerPoseDefinition(pose, path).issues) {
      issues.push(issue);
    }
    if (poseIds.has(pose.id)) {
      issues.push(`${path}.id duplicates ${pose.id}`);
    }
    poseIds.add(pose.id);
  });

  clips.forEach((clip, index) => {
    for (const issue of validatePlayerPoseClip(clip, poseIds, `clips[${index}]`).issues) {
      issues.push(issue);
    }
  });

  return { issues, valid: issues.length === 0 };
}

export function validatePlayerPoseDefinition(
  pose: unknown,
  path = 'pose',
): PlayerPoseValidationResult {
  const issues: string[] = [];
  if (!isRecord(pose)) {
    return { issues: [`${path} must be an object`], valid: false };
  }
  validateString(pose.id, `${path}.id`, issues);
  validateString(pose.displayName, `${path}.displayName`, issues);
  if (pose.targetType !== 'proceduralMannequin' && pose.targetType !== 'riggedSkeleton') {
    issues.push(`${path}.targetType must be proceduralMannequin or riggedSkeleton`);
  }

  validateNumericRecord(pose.body, PLAYER_POSE_SAFE_RANGES.body, BODY_KEYS, `${path}.body`, issues);
  if (!isRecord(pose.limbs)) {
    issues.push(`${path}.limbs must be an object`);
  } else {
    validateNumericRecord(pose.limbs.leftArm, PLAYER_POSE_SAFE_RANGES.limb, LIMB_KEYS, `${path}.limbs.leftArm`, issues);
    validateNumericRecord(pose.limbs.rightArm, PLAYER_POSE_SAFE_RANGES.limb, LIMB_KEYS, `${path}.limbs.rightArm`, issues);
    validateNumericRecord(pose.limbs.leftLeg, PLAYER_POSE_SAFE_RANGES.leg, LEG_KEYS, `${path}.limbs.leftLeg`, issues);
    validateNumericRecord(pose.limbs.rightLeg, PLAYER_POSE_SAFE_RANGES.leg, LEG_KEYS, `${path}.limbs.rightLeg`, issues);
  }

  return { issues, valid: issues.length === 0 };
}

export function validatePlayerPoseClip(
  clip: unknown,
  poseIds: ReadonlySet<string>,
  path = 'clip',
): PlayerPoseValidationResult {
  const issues: string[] = [];
  if (!isRecord(clip)) {
    return { issues: [`${path} must be an object`], valid: false };
  }
  validateString(clip.id, `${path}.id`, issues);
  validateString(clip.displayName, `${path}.displayName`, issues);
  if (typeof clip.loop !== 'boolean') {
    issues.push(`${path}.loop must be a boolean`);
  }
  if (!Array.isArray(clip.frames) || clip.frames.length === 0) {
    issues.push(`${path}.frames must contain at least one frame`);
    return { issues, valid: issues.length === 0 };
  }

  let previousTime = Number.NEGATIVE_INFINITY;
  clip.frames.forEach((frame, index) => {
    const framePath = `${path}.frames[${index}]`;
    if (!isRecord(frame)) {
      issues.push(`${framePath} must be an object`);
      return;
    }
    if (typeof frame.poseId !== 'string' || !poseIds.has(frame.poseId)) {
      issues.push(`${framePath}.poseId references unknown pose ${String(frame.poseId)}`);
    }
    if (typeof frame.timeSeconds !== 'number' || !Number.isFinite(frame.timeSeconds) || frame.timeSeconds < 0) {
      issues.push(`${framePath}.timeSeconds must be a non-negative finite number`);
    } else if (frame.timeSeconds <= previousTime) {
      issues.push(`${framePath}.timeSeconds must be greater than the previous frame time`);
    } else {
      previousTime = frame.timeSeconds;
    }
  });

  return { issues, valid: issues.length === 0 };
}

export function parsePlayerPoseExportDocument(jsonText: string): PlayerPoseExportDocument {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Pose JSON must be an object');
  }
  if (parsed.schemaVersion !== PLAYER_POSE_SCHEMA_VERSION) {
    throw new Error(`Unsupported pose schema version ${String(parsed.schemaVersion)}`);
  }
  if (parsed.units !== 'radians') {
    throw new Error('Pose JSON units must be radians');
  }
  if (!Array.isArray(parsed.poses)) {
    throw new Error('Pose JSON must include poses');
  }
  const clips = Array.isArray(parsed.clips) ? parsed.clips : [];
  const validation = validatePlayerPoseCollection(
    parsed.poses as PlayerPoseDefinition[],
    clips as PlayerPoseClip[],
  );
  if (!validation.valid) {
    throw new Error(validation.issues.join('\n'));
  }

  return {
    clips: (clips as PlayerPoseClip[]).map(clonePlayerPoseClip),
    comments: Array.isArray(parsed.comments)
      ? parsed.comments.filter((comment): comment is string => typeof comment === 'string')
      : [],
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    poses: (parsed.poses as PlayerPoseDefinition[]).map(clonePlayerPoseDefinition),
    schemaVersion: PLAYER_POSE_SCHEMA_VERSION,
    units: 'radians',
  };
}

export function serializePlayerPoseExportDocument(document: PlayerPoseExportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function findPlayerPoseById(
  poses: readonly PlayerPoseDefinition[],
  poseId: string,
): PlayerPoseDefinition {
  const pose = poses.find((candidate) => candidate.id === poseId);
  if (!pose) {
    throw new Error(`Unknown player pose ${poseId}`);
  }
  return pose;
}

function createPose(
  id: string,
  displayName: string,
  patch: {
    body?: Partial<PlayerPoseDefinition['body']>;
    limbs?: {
      leftArm?: Partial<LimbPose>;
      leftLeg?: Partial<LegPose>;
      rightArm?: Partial<LimbPose>;
      rightLeg?: Partial<LegPose>;
    };
  },
): PlayerPoseDefinition {
  return clampPlayerPoseDefinition({
    body: {
      bodyHeightOffset: 0,
      crouch: 0,
      facingYaw: 0,
      footAngle: 0,
      headPitch: 0,
      headRoll: 0,
      headYaw: 0,
      stanceWidth: PLAYER_BODY_DIMENSIONS.legOffsetX * 2,
      torsoPitch: 0,
      torsoRoll: 0,
      torsoYaw: 0,
      ...patch.body,
    },
    displayName,
    id,
    limbs: {
      leftArm: createLimbPose(patch.limbs?.leftArm),
      leftLeg: createLegPose(patch.limbs?.leftLeg),
      rightArm: createLimbPose(patch.limbs?.rightArm),
      rightLeg: createLegPose(patch.limbs?.rightLeg),
    },
    targetType: 'proceduralMannequin',
  });
}

function createLimbPose(patch: Partial<LimbPose> = {}): LimbPose {
  return {
    elbowBend: 0,
    shoulderPitch: 0,
    shoulderRoll: 0,
    shoulderYaw: 0,
    ...patch,
  };
}

function createLegPose(patch: Partial<LegPose> = {}): LegPose {
  return {
    anklePitch: 0,
    hipPitch: 0,
    hipRoll: 0,
    hipYaw: 0,
    kneeBend: 0,
    ...patch,
  };
}

function getProceduralPoseParts(playerVisual: THREE.Object3D): {
  bodyRoot: THREE.Object3D | null;
  headAnchor: THREE.Object3D | null;
  leftArm: THREE.Object3D | null;
  leftArmPivot: THREE.Object3D | null;
  leftFoot: THREE.Object3D | null;
  leftLeg: THREE.Object3D | null;
  leftLegPivot: THREE.Object3D | null;
  numberAnchor: THREE.Object3D | null;
  rightArm: THREE.Object3D | null;
  rightArmPivot: THREE.Object3D | null;
  rightFoot: THREE.Object3D | null;
  rightLeg: THREE.Object3D | null;
  rightLegPivot: THREE.Object3D | null;
  shoulderPads: THREE.Object3D | null;
  torso: THREE.Object3D | null;
} {
  return {
    bodyRoot: playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME) ?? null,
    headAnchor: playerVisual.getObjectByName(PLAYER_HEAD_ANCHOR_NAME) ?? null,
    leftArm: playerVisual.getObjectByName('leftArm') ?? null,
    leftArmPivot: playerVisual.getObjectByName('leftArmPivot') ?? null,
    leftFoot: playerVisual.getObjectByName('leftFoot') ?? null,
    leftLeg: playerVisual.getObjectByName('leftLeg') ?? null,
    leftLegPivot: playerVisual.getObjectByName('leftLegPivot') ?? null,
    numberAnchor: playerVisual.getObjectByName(PLAYER_BACK_NUMBER_ANCHOR_NAME) ?? null,
    rightArm: playerVisual.getObjectByName('rightArm') ?? null,
    rightArmPivot: playerVisual.getObjectByName('rightArmPivot') ?? null,
    rightFoot: playerVisual.getObjectByName('rightFoot') ?? null,
    rightLeg: playerVisual.getObjectByName('rightLeg') ?? null,
    rightLegPivot: playerVisual.getObjectByName('rightLegPivot') ?? null,
    shoulderPads: playerVisual.getObjectByName('shoulderPads') ?? null,
    torso: playerVisual.getObjectByName('torso') ?? null,
  };
}

function applyArmPose(
  pivot: THREE.Object3D | null,
  arm: THREE.Object3D | null,
  pose: LimbPose,
  side: -1 | 1,
): void {
  setRotation(pivot, pose.shoulderPitch, pose.shoulderYaw, pose.shoulderRoll);
  setRotation(arm, pose.elbowBend * 0.18, 0, side * pose.elbowBend * 0.08);
}

function applyLegPose(
  pivot: THREE.Object3D | null,
  leg: THREE.Object3D | null,
  foot: THREE.Object3D | null,
  pose: LegPose,
  side: -1 | 1,
  body: PlayerPoseDefinition['body'],
): void {
  if (pivot) {
    pivot.position.x = side * body.stanceWidth / 2;
    pivot.rotation.set(pose.hipPitch, pose.hipYaw, pose.hipRoll);
  }
  setRotation(leg, pose.kneeBend * -0.16, 0, side * pose.kneeBend * 0.05);
  setRotation(foot, pose.anklePitch, side * body.footAngle, 0);
}

function setRotation(object: THREE.Object3D | null, x: number, y: number, z: number): void {
  if (!object) {
    return;
  }
  object.rotation.set(x, y, z);
}

function clonePlayerPoseClip(clip: PlayerPoseClip): PlayerPoseClip {
  return {
    displayName: clip.displayName,
    frames: clip.frames.map((frame) => ({ ...frame })),
    id: clip.id,
    loop: clip.loop,
  };
}

function validateNumericRecord<T extends Record<string, NumericRange>>(
  value: unknown,
  ranges: T,
  requiredKeys: Array<keyof T & string>,
  path: string,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return;
  }

  const knownKeys = new Set(requiredKeys);
  for (const key of Object.keys(value)) {
    if (!knownKeys.has(key)) {
      issues.push(`${path}.${key} is unknown`);
    }
  }

  for (const key of requiredKeys) {
    const numericValue = value[key];
    if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
      issues.push(`${path}.${key} must be a finite number`);
      continue;
    }
    const [min, max] = ranges[key];
    if (numericValue < min || numericValue > max) {
      issues.push(`${path}.${key} must be between ${min} and ${max}`);
    }
  }
}

function validateString(value: unknown, path: string, issues: string[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`${path} must be a non-empty string`);
  }
}

function mapBody(
  body: PlayerPoseDefinition['body'],
  map: (key: keyof PlayerPoseDefinition['body'], value: number) => number,
): PlayerPoseDefinition['body'] {
  return Object.fromEntries(BODY_KEYS.map((key) => [key, map(key, body[key])])) as PlayerPoseDefinition['body'];
}

function mapLimb(
  limb: LimbPose,
  map: (key: keyof LimbPose, value: number) => number,
): LimbPose {
  return Object.fromEntries(LIMB_KEYS.map((key) => [key, map(key, limb[key])])) as unknown as LimbPose;
}

function mapLeg(
  leg: LegPose,
  map: (key: keyof LegPose, value: number) => number,
): LegPose {
  return Object.fromEntries(LEG_KEYS.map((key) => [key, map(key, leg[key])])) as unknown as LegPose;
}

function interpolateAngle(a: number, b: number, t: number): number {
  const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}

function clampToRange(value: number, range: NumericRange): number {
  return clamp(Number.isFinite(value) ? value : 0, range[0], range[1]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapTime(value: number, duration: number): number {
  return ((value % duration) + duration) % duration;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
