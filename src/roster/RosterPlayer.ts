import type { KickerRatings } from '../specialTeams/KickerRatings';
import {
  createDeterministicPlayerRatings,
  type PlayerRatings,
} from '../ratings/PlayerRatings';
import { validatePlayerRatings } from '../ratings/RatingValidation';

export type FootballPosition =
  | 'C'
  | 'CB'
  | 'DL'
  | 'FS'
  | 'ILB'
  | 'K'
  | 'LG'
  | 'LS'
  | 'LT'
  | 'OLB'
  | 'P'
  | 'QB'
  | 'RB'
  | 'RG'
  | 'RT'
  | 'SLOT'
  | 'SS'
  | 'TE'
  | 'WR';

export type PlayerArchetype =
  | 'accuratePasser'
  | 'balancedReceiver'
  | 'coverageSpecialist'
  | 'edgeRusher'
  | 'fieldGeneral'
  | 'interiorAnchor'
  | 'powerRunner'
  | 'specialist'
  | 'utility';

export interface RosterPlayer {
  appearanceId: string;
  archetype: PlayerArchetype;
  displayName: string;
  firstName: string;
  footballPosition: FootballPosition;
  id: string;
  jerseyNumber: number;
  kickerRatings?: KickerRatings;
  lastName: string;
  ratings: PlayerRatings;
  teamId: string;
}

export interface RosterValidationIssue {
  message: string;
  playerIds: string[];
  severity: 'error' | 'warning';
}

export function createRosterPlayer(
  teamId: string,
  position: FootballPosition,
  jerseyNumber: number,
  firstName: string,
  lastName: string,
  archetype: PlayerArchetype,
  kickerRatings?: KickerRatings,
): RosterPlayer {
  const playerId = `${teamId}-${position.toLowerCase()}-${jerseyNumber}`;

  return {
    appearanceId: `${teamId}-${position.toLowerCase()}-${jerseyNumber}`,
    archetype,
    displayName: `${firstName} ${lastName}`,
    firstName,
    footballPosition: position,
    id: playerId,
    jerseyNumber,
    ...(kickerRatings ? { kickerRatings: { ...kickerRatings } } : {}),
    lastName,
    ratings: createDeterministicPlayerRatings({
      archetype,
      kickerRatings,
      playerId,
      position,
      teamId,
    }),
    teamId,
  };
}

export function formatRosterInitialName(player: RosterPlayer): string {
  const initial = player.firstName.charAt(0).toUpperCase();
  return `${initial}. ${player.lastName.toUpperCase()}`;
}

export function validateRosterPlayer(player: RosterPlayer): RosterValidationIssue[] {
  const issues: RosterValidationIssue[] = [];

  if (!player.id || !player.teamId || !player.firstName || !player.lastName) {
    issues.push({
      message: `${player.id || 'unknown'} is missing required identity fields`,
      playerIds: [player.id],
      severity: 'error',
    });
  }

  if (!Number.isInteger(player.jerseyNumber) || player.jerseyNumber < 0 || player.jerseyNumber > 99) {
    issues.push({
      message: `${player.id} has jersey number outside 0-99`,
      playerIds: [player.id],
      severity: 'error',
    });
  }

  if (!numberMatchesPositionConvention(player.footballPosition, player.jerseyNumber)) {
    issues.push({
      message: `${player.displayName} #${player.jerseyNumber} is unusual for ${player.footballPosition}`,
      playerIds: [player.id],
      severity: 'warning',
    });
  }

  issues.push(...validatePlayerRatings(player).map((issue) => ({
    ...issue,
    playerIds: [...issue.playerIds],
  })));

  return issues;
}

export function numberMatchesPositionConvention(
  position: FootballPosition,
  jerseyNumber: number,
): boolean {
  if (jerseyNumber < 0 || jerseyNumber > 99) {
    return false;
  }

  switch (position) {
    case 'QB':
    case 'K':
    case 'P':
      return jerseyNumber <= 19;
    case 'LS':
      return jerseyNumber >= 40 && jerseyNumber <= 79;
    case 'RB':
    case 'WR':
    case 'TE':
    case 'SLOT':
      return (
        (jerseyNumber >= 0 && jerseyNumber <= 49) ||
        (jerseyNumber >= 80 && jerseyNumber <= 89)
      );
    case 'C':
    case 'LG':
    case 'LT':
    case 'RG':
    case 'RT':
      return jerseyNumber >= 50 && jerseyNumber <= 79;
    case 'DL':
      return jerseyNumber >= 50 && jerseyNumber <= 99;
    case 'CB':
    case 'FS':
    case 'ILB':
    case 'OLB':
    case 'SS':
      return jerseyNumber >= 0 && jerseyNumber <= 59;
  }
}
