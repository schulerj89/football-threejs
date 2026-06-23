import { validateTeamRoster } from '../roster/TeamRoster';
import { validateTeamProfile } from '../teams/TeamRegistry';
import { validateTeamRosterRatings } from '../ratings/RatingValidation';
import { calculateLeagueContentHash, validateAttributeOrder } from './LeagueDataCodec';
import {
  LEAGUE_GENERATOR_VERSION,
  LEAGUE_SCHEMA_VERSION,
  type EncodedLeagueData,
  type LeagueData,
} from './LeagueTypes';

export interface LeagueValidationIssue {
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export function validateLeagueData(data: LeagueData): LeagueValidationIssue[] {
  const issues: LeagueValidationIssue[] = [];
  if (data.schemaVersion !== LEAGUE_SCHEMA_VERSION) {
    issues.push(error(`Expected schema ${LEAGUE_SCHEMA_VERSION}, received ${data.schemaVersion}`));
  }
  if (data.generatorVersion !== LEAGUE_GENERATOR_VERSION) {
    issues.push(error(`Expected generator ${LEAGUE_GENERATOR_VERSION}, received ${data.generatorVersion}`));
  }
  if (data.teams.length !== 6) {
    issues.push(error(`Expected six teams, received ${data.teams.length}`));
  }
  if (data.rosters.length !== 6) {
    issues.push(error(`Expected six rosters, received ${data.rosters.length}`));
  }

  const teamIds = new Set<string>();
  const rosterIds = new Set<string>();
  const playerIds = new Set<string>();
  for (const team of data.teams) {
    if (teamIds.has(team.id)) {
      issues.push(error(`Duplicate team ID ${team.id}`));
    }
    teamIds.add(team.id);
    issues.push(...validateTeamProfile(team).map((message) => error(message)));
  }

  for (const roster of data.rosters) {
    if (rosterIds.has(roster.teamId)) {
      issues.push(error(`Duplicate roster ID ${roster.teamId}`));
    }
    rosterIds.add(roster.teamId);
    if (!teamIds.has(roster.teamId)) {
      issues.push(error(`Roster ${roster.teamId} has no matching team profile`));
    }
    if (roster.offensiveStarterIds.length < 11) {
      issues.push(error(`${roster.teamId} has fewer than 11 offensive starters`));
    }
    if (roster.defensiveStarterIds.length < 11) {
      issues.push(error(`${roster.teamId} has fewer than 11 defensive starters`));
    }
    for (const rosterIssue of validateTeamRoster(roster)) {
      issues.push({
        message: rosterIssue.message,
        severity: rosterIssue.severity,
      });
    }
    for (const ratingIssue of validateTeamRosterRatings(roster)) {
      issues.push({
        message: ratingIssue.message,
        severity: ratingIssue.severity,
      });
    }

    const jerseyNumbers = new Set<number>();
    for (const player of roster.players) {
      if (playerIds.has(player.id)) {
        issues.push(error(`Duplicate league player ID ${player.id}`));
      }
      playerIds.add(player.id);
      if (jerseyNumbers.has(player.jerseyNumber)) {
        issues.push(error(`${roster.teamId} duplicate jersey number ${player.jerseyNumber}`));
      }
      jerseyNumbers.add(player.jerseyNumber);
    }
  }

  return issues;
}

export function validateEncodedLeagueData(data: EncodedLeagueData): LeagueValidationIssue[] {
  const issues: LeagueValidationIssue[] = [];
  issues.push(...validateAttributeOrder(data.rosters[0]?.players[0]?.ratings ?? [])
    .map((message) => error(message)));

  const expectedHash = calculateLeagueContentHash(data);
  if (data.contentHash !== expectedHash) {
    issues.push(error(`League content hash mismatch: expected ${expectedHash}, received ${data.contentHash}`));
  }

  for (const roster of data.rosters) {
    for (const player of roster.players) {
      if (player.ratings.length !== data.rosters[0]?.players[0]?.ratings.length) {
        issues.push(error(`${player.id} rating array length differs from league attribute order`));
      }
      for (const value of player.ratings) {
        if (!Number.isInteger(value) || value < -1 || value > 99) {
          issues.push(error(`${player.id} contains invalid compact rating ${String(value)}`));
        }
      }
    }
  }

  return issues;
}

export function throwOnLeagueValidationErrors(issues: readonly LeagueValidationIssue[]): void {
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((issue) => issue.message).join('; '));
  }
}

function error(message: string): LeagueValidationIssue {
  return { message, severity: 'error' };
}
