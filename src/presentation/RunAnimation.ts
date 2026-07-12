import * as THREE from 'three';
import {
  PLAYER_BODY_DIMENSIONS,
  PLAYER_BODY_ROOT_NAME,
} from '../playerVisual';

export interface RunAnimationPivots {
  leftArmPivot: THREE.Object3D;
  rightArmPivot: THREE.Object3D;
  leftLegPivot: THREE.Object3D;
  rightLegPivot: THREE.Object3D;
}

export interface RiggedPlayerAnimationBones {
  hips: THREE.Bone;
  leftArm: THREE.Bone;
  leftFoot: THREE.Bone;
  leftUpLeg: THREE.Bone;
  rightArm: THREE.Bone;
  rightFoot: THREE.Bone;
  rightUpLeg: THREE.Bone;
  spine: THREE.Bone;
  spine01: THREE.Bone;
  spine02: THREE.Bone;
}

export interface RiggedPlayerPoseOffsets {
  leftArmRotationX: number;
  leftArmRotationZ: number;
  leftFootRotationX: number;
  leftLegRotationX: number;
  leftLegRotationZ: number;
  rightArmRotationX: number;
  rightArmRotationZ: number;
  rightFootRotationX: number;
  rightLegRotationX: number;
  rightLegRotationZ: number;
  shoulderRotationX: number;
  torsoRotationX: number;
  torsoRotationZ: number;
}

export interface RunAnimationConfig {
  armSwingRadians: number;
  legSwingRadians: number;
  maxDeltaSeconds: number;
  maxStrideRadiansPerSecond: number;
  neutralReturnRate: number;
  speedForFullSwing: number;
  speedThreshold: number;
  strideRadiansPerSecondPerSpeed: number;
}

export interface KickAnimationConfig {
  armCounterSwingRadians: number;
  backswingProgress: number;
  backswingRadians: number;
  followThroughRadians: number;
  forwardSwingProgress: number;
  plantLegPitchRadians: number;
}

export const RUN_ANIMATION_CONFIG: RunAnimationConfig = {
  armSwingRadians: 0.34,
  legSwingRadians: 0.32,
  maxDeltaSeconds: 0.05,
  maxStrideRadiansPerSecond: 18,
  neutralReturnRate: 12,
  speedForFullSwing: 7,
  speedThreshold: 0.12,
  strideRadiansPerSecondPerSpeed: 2.7,
};

export const KICK_ANIMATION_CONFIG: KickAnimationConfig = {
  armCounterSwingRadians: 0.18,
  backswingProgress: 0.42,
  backswingRadians: -0.52,
  followThroughRadians: 0.82,
  forwardSwingProgress: 0.78,
  plantLegPitchRadians: -0.12,
};

const TWO_PI = Math.PI * 2;
const ARM_X = PLAYER_BODY_DIMENSIONS.shoulderWidth / 2 - PLAYER_BODY_DIMENSIONS.armInsetX;

interface RiggedPlayerAnimationState {
  bones: RiggedPlayerAnimationBones;
  restRotations: Map<THREE.Bone, THREE.Euler>;
}

const riggedPlayerAnimationStates = new WeakMap<
  THREE.Object3D,
  RiggedPlayerAnimationState | null
>();

const PIVOT_SPECS = [
  {
    meshNames: ['leftArm'],
    pivotName: 'leftArmPivot',
    userDataKey: 'leftArmPivot',
    position: new THREE.Vector3(-ARM_X, PLAYER_BODY_DIMENSIONS.armPivotY, 0),
  },
  {
    meshNames: ['rightArm'],
    pivotName: 'rightArmPivot',
    userDataKey: 'rightArmPivot',
    position: new THREE.Vector3(ARM_X, PLAYER_BODY_DIMENSIONS.armPivotY, 0),
  },
  {
    meshNames: ['leftLeg', 'leftFoot'],
    pivotName: 'leftLegPivot',
    userDataKey: 'leftLegPivot',
    position: new THREE.Vector3(
      -PLAYER_BODY_DIMENSIONS.legOffsetX,
      PLAYER_BODY_DIMENSIONS.legPivotY,
      0,
    ),
  },
  {
    meshNames: ['rightLeg', 'rightFoot'],
    pivotName: 'rightLegPivot',
    userDataKey: 'rightLegPivot',
    position: new THREE.Vector3(
      PLAYER_BODY_DIMENSIONS.legOffsetX,
      PLAYER_BODY_DIMENSIONS.legPivotY,
      0,
    ),
  },
] as const;

