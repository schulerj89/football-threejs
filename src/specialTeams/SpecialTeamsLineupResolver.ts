import type { GameplayRosterBinding } from '../roster/GameplayRosterBinding';
import type { FootballPosition, RosterPlayer } from '../roster/RosterPlayer';
import type { TeamRoster } from '../roster/TeamRoster';
import type { MatchPossession } from '../match/MatchTypes';
import type { PlayerRole, PlayerTeam } from '../playerModel';
import type {
  KickoffPresentationParticipant,
  KickoffPresentationRoster,
  KickoffReceivingSlotId,
  KickoffSlotId,
} from './KickoffPresentationRoster';
import type { KickoffState } from './KickoffTypes';
import { createSpecialTeamsDepthChart } from './SpecialTeamsDepthChart';

const KICKING_COVERAGE_SLOTS = [
  'coverage-left-5',
  'coverage-left-4',
  'coverage-left-3',
  'coverage-left-2',
  'coverage-left-1',
  'coverage-right-1',
  'coverage-right-2',
  'coverage-right-3',
  'coverage-right-4',
  'coverage-right-5',
] as const satisfies readonly KickoffSlotId[];

const RECEIVING_FRONT_SLOTS = [
  'front-line-left-2',
  'front-line-left-1',
  'front-line-middle',
  'front-line-right-1',
  'front-line-right-2',
] as const satisfies readonly KickoffReceivingSlotId[];

const RECEIVING_SECOND_SLOTS = [
  'second-line-left-2',
  'second-line-left-1',
  'second-line-right-1',
  'second-line-right-2',
] as const satisfies readonly KickoffReceivingSlotId[];

const RECEIVING_RETURNER_SLOTS = [
  'returner-left',
  'returner-right',
] as const satisfies readonly KickoffReceivingSlotId[];

export function resolveKickoffPresentationRoster(
  kickoff: KickoffState,
  binding: GameplayRosterBinding,
): KickoffPresentationRoster | null {
  if (!kickoff.kickingTeam || !kickoff.receivingTeam) {
    return null;
  }

  const kickingRoster = getRosterForPossession(binding, kickoff.kickingTeam);
  const receivingRoster = getRosterForPossession(binding, kickoff.receivingTeam);
  const kickingDepthChart = createSpecialTeamsDepthChart(kickingRoster);
  const receivingDepthChart = createSpecialTeamsDepthChart(receivingRoster);
  const kickingParticipants = resolveKickingParticipants(
    kickoff,
    kickingRoster,
    kickingDepthChart,
    kickoff.kickingTeam,
  );
  const receivingParticipants = resolveReceivingParticipants(
    kickoff,
    receivingRoster,
    receivingDepthChart,
    kickoff.receivingTeam,
  );
  const participants = [...kickingParticipants, ...receivingParticipants];

  return {
    kicker: kickingParticipants.find((participant) => participant.slotId === 'kicker') ?? null,
    kickingParticipants,
    kickingTeam: kickoff.kickingTeam,
    noGameplayAuthority: true,
    participants,
    receivingParticipants,
    receivingTeam: kickoff.receivingTeam,
    returners: receivingParticipants.filter((participant) =>
      participant.slotId === 'returner-left' || participant.slotId === 'returner-right'),
  };
}

function resolveKickingParticipants(
  kickoff: KickoffState,
  roster: TeamRoster,
  depthChart: ReturnType<typeof createSpecialTeamsDepthChart>,
  team: MatchPossession,
): KickoffPresentationParticipant[] {
  const kicker = getRosterPlayerById(roster, depthChart.kickoffCoverage.kickerId) ?? roster.players[0] ?? null;
  if (!kicker) {
    return [];
  }

  const coveragePlayers = [
    ...depthChart.kickoffCoverage.leftCoverageIds,
    ...depthChart.kickoffCoverage.rightCoverageIds,
  ].map((id) => getRosterPlayerById(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player));

  return [
    createKickoffParticipant(kickoff, team, kicker, 'kicker', 'runner'),
    ...coveragePlayers.map((player, index) =>
      createKickoffParticipant(kickoff, team, player, KICKING_COVERAGE_SLOTS[index]!, 'defender')),
  ];
}

function resolveReceivingParticipants(
  kickoff: KickoffState,
  roster: TeamRoster,
  depthChart: ReturnType<typeof createSpecialTeamsDepthChart>,
  team: MatchPossession,
): KickoffPresentationParticipant[] {
  const returners = depthChart.kickoffReturn.returnerIds
    .map((id) => getRosterPlayerById(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player));
  const frontLine = depthChart.kickoffReturn.frontLineIds
    .map((id) => getRosterPlayerById(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player));
  const secondLine = depthChart.kickoffReturn.secondLineIds
    .map((id) => getRosterPlayerById(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player));

  return [
    ...frontLine.map((player, index) =>
      createKickoffParticipant(kickoff, team, player, RECEIVING_FRONT_SLOTS[index]!, 'defender')),
    ...secondLine.map((player, index) =>
      createKickoffParticipant(kickoff, team, player, RECEIVING_SECOND_SLOTS[index]!, 'defender')),
    ...returners.map((player, index) =>
      createKickoffParticipant(kickoff, team, player, RECEIVING_RETURNER_SLOTS[index]!, 'receiver')),
  ];
}

function createKickoffParticipant(
  kickoff: KickoffState,
  team: MatchPossession,
  player: RosterPlayer,
  slotId: KickoffSlotId,
  role: PlayerRole,
): KickoffPresentationParticipant {
  const gameplayTeam = getGameplayTeamForPossession(team);
  const teamSide = team === 'user' ? 'user' : 'opponent';

  return {
    appearanceId: player.appearanceId,
    footballPosition: player.footballPosition,
    gameplayTeam,
    jerseyNumber: player.jerseyNumber,
    phase: team === kickoff.kickingTeam ? 'kicking' : 'receiving',
    role,
    rosterPlayerId: player.id,
    slotId,
    team,
    teamSide,
    visualId: `kickoff-${kickoff.sequenceIndex}-${team}-${slotId}`,
  };
}

function getRosterForPossession(
  binding: GameplayRosterBinding,
  team: MatchPossession,
): TeamRoster {
  return team === 'user' ? binding.userRoster : binding.opponentRoster;
}

function getGameplayTeamForPossession(team: MatchPossession): PlayerTeam {
  return team === 'user' ? 'offense' : 'defense';
}

function getRosterPlayerById(roster: TeamRoster, id: string): RosterPlayer | null {
  return roster.players.find((player) => player.id === id) ?? null;
}
