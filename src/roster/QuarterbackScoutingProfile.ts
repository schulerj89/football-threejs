import { formatRosterInitialName, type RosterPlayer } from './RosterPlayer';
import {
  getQuarterbackRatings,
  type QuarterbackRatings,
} from './PlayerRatings';

export type QuarterbackArchetype =
  | 'Balanced'
  | 'Field General'
  | 'Scrambler'
  | 'Strong Arm';

export interface QuarterbackScoutingProfile {
  archetype: QuarterbackArchetype;
  formattedName: string;
  jerseyNumber: number;
  ratings: QuarterbackRatings;
  rosterPlayerId: string;
  strengths: readonly string[];
}

export function createQuarterbackScoutingProfile(
  player: RosterPlayer | null,
): QuarterbackScoutingProfile {
  const ratings = getQuarterbackRatings(player);
  return {
    archetype: deriveQuarterbackArchetype(ratings),
    formattedName: player ? formatRosterInitialName(player) : 'STARTING QB',
    jerseyNumber: player?.jerseyNumber ?? 0,
    ratings,
    rosterPlayerId: player?.id ?? 'generic-quarterback',
    strengths: deriveQuarterbackStrengths(ratings),
  };
}

export function deriveQuarterbackArchetype(
  ratings: QuarterbackRatings,
): QuarterbackArchetype {
  if (ratings.mobility >= 85) {
    return 'Scrambler';
  }

  if (ratings.throwPower >= 88 && ratings.throwPower >= ratings.accuracy) {
    return 'Strong Arm';
  }

  if (ratings.accuracy >= 88) {
    return 'Field General';
  }

  return 'Balanced';
}

export function deriveQuarterbackStrengths(
  ratings: QuarterbackRatings,
): readonly string[] {
  return [
    { label: 'Throw Power', value: ratings.throwPower },
    { label: 'Accuracy', value: ratings.accuracy },
    { label: 'Mobility', value: ratings.mobility },
  ]
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map((entry) => entry.label);
}
