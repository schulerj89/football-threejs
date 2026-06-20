import { LINE_OF_SCRIMMAGE_Z } from './field';

export interface Vector2 {
  x: number;
  z: number;
}

export interface PlayerModel {
  position: Vector2;
  velocity: Vector2;
  facingRadians: number;
}

export interface PlayerSnapshot {
  position: Vector2;
  velocity: Vector2;
  facingRadians: number;
}

export const PLAYER_MOVEMENT_CONFIG = {
  maxSpeed: 18,
  acceleration: 56,
  deceleration: 72,
  halfWidth: 0.7,
  halfDepth: 0.7,
  initialFacingRadians: 0,
} as const;

export function createPlayerModel(): PlayerModel {
  return {
    position: { x: 0, z: LINE_OF_SCRIMMAGE_Z },
    velocity: { x: 0, z: 0 },
    facingRadians: PLAYER_MOVEMENT_CONFIG.initialFacingRadians,
  };
}

export function snapshotPlayerModel(player: PlayerModel): PlayerSnapshot {
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingRadians: player.facingRadians,
  };
}

