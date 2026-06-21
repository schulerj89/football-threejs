import type { PlayerTeam } from '../playerModel';
import {
  ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS,
  ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS,
  FIVE_ON_FIVE_DEFENSE_PLAYER_IDS,
  FIVE_ON_FIVE_OFFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS,
  type PlaybookId,
} from '../roster';
import type { FootballPosition, RosterPlayer } from './RosterPlayer';
import type { TeamRoster } from './TeamRoster';

export interface LineupPositionReference {
  occurrence?: number;
  position: FootballPosition;
}

export interface ActiveLineupBinding {
  footballPosition: FootballPosition;
  gameplayPlayerId: string;
  rosterPlayerId: string;
  rosterTeamId: string;
  team: PlayerTeam;
}

export interface ActiveLineup {
  bindings: readonly ActiveLineupBinding[];
  opponentTeamId: string;
  playbookId: PlaybookId;
  userTeamId: string;
}

export interface ActiveLineupValidationIssue {
  gameplayPlayerIds: string[];
  message: string;
}

const OFFENSE_POSITION_BINDINGS: Record<string, LineupPositionReference> = {
  'offense-blocker-left': { position: 'LG' },
  'offense-blocker-right': { position: 'RG' },
  'offense-center': { position: 'C' },
  'offense-line-left': { position: 'LG' },
  'offense-line-right': { position: 'RG' },
  'offense-qb': { position: 'QB' },
  'offense-rb': { position: 'RB' },
  'offense-slot': { position: 'SLOT' },
  'offense-tackle-left': { position: 'LT' },
  'offense-tackle-right': { position: 'RT' },
  'offense-tight-end': { position: 'TE' },
  'offense-wr': { occurrence: 0, position: 'WR' },
  'offense-wr-left': { occurrence: 0, position: 'WR' },
  'offense-wr-right': { occurrence: 1, position: 'WR' },
};

const DEFENSE_POSITION_BINDINGS: Record<string, LineupPositionReference> = {
  'defense-corner-left': { occurrence: 0, position: 'CB' },
  'defense-corner-right': { occurrence: 1, position: 'CB' },
  'defense-cover-rb': { occurrence: 0, position: 'ILB' },
  'defense-cover-wr': { occurrence: 0, position: 'CB' },
  'defense-line-left': { occurrence: 0, position: 'DL' },
  'defense-line-middle': { occurrence: 1, position: 'DL' },
  'defense-line-right': { occurrence: 2, position: 'DL' },
  'defense-linebacker': { occurrence: 0, position: 'ILB' },
  'defense-linebacker-inside': { occurrence: 1, position: 'ILB' },
  'defense-linebacker-left': { occurrence: 0, position: 'OLB' },
  'defense-linebacker-right': { occurrence: 1, position: 'OLB' },
  'defense-rusher-left': { occurrence: 0, position: 'DL' },
  'defense-rusher-right': { occurrence: 0, position: 'OLB' },
  'defense-safety': { position: 'FS' },
  'defense-safety-strong': { position: 'SS' },
};

export function createActiveLineup(
  playbookId: PlaybookId,
  userRoster: TeamRoster,
  opponentRoster: TeamRoster,
): ActiveLineup {
  const offenseIds = getOffenseGameplayIds(playbookId);
  const defenseIds = getDefenseGameplayIds(playbookId);
  const bindings: ActiveLineupBinding[] = [];

  for (const gameplayPlayerId of offenseIds) {
    bindings.push(createBinding(gameplayPlayerId, 'offense', userRoster, OFFENSE_POSITION_BINDINGS));
  }

  for (const gameplayPlayerId of defenseIds) {
    bindings.push(createBinding(gameplayPlayerId, 'defense', opponentRoster, DEFENSE_POSITION_BINDINGS));
  }

  return {
    bindings,
    opponentTeamId: opponentRoster.teamId,
    playbookId,
    userTeamId: userRoster.teamId,
  };
}

export function getLineupBinding(
  lineup: ActiveLineup,
  gameplayPlayerId: string,
): ActiveLineupBinding | null {
  return lineup.bindings.find((binding) => binding.gameplayPlayerId === gameplayPlayerId) ?? null;
}

