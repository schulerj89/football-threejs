import type { PlayerModel, Vector2 } from './playerModel';

export interface DefenderModel {
  position: Vector2;
  velocity: Vector2;
  facingRadians: number;
}

export interface DefenderSnapshot {
  position: Vector2;
  velocity: Vector2;
  facingRadians: number;
}

export const DEFENDER_COLLISION_RADII = {
  ballCarrier: 0.75,
  defender: 0.75,
} as const;

export const DEFENDER_CONFIG = {
  initialPosition: { x: 0, z: 18 },
  initialFacingRadians: Math.PI,
  pursuitSpeed: 12,
  steeringRateRadiansPerSecond: 2.4,
  tackleRadius: DEFENDER_COLLISION_RADII.ballCarrier + DEFENDER_COLLISION_RADII.defender,
} as const;

export function createDefenderModel(): DefenderModel {
  return {
    position: { ...DEFENDER_CONFIG.initialPosition },
    velocity: { x: 0, z: 0 },
    facingRadians: DEFENDER_CONFIG.initialFacingRadians,
  };
}

export function resetDefenderModel(defender: DefenderModel): void {
  defender.position.x = DEFENDER_CONFIG.initialPosition.x;
  defender.position.z = DEFENDER_CONFIG.initialPosition.z;
  defender.velocity.x = 0;
  defender.velocity.z = 0;
  defender.facingRadians = DEFENDER_CONFIG.initialFacingRadians;
}

export function updateDefenderPursuit(
  defender: DefenderModel,
  carrier: PlayerModel,
  deltaSeconds: number,
): void {
  const delta = Math.max(0, deltaSeconds);
  const desiredFacing = Math.atan2(
    carrier.position.x - defender.position.x,
    carrier.position.z - defender.position.z,
  );
  const maxTurn = DEFENDER_CONFIG.steeringRateRadiansPerSecond * delta;

  defender.facingRadians = rotateToward(defender.facingRadians, desiredFacing, maxTurn);
  defender.velocity.x = Math.sin(defender.facingRadians) * DEFENDER_CONFIG.pursuitSpeed;
  defender.velocity.z = Math.cos(defender.facingRadians) * DEFENDER_CONFIG.pursuitSpeed;
  defender.position.x += defender.velocity.x * delta;
  defender.position.z += defender.velocity.z * delta;
}

export function stopDefender(defender: DefenderModel): void {
  defender.velocity.x = 0;
  defender.velocity.z = 0;
}

export function isTackleContact(defender: DefenderModel, carrier: PlayerModel): boolean {
  const distance = Math.hypot(
    defender.position.x - carrier.position.x,
    defender.position.z - carrier.position.z,
  );

  return distance <= DEFENDER_CONFIG.tackleRadius;
}

export function snapshotDefenderModel(defender: DefenderModel): DefenderSnapshot {
  return {
    position: { ...defender.position },
    velocity: { ...defender.velocity },
    facingRadians: defender.facingRadians,
  };
}

function rotateToward(current: number, target: number, maxDelta: number): number {
  const delta = normalizeAngle(target - current);

  if (Math.abs(delta) <= maxDelta) {
    return target;
  }

  return current + Math.sign(delta) * maxDelta;
}

function normalizeAngle(angle: number): number {
  let normalized = angle;

  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  while (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }

  return normalized;
}
