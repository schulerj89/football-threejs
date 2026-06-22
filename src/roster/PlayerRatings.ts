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
  'lakefront-lights-qb-8': { accuracy: 92, mobility: 70, throwPower: 79 },
  'metro-meteors-qb-12': { accuracy: 82, mobility: 74, throwPower: 91 },
  'summit-forge-qb-14': { accuracy: 80, mobility: 72, throwPower: 88 },
} as const;

export function getQuarterbackRatings(player: RosterPlayer | null): QuarterbackRatings {
  if (!player || player.footballPosition !== 'QB') {
    return { ...GENERIC_QUARTERBACK_RATINGS };
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
