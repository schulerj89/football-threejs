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

const TWO_PI = Math.PI * 2;
const ARM_X = PLAYER_BODY_DIMENSIONS.shoulderWidth / 2 - PLAYER_BODY_DIMENSIONS.armInsetX;

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

export function updateRunAnimation(
  player: THREE.Object3D,
  deltaTime: number,
  speed: number,
  config: RunAnimationConfig = RUN_ANIMATION_CONFIG,
): void {
  const pivots = ensureRunAnimationPivots(player);
  const deltaSeconds = clamp(deltaTime, 0, config.maxDeltaSeconds);
  const clampedSpeed = Math.max(0, speed);

  player.userData.runAnimationInitialized = true;

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