export function resolveLineupRosterPlayer(
  lineup: ActiveLineup,
  rosters: readonly TeamRoster[],
  gameplayPlayerId: string,
): RosterPlayer | null {
  const binding = getLineupBinding(lineup, gameplayPlayerId);
  if (!binding) {
    return null;
  }

  const roster = rosters.find((candidate) => candidate.teamId === binding.rosterTeamId);
  return roster?.players.find((player) => player.id === binding.rosterPlayerId) ?? null;
}

export function validateActiveLineup(
  lineup: ActiveLineup,
  rosters: readonly TeamRoster[],
): ActiveLineupValidationIssue[] {
  const issues: ActiveLineupValidationIssue[] = [];
  const expectedIds = new Set([
    ...getOffenseGameplayIds(lineup.playbookId),
    ...getDefenseGameplayIds(lineup.playbookId),
  ]);
  const seenGameplayIds = new Set<string>();
  const seenRosterIdsByTeam = new Map<string, Set<string>>();

  for (const binding of lineup.bindings) {
    if (seenGameplayIds.has(binding.gameplayPlayerId)) {
      issues.push({
        gameplayPlayerIds: [binding.gameplayPlayerId],
        message: `Duplicate gameplay lineup slot ${binding.gameplayPlayerId}`,
      });
    }
    seenGameplayIds.add(binding.gameplayPlayerId);

    if (!expectedIds.has(binding.gameplayPlayerId)) {
      issues.push({
        gameplayPlayerIds: [binding.gameplayPlayerId],
        message: `Unexpected gameplay lineup slot ${binding.gameplayPlayerId}`,
      });
    }

    const teamRosterIds = seenRosterIdsByTeam.get(binding.rosterTeamId) ?? new Set<string>();
    if (teamRosterIds.has(binding.rosterPlayerId)) {
      issues.push({
        gameplayPlayerIds: [binding.gameplayPlayerId],
        message: `Roster player ${binding.rosterPlayerId} is assigned more than once`,
      });
    }
    teamRosterIds.add(binding.rosterPlayerId);
    seenRosterIdsByTeam.set(binding.rosterTeamId, teamRosterIds);

    if (!resolveLineupRosterPlayer(lineup, rosters, binding.gameplayPlayerId)) {
      issues.push({
        gameplayPlayerIds: [binding.gameplayPlayerId],
        message: `${binding.gameplayPlayerId} references missing roster player ${binding.rosterPlayerId}`,
      });
    }
  }

  for (const expectedId of expectedIds) {
    if (!seenGameplayIds.has(expectedId)) {
      issues.push({
        gameplayPlayerIds: [expectedId],
        message: `Missing gameplay lineup slot ${expectedId}`,
      });
    }
  }

  return issues;
}

export function getActiveLineupGameplayIds(playbookId: PlaybookId): string[] {
  return [...getOffenseGameplayIds(playbookId), ...getDefenseGameplayIds(playbookId)];
}

function createBinding(
  gameplayPlayerId: string,
  team: PlayerTeam,
  roster: TeamRoster,
  references: Record<string, LineupPositionReference>,
): ActiveLineupBinding {
  const reference = references[gameplayPlayerId];
  if (!reference) {
    throw new Error(`Missing roster position binding for ${gameplayPlayerId}`);
  }

  const rosterPlayer = getRosterPlayerByPosition(roster, reference);
  if (!rosterPlayer) {
    throw new Error(
      `Roster ${roster.teamId} missing ${reference.position} for ${gameplayPlayerId}`,
    );
  }

  return {
    footballPosition: rosterPlayer.footballPosition,
    gameplayPlayerId,
    rosterPlayerId: rosterPlayer.id,
    rosterTeamId: roster.teamId,
    team,
  };
}

function getRosterPlayerByPosition(
  roster: TeamRoster,
  reference: LineupPositionReference,
): RosterPlayer | null {
  const candidates = roster.players.filter((player) => player.footballPosition === reference.position);
  return candidates[reference.occurrence ?? 0] ?? null;
}

function getOffenseGameplayIds(playbookId: PlaybookId): readonly string[] {
  if (playbookId === '11v11') {
    return ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS;
  }

  if (playbookId === '7v7') {
    return SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS;
  }

  return FIVE_ON_FIVE_OFFENSE_PLAYER_IDS;
}

function getDefenseGameplayIds(playbookId: PlaybookId): readonly string[] {
  if (playbookId === '11v11') {
    return ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS;
  }

  if (playbookId === '7v7') {
    return SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS;
  }

  return FIVE_ON_FIVE_DEFENSE_PLAYER_IDS;
}
