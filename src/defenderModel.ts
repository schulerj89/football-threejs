import { OPPOSING_GOAL_LINE_Z } from './field';
import type { FootballSpot } from './fieldScale';
import { createPlayerModel, type PlayerModel, type PlayerSnapshot, type Vector2 } from './playerModel';

export type DefenderModel = PlayerModel;
export type DefenderSnapshot = PlayerSnapshot;

export const DEFENDER_COLLISION_RADII = {
  ballCarrier: 0.75,
  defender: 0.75,
} as const;

export const DEFENDER_CONFIG = {
  initialPosition: { x: 0, z: 30 },
  initialDepthFromBall: 45,
  initialFacingRadians: Math.PI,
  pursuitSpeed: 9.5,
  steeringRateRadiansPerSecond: 2.4,
  tackleRadius: DEFENDER_COLLISION_RADII.ballCarrier + DEFENDER_COLLISION_RADII.defender,
} as const;

const TACKLE_CONTACT_EPSILON = 0.0001;

export function createDefenderModel(ballSpot?: FootballSpot): DefenderModel {
  return createPlayerModel(getDefenderResetPosition(ballSpot), {
    facingRadians: DEFENDER_CONFIG.initialFacingRadians,
    id: 'defense-rusher-left',
    role: 'defender',
    state: 'idle',
    team: 'defense',
  });
}

export function resetDefenderModel(defender: DefenderModel, ballSpot?: FootballSpot): void {
  const resetPosition = getDefenderResetPosition(ballSpot);

  defender.position.x = resetPosition.x;
  defender.position.z = resetPosition.z;
  defender.velocity.x = 0;
  defender.velocity.z = 0;
  defender.facingRadians = DEFENDER_CONFIG.initialFacingRadians;
}

export function updateDefenderPursuit(
  defender: DefenderModel,
  carrier: PlayerModel,
  deltaSeconds: number,
  speedMultiplier = 1,
): void {
  const delta = Math.max(0, deltaSeconds);
  const desiredFacing = Math.atan2(
    carrier.position.x - defender.position.x,
    carrier.position.z - defender.position.z,
  );
  const maxTurn = DEFENDER_CONFIG.steeringRateRadiansPerSecond * delta;
  const speed = DEFENDER_CONFIG.pursuitSpeed * speedMultiplier;

  defender.facingRadians = rotateToward(defender.facingRadians, desiredFacing, maxTurn);
  defender.velocity.x = Math.sin(defender.facingRadians) * speed;
  defender.velocity.z = Math.cos(defender.facingRadians) * speed;
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

  return distance <= DEFENDER_CONFIG.tackleRadius + TACKLE_CONTACT_EPSILON;
}

export function snapshotDefenderModel(defender: DefenderModel): DefenderSnapshot {
  return {
    collisionRadius: defender.collisionRadius,
    currentState: defender.currentState,
    facingRadians: defender.facingRadians,
    id: defender.id,
    position: { ...defender.position },
    role: defender.role,
    team: defender.team,
    velocity: { ...defender.velocity },
  };
}

function getDefenderResetPosition(ballSpot?: FootballSpot): Vector2 {
  if (!ballSpot) {
    return { ...DEFENDER_CONFIG.initialPosition };
  }

  return {
    x: DEFENDER_CONFIG.initialPosition.x,
    z: Math.min(OPPOSING_GOAL_LINE_Z - 2, ballSpot.z + DEFENDER_CONFIG.initialDepthFromBall),
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