export function ensureRunAnimationPivots(player: THREE.Object3D): RunAnimationPivots {
  const bodyRoot = player.getObjectByName(PLAYER_BODY_ROOT_NAME) ?? player;
  const pivots = PIVOT_SPECS.map((spec) => ensurePivot(player, bodyRoot, spec));

  const [leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot] = pivots;
  player.userData.leftArmPivot = leftArmPivot;
  player.userData.rightArmPivot = rightArmPivot;
  player.userData.leftLegPivot = leftLegPivot;
  player.userData.rightLegPivot = rightLegPivot;

  return {
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
  };
}

export function getRiggedPlayerAnimationBones(
  player: THREE.Object3D,
): RiggedPlayerAnimationBones | null {
  return getOrCreateRiggedPlayerAnimationState(player)?.bones ?? null;
}

export function applyRiggedPlayerPose(
  player: THREE.Object3D,
  pose: RiggedPlayerPoseOffsets,
  options: { applyLimbs?: boolean } = {},
): boolean {
  const state = getOrCreateRiggedPlayerAnimationState(player);
  if (!state) {
    return false;
  }

  const applyLimbs = options.applyLimbs ?? true;
  const { bones } = state;
  const torsoPitch = pose.torsoRotationX;
  const torsoRoll = pose.torsoRotationZ;

  setRiggedBoneRotation(state, bones.hips, torsoPitch * 0.15, 0, torsoRoll * 0.15);
  setRiggedBoneRotation(state, bones.spine, torsoPitch * 0.25, 0, torsoRoll * 0.25);
  setRiggedBoneRotation(state, bones.spine01, torsoPitch * 0.3, 0, torsoRoll * 0.3);
  setRiggedBoneRotation(
    state,
    bones.spine02,
    pose.shoulderRotationX * 0.3,
    0,
    torsoRoll * 0.3,
  );

  if (applyLimbs) {
    setRiggedBoneRotation(
      state,
      bones.leftArm,
      pose.leftArmRotationX,
      0,
      pose.leftArmRotationZ,
    );
    setRiggedBoneRotation(
      state,
      bones.rightArm,
      pose.rightArmRotationX,
      0,
      pose.rightArmRotationZ,
    );
    setRiggedBoneRotation(
      state,
      bones.leftUpLeg,
      pose.leftLegRotationX,
      0,
      pose.leftLegRotationZ,
    );
    setRiggedBoneRotation(
      state,
      bones.rightUpLeg,
      pose.rightLegRotationX,
      0,
      pose.rightLegRotationZ,
    );
  }

  setRiggedBoneRotation(state, bones.leftFoot, pose.leftFootRotationX, 0, 0);
  setRiggedBoneRotation(state, bones.rightFoot, pose.rightFootRotationX, 0, 0);
  player.userData.riggedBoneAnimationInitialized = true;
  return true;
}

