import type { MatchPossession } from './MatchTypes';

export function resolveOpeningPossession(seed: number): MatchPossession {
  return normalizeSeed(seed) % 2 === 0 ? 'user' : 'opponent';
}

export function resolveSecondHalfPossession(openingPossession: MatchPossession): MatchPossession {
  return openingPossession === 'user' ? 'opponent' : 'user';
}

export function otherPossession(possession: MatchPossession): MatchPossession {
  return possession === 'user' ? 'opponent' : 'user';
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return 0;
  }

  return Math.abs(Math.trunc(seed));
}
