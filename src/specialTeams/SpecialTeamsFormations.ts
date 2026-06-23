import { FIELD_BOUNDS, type FieldBounds } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { PlayerRole, PlayerTeam } from '../playerModel';
import type { FootballPlayerVisualPosition, FootballPlayerVisualTeamSide } from '../presentation/players/FootballPlayerVisualFactory';
import { FOOTBALL_PLAYER_VISUAL_PROFILE_ID } from '../presentation/players/FootballPlayerVisualFactory';
import type { TeamRoster } from '../roster/TeamRoster';
import type { KickoffDirection } from './KickoffTypes';
import { COLLEGE_SPECIAL_TEAMS_RULE_SPEC, resolveKickoffLineSpot, resolveReceivingRestrainingLineZ, resolveTryLineSpot } from './CollegeSpecialTeamsRuleSpec';
import { createSpecialTeamsDepthChart, type SpecialTeamsDepthChart } from './SpecialTeamsDepthChart';

export type SpecialTeamsFormationFamily = 'kickoff' | 'placeKick';
export type SpecialTeamsFormationUnit =
  | 'kickoffCoverage'
  | 'kickoffReturn'
  | 'placeKickDefense'
  | 'placeKickProtection';

export interface SpecialTeamsFormationParticipant {
  facingRadians: number;
  footballPosition: FootballPlayerVisualPosition;
  gameplayTeam: PlayerTeam;
  id: string;
  position: FootballSpot;
  presentationOnly: true;
  role: PlayerRole;
  rosterPlayerId: string;
  teamSide: FootballPlayerVisualTeamSide;
  unit: SpecialTeamsFormationUnit;
  visualProfileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
}

export interface ResolvedSpecialTeamsFormation {
  ballPlacement: FootballSpot;
  bounds: FieldBounds;
  family: SpecialTeamsFormationFamily;
  id: string;
  participants: readonly SpecialTeamsFormationParticipant[];
  unit: SpecialTeamsFormationUnit;
}

export function resolveKickoffCoverageFormation(options: {
  direction: KickoffDirection;
  roster: TeamRoster;
  teamSide: FootballPlayerVisualTeamSide;
}): ResolvedSpecialTeamsFormation {
  const chart = createSpecialTeamsDepthChart(options.roster);
  const ballPlacement = resolveKickoffLineSpot(options.direction);
  const participants = [
    participant(options, chart.kickoffCoverage.kickerId, 'kickoff-coverage-kicker', 'kickoffCoverage', 'runner', 0, -1.8),
    ...chart.kickoffCoverage.leftCoverageIds.map((id, index) =>
      participant(options, id, `kickoff-coverage-left-${index + 1}`, 'kickoffCoverage', 'defender', -(index + 1) * 4.65, -3)),
    ...chart.kickoffCoverage.rightCoverageIds.map((id, index) =>
      participant(options, id, `kickoff-coverage-right-${index + 1}`, 'kickoffCoverage', 'defender', (index + 1) * 4.65, -3)),
  ].map((placement) => offsetByBall(placement, ballPlacement, options.direction));

  return createFormation('kickoff-coverage', 'kickoff', 'kickoffCoverage', ballPlacement, participants);
}

export function resolveKickoffReturnFormation(options: {
  direction: KickoffDirection;
  roster: TeamRoster;
  teamSide: FootballPlayerVisualTeamSide;
}): ResolvedSpecialTeamsFormation {
  const chart = createSpecialTeamsDepthChart(options.roster);
  const ballPlacement = { x: 0, z: resolveReceivingRestrainingLineZ(options.direction) };
  const returnerDepth = 42;
  const participants = [
    ...chart.kickoffReturn.frontLineIds.map((id, index) =>
      participant(options, id, `kickoff-return-front-${index + 1}`, 'kickoffReturn', 'blocker', (index - 2) * 7.2, 0)),
    ...chart.kickoffReturn.secondLineIds.map((id, index) =>
      participant(options, id, `kickoff-return-second-${index + 1}`, 'kickoffReturn', 'blocker', (index - 1.5) * 8.4, 14)),
    ...chart.kickoffReturn.returnerIds.map((id, index) =>
      participant(options, id, `kickoff-returner-${index + 1}`, 'kickoffReturn', 'receiver', (index === 0 ? -1 : 1) * 7, returnerDepth)),
  ].map((placement) => offsetByBall(placement, ballPlacement, options.direction));

  return createFormation('kickoff-return', 'kickoff', 'kickoffReturn', ballPlacement, participants);
}

export function resolvePlaceKickFormation(options: {
  direction: KickoffDirection;
  roster: TeamRoster;
  teamSide: FootballPlayerVisualTeamSide;
}): ResolvedSpecialTeamsFormation {
  const chart = createSpecialTeamsDepthChart(options.roster);
  const ballPlacement = resolveTryLineSpot(options.direction);
  const participants = [
    participant(options, chart.placeKick.longSnapperId, 'place-kick-long-snapper', 'placeKickProtection', 'blocker', 0, 0),
    participant(options, chart.placeKick.holderId, 'place-kick-holder', 'placeKickProtection', 'quarterback', 0, -7),
    participant(options, chart.placeKick.kickerId, 'place-kick-kicker', 'placeKickProtection', 'runner', -3, -10),
    ...chart.placeKick.protectorIds.map((id, index) =>
      participant(
        options,
        id,
        `place-kick-protector-${index + 1}`,
        'placeKickProtection',
        'blocker',
        (index - 3.5) * 1.25,
        index < 4 ? -0.35 : -0.7,
      )),
  ].map((placement) => offsetByBall(placement, ballPlacement, options.direction));

  return createFormation('place-kick-protection', 'placeKick', 'placeKickProtection', ballPlacement, participants);
}

