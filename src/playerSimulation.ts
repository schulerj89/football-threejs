import type { PlayableFieldBounds } from './field';
import {
  PLAYER_MOVEMENT_CONFIG,
  type PlayerModel,
  type Vector2,
} from './playerModel';

export function updatePlayerSimulation(
  player: PlayerModel,
  input: Vector2,
  deltaSeconds: number,
  bounds: PlayableFieldBounds,
): void {
  const delta = clamp(deltaSeconds, 0, 0.1);
  const hasInput = input.x !== 0 || input.z !== 0;
  const targetVelocity = hasInput
    ? {
        x: input.x * PLAYER_MOVEMENT_CONFIG.maxSpeed,
        z: input.z * PLAYER_MOVEMENT_CONFIG.maxSpeed,
      }
    : { x: 0, z: 0 };
  const velocityStep =
    (hasInput ? PLAYER_MOVEMENT_CONFIG.acceleration : PLAYER_MOVEMENT_CONFIG.deceleration) * delta;

  player.velocity = moveVectorToward(player.velocity, targetVelocity, velocityStep);

  if (hasInput) {
    player.facingRadians = Math.atan2(input.x, input.z);
  }

  player.position.x += player.velocity.x * delta;
  player.position.z += player.velocity.z * delta;
  keepPlayerInPlayableBounds(player, bounds);
}

function keepPlayerInPlayableBounds(player: PlayerModel, bounds: PlayableFieldBounds): void {
  const minX = bounds.minX + PLAYER_MOVEMENT_CONFIG.halfWidth;
  const maxX = bounds.maxX - PLAYER_MOVEMENT_CONFIG.halfWidth;
  const minZ = bounds.minZ + PLAYER_MOVEMENT_CONFIG.halfDepth;
  const maxZ = bounds.maxZ - PLAYER_MOVEMENT_CONFIG.halfDepth;
  const clampedX = clamp(player.position.x, minX, maxX);
  const clampedZ = clamp(player.position.z, minZ, maxZ);

  if (clampedX !== player.position.x) {
    player.position.x = clampedX;
    player.velocity.x = 0;
  }

  if (clampedZ !== player.position.z) {
    player.position.z = clampedZ;
    player.velocity.z = 0;
  }
}

function moveVectorToward(current: Vector2, target: Vector2, maxDelta: number): Vector2 {
  const deltaX = target.x - current.x;
  const deltaZ = target.z - current.z;
  const distance = Math.hypot(deltaX, deltaZ);

  if (distance <= maxDelta || distance === 0) {
    return { ...target };
  }

  const step = maxDelta / distance;
  return {
    x: current.x + deltaX * step,
    z: current.z + deltaZ * step,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

