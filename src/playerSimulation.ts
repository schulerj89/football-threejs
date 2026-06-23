import type { PlayableFieldBounds } from './field';
import {
  type PlayerModel,
  type Vector2,
} from './playerModel';

export interface PlayerSimulationOptions {
  clampSidelines?: boolean;
}

export function updatePlayerSimulation(
  player: PlayerModel,
  input: Vector2,
  deltaSeconds: number,
  bounds: PlayableFieldBounds,
  options: PlayerSimulationOptions = {},
): void {
  const delta = clamp(deltaSeconds, 0, 0.1);
  const hasInput = input.x !== 0 || input.z !== 0;
  const targetVelocity = hasInput
    ? {
        x: input.x * player.movement.maxSpeed,
        z: input.z * player.movement.maxSpeed,
      }
    : { x: 0, z: 0 };
  const velocityStep =
    (hasInput ? player.movement.acceleration : player.movement.deceleration) * delta;

  player.velocity = moveVectorToward(player.velocity, targetVelocity, velocityStep);

  if (hasInput) {
    player.facingRadians = Math.atan2(input.x, input.z);
  }

  player.position.x += player.velocity.x * delta;
  player.position.z += player.velocity.z * delta;
  keepPlayerInPlayableBounds(player, bounds, options);
}

function keepPlayerInPlayableBounds(
  player: PlayerModel,
  bounds: PlayableFieldBounds,
  options: PlayerSimulationOptions,
): void {
  const clampSidelines = options.clampSidelines ?? true;
  const minX = bounds.minX + player.collisionRadius;
  const maxX = bounds.maxX - player.collisionRadius;
  const minZ = bounds.minZ + player.collisionRadius;
  const maxZ = bounds.maxZ - player.collisionRadius;
  const clampedZ = clamp(player.position.z, minZ, maxZ);

  if (clampSidelines) {
    const clampedX = clamp(player.position.x, minX, maxX);

    if (clampedX !== player.position.x) {
      player.position.x = clampedX;
      player.velocity.x = 0;
    }
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
