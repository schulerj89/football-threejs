import type { RosterPlayer } from './RosterPlayer';

export interface QuarterbackRatings {
  accuracy: number;
  mobility: number;
  throwPower: number;
}

export const GENERIC_QUARTERBACK_RATINGS: QuarterbackRatings = {
  accuracy: 76,
  mobility: 72,
  throwPower: 78,
} as const;

const QUARTERBACK_RATINGS: Readonly<Record<string, QuarterbackRatings>> = {
  'bay-city-current-qb-6': { accuracy: 90, mobility: 68, throwPower: 77 },
  'desert-ridge-scorpions-qb-3': { accuracy: 84, mobility: 76, throwPower: 93 },
  'ironwood-owls-qb-4': { accuracy: 86, mobility: 66, throwPower: 80 },
  'lakefront-lights-qb-8': { accuracy: 92, mobility: 70, throwPower: 79 },
  'metro-meteors-qb-12': { accuracy: 82, mobility: 74, throwPower: 91 },
  'summit-forge-qb-14': { accuracy: 80, mobility: 72, throwPower: 88 },
} as const;

export function getQuarterbackRatings(player: RosterPlayer | null): QuarterbackRatings {
  if (!player || player.footballPosition !== 'QB') {
    return { ...GENERIC_QUARTERBACK_RATINGS };
  }

  if (player.ratings.THA !== undefined && player.ratings.THP !== undefined) {
    return {
      accuracy: player.ratings.THA,
      mobility: Math.round(
        ((player.ratings.SPD ?? GENERIC_QUARTERBACK_RATINGS.mobility) +
          (player.ratings.ACC ?? GENERIC_QUARTERBACK_RATINGS.mobility) +
          (player.ratings.AGI ?? GENERIC_QUARTERBACK_RATINGS.mobility)) / 3,
      ),
      throwPower: player.ratings.THP,
    };
  }

  return {
    ...(QUARTERBACK_RATINGS[player.id] ?? GENERIC_QUARTERBACK_RATINGS),
  };
}

export function validateQuarterbackRatings(ratings: QuarterbackRatings): boolean {
  return (
    isRatingValue(ratings.accuracy) &&
    isRatingValue(ratings.mobility) &&
    isRatingValue(ratings.throwPower)
  );
}

function isRatingValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 99;
}
