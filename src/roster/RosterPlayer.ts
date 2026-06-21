export type FootballPosition =
  | 'C'
  | 'CB'
  | 'DL'
  | 'FS'
  | 'ILB'
  | 'K'
  | 'LG'
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
  lastName: string;
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
): RosterPlayer {
  return {
    appearanceId: `${teamId}-${position.toLowerCase()}-${jerseyNumber}`,
    archetype,
    displayName: `${firstName} ${lastName}`,
    firstName,
    footballPosition: position,
    id: `${teamId}-${position.toLowerCase()}-${jerseyNumber}`,
    jerseyNumber,
    lastName,
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
