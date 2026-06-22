import {
  createRosterPlayer,
  validateRosterPlayer,
  type FootballPosition,
  type PlayerArchetype,
  type RosterPlayer,
  type RosterValidationIssue,
} from './RosterPlayer';
import { getStoredKickerRatingsForPlayerId } from '../specialTeams/KickerRatings';

export interface TeamRoster {
  defensiveStarterIds: readonly string[];
  kickerId: string;
  offensiveStarterIds: readonly string[];
  players: readonly RosterPlayer[];
  punterId: string;
  teamId: string;
}

export interface StarterSeed {
  archetype: PlayerArchetype;
  firstName: string;
  jerseyNumber: number;
  lastName: string;
  position: FootballPosition;
}

export const OFFENSIVE_STARTER_POSITIONS = [
  'QB',
  'RB',
  'C',
  'LG',
  'RG',
  'LT',
  'RT',
  'TE',
  'SLOT',
  'WR',
  'WR',
] as const satisfies readonly FootballPosition[];

export const DEFENSIVE_STARTER_POSITIONS = [
  'DL',
  'DL',
  'DL',
  'OLB',
  'OLB',
  'ILB',
  'ILB',
  'CB',
  'CB',
  'FS',
  'SS',
] as const satisfies readonly FootballPosition[];

export function createTeamRoster(
  teamId: string,
  offense: readonly StarterSeed[],
  defense: readonly StarterSeed[],
  specialists: readonly StarterSeed[],
): TeamRoster {
  const players = [...offense, ...defense, ...specialists].map((seed) => {
    const playerId = `${teamId}-${seed.position.toLowerCase()}-${seed.jerseyNumber}`;
    return createRosterPlayer(
      teamId,
      seed.position,
      seed.jerseyNumber,
      seed.firstName,
      seed.lastName,
      seed.archetype,
      seed.position === 'K'
        ? getStoredKickerRatingsForPlayerId(playerId) ?? undefined
        : undefined,
    );
  });
  const kicker = players.find((player) => player.footballPosition === 'K');
  const punter = players.find((player) => player.footballPosition === 'P');

  if (!kicker || !punter) {
    throw new Error(`Roster ${teamId} must define kicker and punter`);
  }

  return {
    defensiveStarterIds: players.slice(offense.length, offense.length + defense.length)
      .map((player) => player.id),
    kickerId: kicker.id,
    offensiveStarterIds: offense.map((_, index) => players[index].id),
    players,
    punterId: punter.id,
    teamId,
  };
}

export function getRosterPlayer(
  roster: TeamRoster,
  rosterPlayerId: string,
): RosterPlayer | null {
  return roster.players.find((player) => player.id === rosterPlayerId) ?? null;
}

export function validateTeamRoster(roster: TeamRoster): RosterValidationIssue[] {
  const issues: RosterValidationIssue[] = [];
  const ids = new Set<string>();
  const numbers = new Map<number, string>();

  if (roster.offensiveStarterIds.length !== 11) {
    issues.push({
      message: `${roster.teamId} must have 11 offensive starters`,
      playerIds: [...roster.offensiveStarterIds],
      severity: 'error',
    });
  }

  if (roster.defensiveStarterIds.length !== 11) {
    issues.push({
      message: `${roster.teamId} must have 11 defensive starters`,
      playerIds: [...roster.defensiveStarterIds],
      severity: 'error',
    });
  }

  for (const player of roster.players) {
    issues.push(...validateRosterPlayer(player));

    if (ids.has(player.id)) {
      issues.push({
        message: `Duplicate roster player ID ${player.id}`,
        playerIds: [player.id],
        severity: 'error',
      });
    }
    ids.add(player.id);

    const existingPlayerId = numbers.get(player.jerseyNumber);
    if (existingPlayerId) {
      issues.push({
        message: `${roster.teamId} has duplicate jersey #${player.jerseyNumber}`,
        playerIds: [existingPlayerId, player.id],
        severity: 'error',
      });
    }
    numbers.set(player.jerseyNumber, player.id);

    if (player.teamId !== roster.teamId) {
      issues.push({
        message: `${player.id} belongs to ${player.teamId}, expected ${roster.teamId}`,
        playerIds: [player.id],
        severity: 'error',
      });
    }
  }

  for (const starterId of [...roster.offensiveStarterIds, ...roster.defensiveStarterIds, roster.kickerId, roster.punterId]) {
    if (!ids.has(starterId)) {
      issues.push({
        message: `${roster.teamId} references missing roster player ${starterId}`,
        playerIds: [starterId],
        severity: 'error',
      });
    }
  }

  return issues;
}
