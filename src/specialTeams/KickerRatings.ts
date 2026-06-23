import type { RosterPlayer } from '../roster/RosterPlayer';

export interface KickerRatings {
  kickAccuracy: number;
  kickPower: number;
}

export const GENERIC_KICKER_RATINGS: KickerRatings = {
  kickAccuracy: 76,
  kickPower: 78,
} as const;

const KICKER_RATINGS: Readonly<Record<string, KickerRatings>> = {
  'bay-city-current-k-5': { kickAccuracy: 87, kickPower: 79 },
  'lakefront-lights-k-5': { kickAccuracy: 91, kickPower: 77 },
  'metro-meteors-k-5': { kickAccuracy: 82, kickPower: 90 },
  'summit-forge-k-5': { kickAccuracy: 78, kickPower: 88 },
} as const;

export function getKickerRatings(player: RosterPlayer | null): KickerRatings {
  if (!player || player.footballPosition !== 'K') {
    return { ...GENERIC_KICKER_RATINGS };
  }

  if (player.ratings.KAC !== undefined && player.ratings.KPW !== undefined) {
    return {
      kickAccuracy: player.ratings.KAC,
      kickPower: player.ratings.KPW,
    };
  }

  return {
    ...(player.kickerRatings ?? KICKER_RATINGS[player.id] ?? GENERIC_KICKER_RATINGS),
  };
}

export function getStoredKickerRatingsForPlayerId(playerId: string): KickerRatings | null {
  const ratings = KICKER_RATINGS[playerId];
  return ratings ? { ...ratings } : null;
}

export function validateKickerRatings(ratings: KickerRatings): boolean {
  return isRatingValue(ratings.kickAccuracy) && isRatingValue(ratings.kickPower);
}

function isRatingValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 99;
}
