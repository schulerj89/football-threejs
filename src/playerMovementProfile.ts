import {
  DEFAULT_PLAYER_MOVEMENT_PROFILE,
  clonePlayerMovementProfile,
  type PlayerModel,
  type PlayerMovementProfile,
} from './playerModel';
import { getRosterPlayerForGameplayId, type GameplayRosterBinding } from './roster/GameplayRosterBinding';
import type { RosterPlayer } from './roster/RosterPlayer';

export const RATED_PLAYER_MOVEMENT_CONFIG = {
  minAcceleration: 30,
  maxAcceleration: 54,
  minDeceleration: 38,
  maxDeceleration: 68,
  minSpeed: 8.6,
  maxSpeed: 12.4,
} as const;

export function createPlayerMovementProfileFromRosterPlayer(
  player: RosterPlayer,
): PlayerMovementProfile {
  const speedRating = getRating(player, 'SPD');
  const accelerationRating = getRating(player, 'ACC');
  const changeOfDirectionRating = getRating(player, 'COD', getRating(player, 'AGI'));

  return {
    acceleration: interpolateRating(
      accelerationRating,
      RATED_PLAYER_MOVEMENT_CONFIG.minAcceleration,
      RATED_PLAYER_MOVEMENT_CONFIG.maxAcceleration,
    ),
    deceleration: interpolateRating(
      (accelerationRating + changeOfDirectionRating) / 2,
      RATED_PLAYER_MOVEMENT_CONFIG.minDeceleration,
      RATED_PLAYER_MOVEMENT_CONFIG.maxDeceleration,
    ),
    maxSpeed: interpolateRating(
      speedRating,
      RATED_PLAYER_MOVEMENT_CONFIG.minSpeed,
      RATED_PLAYER_MOVEMENT_CONFIG.maxSpeed,
    ),
    source: 'ratings',
  };
}

export function applyRosterMovementProfiles(
  players: readonly PlayerModel[],
  binding: GameplayRosterBinding | null,
): void {
  for (const player of players) {
    const rosterPlayer = binding ? getRosterPlayerForGameplayId(binding, player.id) : null;
    player.movement = rosterPlayer
      ? createPlayerMovementProfileFromRosterPlayer(rosterPlayer)
      : clonePlayerMovementProfile(DEFAULT_PLAYER_MOVEMENT_PROFILE);
  }
}

export function getRatedPursuitSpeed(player: PlayerModel, fallbackSpeed: number): number {
  return player.movement.source === 'ratings'
    ? player.movement.maxSpeed
    : fallbackSpeed;
}

function getRating(
  player: RosterPlayer,
  key: keyof RosterPlayer['ratings'],
  fallback = 70,
): number {
  return player.ratings[key] ?? fallback;
}

function interpolateRating(rating: number, min: number, max: number): number {
  const normalized = Math.max(0, Math.min(1, rating / 99));
  return min + (max - min) * normalized;
}