export function updateRunAnimation(
  player: THREE.Object3D,
  deltaTime: number,
  speed: number,
  config: RunAnimationConfig = RUN_ANIMATION_CONFIG,
): void {
  const deltaSeconds = clamp(deltaTime, 0, config.maxDeltaSeconds);
  const clampedSpeed = Math.max(0, speed);
  const riggedState = getOrCreateRiggedPlayerAnimationState(player);

  player.userData.runAnimationInitialized = true;

  if (riggedState) {
    updateRiggedRunAnimation(player, riggedState, deltaSeconds, clampedSpeed, config);
    return;
  }

  const pivots = ensureRunAnimationPivots(player);

  if (clampedSpeed <= config.speedThreshold || deltaSeconds === 0) {
    const alpha = calculateDampingAlpha(config.neutralReturnRate, deltaSeconds);
    dampPivotToNeutral(pivots.leftArmPivot, alpha);
    dampPivotToNeutral(pivots.rightArmPivot, alpha);
    dampPivotToNeutral(pivots.leftLegPivot, alpha);
    dampPivotToNeutral(pivots.rightLegPivot, alpha);
    return;
  }

  const previousPhase = typeof player.userData.runAnimationPhase === 'number'
    ? player.userData.runAnimationPhase
    : 0;
  const strideRate = Math.min(
    config.maxStrideRadiansPerSecond,
    clampedSpeed * config.strideRadiansPerSecondPerSpeed,
  );
  const phase = wrapRadians(previousPhase + strideRate * deltaSeconds);
  const swing = Math.sin(phase);
  const swingScale = clamp(clampedSpeed / config.speedForFullSwing, 0, 1);
  const armSwing = swing * config.armSwingRadians * swingScale;
  const legSwing = swing * config.legSwingRadians * swingScale;

  player.userData.runAnimationPhase = phase;

  pivots.leftArmPivot.rotation.x = armSwing;
  pivots.leftArmPivot.rotation.y = 0;
  pivots.leftArmPivot.rotation.z = 0;
  pivots.leftLegPivot.rotation.x = -legSwing;
  pivots.leftLegPivot.rotation.y = 0;
  pivots.leftLegPivot.rotation.z = 0;
  pivots.rightArmPivot.rotation.x = -armSwing;
  pivots.rightArmPivot.rotation.y = 0;
  pivots.rightArmPivot.rotation.z = 0;
  pivots.rightLegPivot.rotation.x = legSwing;
  pivots.rightLegPivot.rotation.y = 0;
  pivots.rightLegPivot.rotation.z = 0;
}

export function updateKickAnimation(
  player: THREE.Object3D,
  progress: number,
  kickingLeg: 'left' | 'right' = 'right',
  config: KickAnimationConfig = KICK_ANIMATION_CONFIG,
): void {
  const t = clamp(progress, 0, 1);
  const kickPitch = resolveKickHipPitch(t, config);
  const plantPitch = config.plantLegPitchRadians * Math.sin(t * Math.PI);
  const armCounter = config.armCounterSwingRadians * Math.sin(t * Math.PI);
  const riggedState = getOrCreateRiggedPlayerAnimationState(player);

  player.userData.kickAnimationInitialized = true;
  player.userData.kickAnimationProgress = t;

  if (riggedState) {
    applyRiggedKickAnimation(
      riggedState,
      kickingLeg,
      kickPitch,
      plantPitch,
      armCounter,
    );
    player.userData.riggedBoneAnimationInitialized = true;
    return;
  }

  const pivots = ensureRunAnimationPivots(player);

  if (kickingLeg === 'right') {
    setPivotRotation(pivots.rightLegPivot, kickPitch);
    setPivotRotation(pivots.leftLegPivot, plantPitch);
    setPivotRotation(pivots.rightArmPivot, -armCounter);
    setPivotRotation(pivots.leftArmPivot, armCounter * 0.55);
    return;
  }

  setPivotRotation(pivots.leftLegPivot, kickPitch);
  setPivotRotation(pivots.rightLegPivot, plantPitch);
  setPivotRotation(pivots.leftArmPivot, -armCounter);
  setPivotRotation(pivots.rightArmPivot, armCounter * 0.55);
}

