import { INITIAL_BALL_SPOT } from './field';
import type { FootballSpot } from './fieldScale';

export interface Vector2 {
  x: number;
  z: number;
}

export type PlayerTeam = 'offense' | 'defense';
export type PlayerRole =
  | 'runner'
  | 'quarterback'
  | 'receiver'
  | 'blocker'
  | 'defender'
  | 'coverageDefender';
export type PlayerState =
  | 'idle'
  | 'userControlled'
  | 'movingToLane'
  | 'runningRoute'
  | 'pursuing'
  | 'engaged';

export interface PlayerModel {
  collisionRadius: number;
  currentState: PlayerState;
  facingRadians: number;
  id: string;
  position: Vector2;
  role: PlayerRole;
  team: PlayerTeam;
  velocity: Vector2;
}

export interface PlayerSnapshot {
  collisionRadius: number;
  currentState: PlayerState;
  facingRadians: number;
  id: string;
  position: Vector2;
  role: PlayerRole;
  team: PlayerTeam;
  velocity: Vector2;
}

export const RUNNER_PLAYER_ID = 'runner';

export const PLAYER_MOVEMENT_CONFIG = {
  maxSpeed: 18,
  acceleration: 56,
  deceleration: 72,
  collisionRadius: 0.75,
  halfWidth: 0.75,
  halfDepth: 0.75,
  initialFacingRadians: 0,
} as const;

export interface CreatePlayerModelOptions {
  collisionRadius?: number;
  facingRadians?: number;
  id?: string;
  role?: PlayerRole;
  state?: PlayerState;
  team?: PlayerTeam;
}

export function createPlayerModel(
  initialSpot: FootballSpot = INITIAL_BALL_SPOT,
  options: CreatePlayerModelOptions = {},
): PlayerModel {
  const player = {
    collisionRadius: options.collisionRadius ?? PLAYER_MOVEMENT_CONFIG.collisionRadius,
    currentState: options.state ?? 'idle',
    facingRadians: options.facingRadians ?? PLAYER_MOVEMENT_CONFIG.initialFacingRadians,
    id: options.id ?? RUNNER_PLAYER_ID,
    position: { x: initialSpot.x, z: initialSpot.z },
    role: options.role ?? 'runner',
    team: options.team ?? 'offense',
    velocity: { x: 0, z: 0 },
  };

  return player;
}

export function resetPlayerModel(
  player: PlayerModel,
  spot: FootballSpot = INITIAL_BALL_SPOT,
  state: PlayerState = 'idle',
): void {
  player.position.x = spot.x;
  player.position.z = spot.z;
  player.velocity.x = 0;
  player.velocity.z = 0;
  player.facingRadians = PLAYER_MOVEMENT_CONFIG.initialFacingRadians;
  player.currentState = state;
}

export function snapshotPlayerModel(player: PlayerModel): PlayerSnapshot {
  return {
    collisionRadius: player.collisionRadius,
    currentState: player.currentState,
    facingRadians: player.facingRadians,
    id: player.id,
    position: { ...player.position },
    role: player.role,
    team: player.team,
    velocity: { ...player.velocity },
  };
}