export function resolvePlaceKickDefenseFormation(options: {
  direction: KickoffDirection;
  roster: TeamRoster;
  teamSide: FootballPlayerVisualTeamSide;
}): ResolvedSpecialTeamsFormation {
  const chart = createSpecialTeamsDepthChart(options.roster);
  const ballPlacement = resolveTryLineSpot(options.direction);
  const participants = chart.placeKickDefense.rusherIds.map((id, index) =>
    offsetByBall(
      participant(
        options,
        id,
        `place-kick-rusher-${index + 1}`,
        'placeKickDefense',
        'defender',
        (index - 5) * 1.65,
        4,
      ),
      ballPlacement,
      options.direction,
    ));

  return createFormation('place-kick-defense', 'placeKick', 'placeKickDefense', ballPlacement, participants);
}

export function validateSpecialTeamsFormation(formation: ResolvedSpecialTeamsFormation): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (formation.participants.length !== 11) {
    issues.push(`${formation.id} must contain exactly eleven participants`);
  }
  for (const player of formation.participants) {
    if (ids.has(player.rosterPlayerId)) {
      issues.push(`${formation.id} contains duplicate roster player ${player.rosterPlayerId}`);
    }
    ids.add(player.rosterPlayerId);
    if (!isInsideField(player.position)) {
      issues.push(`${player.id} is outside field bounds`);
    }
  }
  if (!isInsideField(formation.ballPlacement)) {
    issues.push(`${formation.id} ball placement is outside field bounds`);
  }
  if (
    formation.unit === 'kickoffCoverage' &&
    formation.participants.filter((player) => player.position.x < formation.ballPlacement.x).length <
      COLLEGE_SPECIAL_TEAMS_RULE_SPEC.minimumKickingPlayersPerSideOfKicker
  ) {
    issues.push(`${formation.id} must have at least four kicking players left of the kicker`);
  }
  if (
    formation.unit === 'kickoffCoverage' &&
    formation.participants.filter((player) => player.position.x > formation.ballPlacement.x).length <
      COLLEGE_SPECIAL_TEAMS_RULE_SPEC.minimumKickingPlayersPerSideOfKicker
  ) {
    issues.push(`${formation.id} must have at least four kicking players right of the kicker`);
  }

  return issues;
}

function participant(
  options: { direction: KickoffDirection; roster: TeamRoster; teamSide: FootballPlayerVisualTeamSide },
  rosterPlayerId: string,
  id: string,
  unit: SpecialTeamsFormationUnit,
  role: PlayerRole,
  x: number,
  z: number,
): SpecialTeamsFormationParticipant {
  const player = options.roster.players.find((candidate) => candidate.id === rosterPlayerId);
  const gameplayTeam = options.teamSide === 'user' ? 'offense' : 'defense';

  return {
    facingRadians: options.direction > 0 ? 0 : Math.PI,
    footballPosition: player?.footballPosition ?? 'UNKNOWN',
    gameplayTeam,
    id,
    position: { x, z },
    presentationOnly: true,
    role,
    rosterPlayerId,
    teamSide: options.teamSide,
    unit,
    visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  };
}

function offsetByBall(
  participant: SpecialTeamsFormationParticipant,
  ballPlacement: FootballSpot,
  direction: KickoffDirection,
): SpecialTeamsFormationParticipant {
  return {
    ...participant,
    position: {
      x: clamp(participant.position.x, FIELD_BOUNDS.minX + 1, FIELD_BOUNDS.maxX - 1),
      z: clamp(ballPlacement.z + direction * participant.position.z, FIELD_BOUNDS.minZ + 1, FIELD_BOUNDS.maxZ - 1),
    },
  };
}

function createFormation(
  id: string,
  family: SpecialTeamsFormationFamily,
  unit: SpecialTeamsFormationUnit,
  ballPlacement: FootballSpot,
  participants: readonly SpecialTeamsFormationParticipant[],
): ResolvedSpecialTeamsFormation {
  return {
    ballPlacement,
    bounds: calculateBounds(participants, ballPlacement),
    family,
    id,
    participants,
    unit,
  };
}

function calculateBounds(
  participants: readonly SpecialTeamsFormationParticipant[],
  ballPlacement: FootballSpot,
): FieldBounds {
  return participants.reduce(
    (bounds, participant) => ({
      maxX: Math.max(bounds.maxX, participant.position.x),
      maxZ: Math.max(bounds.maxZ, participant.position.z),
      minX: Math.min(bounds.minX, participant.position.x),
      minZ: Math.min(bounds.minZ, participant.position.z),
    }),
    {
      maxX: ballPlacement.x,
      maxZ: ballPlacement.z,
      minX: ballPlacement.x,
      minZ: ballPlacement.z,
    },
  );
}

function isInsideField(spot: FootballSpot): boolean {
  return (
    spot.x >= FIELD_BOUNDS.minX &&
    spot.x <= FIELD_BOUNDS.maxX &&
    spot.z >= FIELD_BOUNDS.minZ &&
    spot.z <= FIELD_BOUNDS.maxZ
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