function getOrCreateRiggedPlayerAnimationState(
  player: THREE.Object3D,
): RiggedPlayerAnimationState | null {
  const cached = riggedPlayerAnimationStates.get(player);
  if (cached !== undefined) {
    return cached;
  }

  const bones = resolveRiggedPlayerAnimationBones(player);
  if (!bones) {
    riggedPlayerAnimationStates.set(player, null);
    return null;
  }

  const state: RiggedPlayerAnimationState = {
    bones,
    restRotations: new Map(
      Object.values(bones).map((bone) => [bone, bone.rotation.clone()]),
    ),
  };
  riggedPlayerAnimationStates.set(player, state);
  return state;
}

function resolveRiggedPlayerAnimationBones(
  player: THREE.Object3D,
): RiggedPlayerAnimationBones | null {
  const resolved = {
    hips: getBone(player, 'Hips'),
    leftArm: getBone(player, 'LeftArm'),
    leftFoot: getBone(player, 'LeftFoot'),
    leftUpLeg: getBone(player, 'LeftUpLeg'),
    rightArm: getBone(player, 'RightArm'),
    rightFoot: getBone(player, 'RightFoot'),
    rightUpLeg: getBone(player, 'RightUpLeg'),
    spine: getBone(player, 'Spine'),
    spine01: getBone(player, 'Spine01'),
    spine02: getBone(player, 'Spine02'),
  };

  return Object.values(resolved).every((bone): bone is THREE.Bone => bone instanceof THREE.Bone)
    ? resolved as RiggedPlayerAnimationBones
    : null;
}

function getBone(player: THREE.Object3D, name: string): THREE.Bone | null {
  const object = player.getObjectByName(name);
  return object instanceof THREE.Bone ? object : null;
}

function updateRiggedRunAnimation(
  player: THREE.Object3D,
  state: RiggedPlayerAnimationState,
  deltaSeconds: number,
  speed: number,
  config: RunAnimationConfig,
): void {
  const { bones } = state;
  if (speed <= config.speedThreshold || deltaSeconds === 0) {
    const alpha = calculateDampingAlpha(config.neutralReturnRate, deltaSeconds);
    dampRiggedBoneToRest(state, bones.leftArm, alpha);
    dampRiggedBoneToRest(state, bones.rightArm, alpha);
    dampRiggedBoneToRest(state, bones.leftUpLeg, alpha);
    dampRiggedBoneToRest(state, bones.rightUpLeg, alpha);
    return;
  }

  const previousPhase = typeof player.userData.runAnimationPhase === 'number'
    ? player.userData.runAnimationPhase
    : 0;
  const strideRate = Math.min(
    config.maxStrideRadiansPerSecond,
    speed * config.strideRadiansPerSecondPerSpeed,
  );
  const phase = wrapRadians(previousPhase + strideRate * deltaSeconds);
  const swing = Math.sin(phase);
  const swingScale = clamp(speed / config.speedForFullSwing, 0, 1);
  const armSwing = swing * config.armSwingRadians * swingScale;
  const legSwing = swing * config.legSwingRadians * swingScale;

  player.userData.runAnimationPhase = phase;
  setRiggedBoneRotation(state, bones.leftArm, armSwing, 0, 0);
  setRiggedBoneRotation(state, bones.rightArm, -armSwing, 0, 0);
  setRiggedBoneRotation(state, bones.leftUpLeg, -legSwing, 0, 0);
  setRiggedBoneRotation(state, bones.rightUpLeg, legSwing, 0, 0);
  player.userData.riggedBoneAnimationInitialized = true;
}

function applyRiggedKickAnimation(
  state: RiggedPlayerAnimationState,
  kickingLeg: 'left' | 'right',
  kickPitch: number,
  plantPitch: number,
  armCounter: number,
): void {
  const { bones } = state;
  if (kickingLeg === 'right') {
    setRiggedBoneRotation(state, bones.rightUpLeg, kickPitch, 0, 0);
    setRiggedBoneRotation(state, bones.leftUpLeg, plantPitch, 0, 0);
    setRiggedBoneRotation(state, bones.rightArm, -armCounter, 0, 0);
    setRiggedBoneRotation(state, bones.leftArm, armCounter * 0.55, 0, 0);
    return;
  }

  setRiggedBoneRotation(state, bones.leftUpLeg, kickPitch, 0, 0);
  setRiggedBoneRotation(state, bones.rightUpLeg, plantPitch, 0, 0);
  setRiggedBoneRotation(state, bones.leftArm, -armCounter, 0, 0);
  setRiggedBoneRotation(state, bones.rightArm, armCounter * 0.55, 0, 0);
}

