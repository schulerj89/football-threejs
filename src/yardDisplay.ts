export function roundFootballYardsForDisplay(yards: number): number {
  if (!Number.isFinite(yards)) {
    return 0;
  }

  const rounded = Math.round(Math.abs(yards));
  const signed = yards < 0 ? -rounded : rounded;
  return Object.is(signed, -0) ? 0 : signed;
}

export function formatWholeFootballYards(yards: number): string {
  return roundFootballYardsForDisplay(yards).toString();
}

export function formatYardsToGoForDisplay(yardsToGo: number): string {
  if (yardsToGo <= 0) {
    return 'GOAL';
  }

  return Math.max(1, roundFootballYardsForDisplay(yardsToGo)).toString();
}

export function formatYardGainForDisplay(yardsGained: number): string {
  const roundedYards = roundFootballYardsForDisplay(yardsGained);

  if (roundedYards > 0) {
    return `+${roundedYards} yards`;
  }

  return `${roundedYards} yards`;
}
