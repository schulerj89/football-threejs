import type { FootballPosition } from '../roster/RosterPlayer';
import type { PlayerRatings } from './PlayerRatings';
import { getPositionRatingProfile, getOverallWeightTotal } from './PositionRatingProfile';

export function calculateOverallRating(position: FootballPosition, ratings: PlayerRatings): number {
  const profile = getPositionRatingProfile(position);
  const totalWeight = getOverallWeightTotal(position);

  if (totalWeight <= 0) {
    return 0;
  }

  const weighted = Object.entries(profile.overallWeights)
    .reduce((sum, [key, weight]) => {
      const rating = ratings[key as keyof PlayerRatings];
      if (rating === undefined || weight === undefined) {
        return sum;
      }

      return sum + rating * weight;
    }, 0);

  return clampOverall(weighted / totalWeight);
}

export function calculateWeightedRating(
  ratings: PlayerRatings,
  weights: Readonly<Partial<Record<keyof PlayerRatings, number>>>,
): number {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + (weight ?? 0), 0);

  if (totalWeight <= 0) {
    return 0;
  }

  const weighted = Object.entries(weights).reduce((sum, [key, weight]) => {
    const rating = ratings[key as keyof PlayerRatings];
    if (rating === undefined || weight === undefined) {
      return sum;
    }

    return sum + rating * weight;
  }, 0);

  return clampOverall(weighted / totalWeight);
}

function clampOverall(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}