function setRiggedBoneRotation(
  state: RiggedPlayerAnimationState,
  bone: THREE.Bone,
  x: number,
  y: number,
  z: number,
): void {
  const rest = state.restRotations.get(bone);
  if (!rest) {
    return;
  }
  bone.rotation.set(rest.x + x, rest.y + y, rest.z + z, rest.order);
}

function dampRiggedBoneToRest(
  state: RiggedPlayerAnimationState,
  bone: THREE.Bone,
  alpha: number,
): void {
  const rest = state.restRotations.get(bone);
  if (!rest) {
    return;
  }
  bone.rotation.x = lerp(bone.rotation.x, rest.x, alpha);
  bone.rotation.y = lerp(bone.rotation.y, rest.y, alpha);
  bone.rotation.z = lerp(bone.rotation.z, rest.z, alpha);
}

function ensurePivot(
  player: THREE.Object3D,
  bodyRoot: THREE.Object3D,
  spec: (typeof PIVOT_SPECS)[number],
): THREE.Object3D {
  let pivot = player.getObjectByName(spec.pivotName);

  if (!pivot) {
    pivot = new THREE.Group();
    pivot.name = spec.pivotName;
    pivot.position.copy(spec.position);
    bodyRoot.add(pivot);
  }

  player.updateWorldMatrix(true, true);
  bodyRoot.updateWorldMatrix(true, true);
  pivot.updateWorldMatrix(true, true);

  for (const meshName of spec.meshNames) {
    const mesh = player.getObjectByName(meshName);
    if (mesh && !isDescendantOf(mesh, pivot)) {
      pivot.attach(mesh);
    }
  }

  player.userData[spec.userDataKey] = pivot;
  return pivot;
}

function isDescendantOf(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;

  while (current) {
    if (current === ancestor) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function dampPivotToNeutral(pivot: THREE.Object3D, alpha: number): void {
  pivot.rotation.x = lerp(pivot.rotation.x, 0, alpha);
  pivot.rotation.y = lerp(pivot.rotation.y, 0, alpha);
  pivot.rotation.z = lerp(pivot.rotation.z, 0, alpha);
}

function setPivotRotation(pivot: THREE.Object3D, rotationX: number): void {
  pivot.rotation.x = rotationX;
  pivot.rotation.y = 0;
  pivot.rotation.z = 0;
}

function resolveKickHipPitch(progress: number, config: KickAnimationConfig): number {
  if (progress <= config.backswingProgress) {
    return lerp(
      0,
      config.backswingRadians,
      easeInOut(progress / Math.max(0.001, config.backswingProgress)),
    );
  }

  if (progress <= config.forwardSwingProgress) {
    return lerp(
      config.backswingRadians,
      config.followThroughRadians,
      easeInOut(
        (progress - config.backswingProgress) /
          Math.max(0.001, config.forwardSwingProgress - config.backswingProgress),
      ),
    );
  }

  return lerp(
    config.followThroughRadians,
    config.followThroughRadians * 0.62,
    easeInOut(
      (progress - config.forwardSwingProgress) /
        Math.max(0.001, 1 - config.forwardSwingProgress),
    ),
  );
}

function easeInOut(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function calculateDampingAlpha(rate: number, deltaSeconds: number): number {
  return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, deltaSeconds));
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * clamp(alpha, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapRadians(value: number): number {
  return ((value % TWO_PI) + TWO_PI) % TWO_PI;
}
