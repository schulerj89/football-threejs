import type { RosterPlayer } from '../roster/RosterPlayer';
import type { TeamRoster } from '../roster/TeamRoster';
import {
  isPlayerAttributeKey,
  isPlayerRatingValue,
} from './PlayerAttribute';
import { calculateOverallRating } from './OverallRatingCalculator';
import type { PlayerRatings } from './PlayerRatings';
import { getPositionRatingProfile, getOverallWeightTotal, POSITION_RATING_PROFILES } from './PositionRatingProfile';
import { calculateTeamRatings } from './TeamRatingCalculator';
import { listTeamStyleProfiles } from './TeamStyleProfile';

export interface RatingValidationIssue {
  readonly message: string;
  readonly playerIds: readonly string[];
  readonly severity: 'error' | 'warning';
}

export function validatePlayerRatings(player: RosterPlayer): RatingValidationIssue[] {
  const issues: RatingValidationIssue[] = [];
  const ratings = player.ratings as Record<string, unknown>;
  const profile = getPositionRatingProfile(player.footballPosition);

  for (const key of Object.keys(ratings)) {
    if (!isPlayerAttributeKey(key)) {
      issues.push({
        message: `${player.id} has unknown rating attribute ${key}`,
        playerIds: [player.id],
        severity: 'error',
      });
      continue;
    }

    if (!isPlayerRatingValue(ratings[key])) {
      issues.push({
        message: `${player.id} has invalid ${key} rating ${String(ratings[key])}`,
        playerIds: [player.id],
        severity: 'error',
      });
    }
  }

  for (const key of profile.required) {
    if (!isPlayerRatingValue(ratings[key])) {
      issues.push({
        message: `${player.id} is missing required ${key} rating for ${player.footballPosition}`,
        playerIds: [player.id],
        severity: 'error',
      });
    }
  }

  const overall = calculateOverallRating(player.footballPosition, player.ratings);
  if (!isPlayerRatingValue(overall)) {
    issues.push({
      message: `${player.id} calculated invalid overall ${overall}`,
      playerIds: [player.id],
      severity: 'error',
    });
  }

  return issues;
}

export function validateTeamRosterRatings(roster: TeamRoster): RatingValidationIssue[] {
  return roster.players.flatMap(validatePlayerRatings);
}

export function validatePositionRatingProfiles(): string[] {
  const errors: string[] = [];

  for (const [position, profile] of Object.entries(POSITION_RATING_PROFILES)) {
    const total = getOverallWeightTotal(position as keyof typeof POSITION_RATING_PROFILES);
    if (Math.abs(total - 1) > 0.0001) {
      errors.push(`${position}: overall weights must sum to 1, found ${total}`);
    }

    for (const key of [...profile.required, ...profile.optional, ...Object.keys(profile.overallWeights)]) {
      if (!isPlayerAttributeKey(key)) {
        errors.push(`${position}: unknown profile attribute ${key}`);
      }
    }
  }

  return errors;
}

export function validateTeamRatingsDistinct(rosters: readonly TeamRoster[]): string[] {
  const errors: string[] = [];
  const teamRatings = rosters.map((roster) => ({
    ratings: calculateTeamRatings(roster),
    teamId: roster.teamId,
  }));
  const styleProfiles = listTeamStyleProfiles();

  if (styleProfiles.length !== 6) {
    errors.push(`Expected 6 team style profiles, found ${styleProfiles.length}`);
  }

  for (const entry of teamRatings) {
    const values = Object.values(entry.ratings);
    if (values.some((value) => !isPlayerRatingValue(value))) {
      errors.push(`${entry.teamId}: team ratings must be 0-99 integers`);
    }
  }

  const maxOverall = Math.max(...teamRatings.map((entry) => entry.ratings.overall));
  const minOverall = Math.min(...teamRatings.map((entry) => entry.ratings.overall));
  if (maxOverall - minOverall > 10) {
    errors.push(`Team overall spread is too large: ${minOverall}-${maxOverall}`);
  }

  const signatureSet = new Set(teamRatings.map((entry) => [
    entry.ratings.blocking,
    entry.ratings.coverage,
    entry.ratings.passRush,
    entry.ratings.passing,
    entry.ratings.rushing,
  ].join('|')));
  if (signatureSet.size !== teamRatings.length) {
    errors.push('Every team should have a distinct measurable rating signature');
  }

  return errors;
}

export function createPlayerWithRatingsForValidation(
  player: RosterPlayer,
  ratings: PlayerRatings,
): RosterPlayer {
  return {
    ...player,
    ratings,
  };
}
