import { FIELD_BOUNDS, type FieldBounds } from '../../fieldSpec';
import type { FootballSpot } from '../../fieldScale';
import type { ResolvedFormation } from '../../formationLayout';
import type { PlayerRole, PlayerTeam } from '../../playerModel';
import type { KickoffFormationParticipantPlacement } from '../../specialTeams/KickoffFormation';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  type FootballPlayerVisualPosition,
  type FootballPlayerVisualTeamSide,
} from '../players/FootballPlayerVisualFactory';

export type FormationFamily = 'fieldGoal' | 'kickoff' | 'placeKick' | 'scrimmage';

export interface FootballFormationParticipantPlacement {
  facingRadians: number;
  footballPosition: FootballPlayerVisualPosition;
  gameplayPlayerId?: string;
  gameplayTeam: PlayerTeam;
  id: string;
  position: FootballSpot;
  presentationOnly: boolean;
  role: PlayerRole;
  rosterPlayerId?: string;
  teamSide: FootballPlayerVisualTeamSide;
  visualProfileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
}

export interface ResolvedFootballFormation {
  ballPlacement: FootballSpot;
  bounds: FieldBounds;
  family: FormationFamily;
  id: string;
  participantPlacements: readonly FootballFormationParticipantPlacement[];
}

export interface FootballFormationValidationIssue {
  id: string;
  message: string;
}

const formationRegistry = new Map<string, ResolvedFootballFormation>();

export const FIELD_GOAL_DEVELOPMENT_FORMATION = createFieldGoalDevelopmentFormation();

registerFootballFormation(FIELD_GOAL_DEVELOPMENT_FORMATION);

export function registerFootballFormation(formation: ResolvedFootballFormation): void {
  const issues = validateResolvedFootballFormationContract(formation);
  if (issues.length > 0) {
    throw new Error(
      `Invalid football formation ${formation.id}: ${issues.map((issue) => issue.message).join('; ')}`,
    );
  }
  formationRegistry.set(formation.id, cloneResolvedFootballFormation(formation));
}

export function getRegisteredFootballFormation(id: string): ResolvedFootballFormation | null {
  const formation = formationRegistry.get(id);
  return formation ? cloneResolvedFootballFormation(formation) : null;
}

export function listRegisteredFootballFormations(): ResolvedFootballFormation[] {
  return [...formationRegistry.values()].map(cloneResolvedFootballFormation);
}

export function createScrimmageFootballFormation(
  id: string,
  formation: ResolvedFormation,
): ResolvedFootballFormation {
  const participantPlacements = formation.slots.map((slot): FootballFormationParticipantPlacement => ({
    facingRadians: resolvePreSnapFacing(slot.team),
    footballPosition: 'UNKNOWN',
    gameplayPlayerId: slot.id,
    gameplayTeam: slot.team,
    id: slot.id,
    position: cloneSpot(slot.position),
    presentationOnly: false,
    role: slot.role,
    rosterPlayerId: slot.id,
    teamSide: slot.team === 'offense' ? 'user' : 'opponent',
    visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  }));

  return {
    ballPlacement: cloneSpot(formation.snapPlacement.spot),
    bounds: calculateFormationBounds(participantPlacements, formation.snapPlacement.spot),
    family: 'scrimmage',
    id,
    participantPlacements,
  };
}

export function createKickoffFootballFormation(
  id: string,
  placements: readonly KickoffFormationParticipantPlacement[],
  ballPlacement: FootballSpot,
): ResolvedFootballFormation {
  const participantPlacements = placements.map((placement): FootballFormationParticipantPlacement => ({
    facingRadians: placement.facingRadians,
    footballPosition: placement.footballPosition,
    gameplayTeam: placement.gameplayTeam,
    id: placement.visualId,
    position: cloneSpot(placement.position),
    presentationOnly: true,
    role: placement.role,
    rosterPlayerId: placement.rosterPlayerId,
    teamSide: placement.teamSide,
    visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  }));

  return {
    ballPlacement: cloneSpot(ballPlacement),
    bounds: calculateFormationBounds(participantPlacements, ballPlacement),
    family: 'kickoff',
    id,
    participantPlacements,
  };
}

export function validateResolvedFootballFormationContract(
  formation: ResolvedFootballFormation,
): FootballFormationValidationIssue[] {
  const issues: FootballFormationValidationIssue[] = [];
  const participantIds = new Set<string>();

  if (!isSpotInsideField(formation.ballPlacement)) {
    issues.push({
      id: formation.id,
      message: `${formation.id} ball placement is outside the field bounds`,
    });
  }

  for (const participant of formation.participantPlacements) {
    if (participantIds.has(participant.id)) {
      issues.push({
        id: participant.id,
        message: `Duplicate participant ${participant.id}`,
      });
    }
    participantIds.add(participant.id);

    if (!isSpotInsideField(participant.position)) {
      issues.push({
        id: participant.id,
        message: `${participant.id} is outside the field bounds`,
      });
    }

    if (!boundsContainsSpot(formation.bounds, participant.position)) {
      issues.push({
        id: participant.id,
        message: `${participant.id} is outside the declared formation bounds`,
      });
    }
  }

  if (!boundsContainsSpot(formation.bounds, formation.ballPlacement)) {
    issues.push({
      id: formation.id,
      message: `${formation.id} ball placement is outside the declared formation bounds`,
    });
  }

  return issues;
}

function createFieldGoalDevelopmentFormation(): ResolvedFootballFormation {
  const ballPlacement = { x: 0, z: -18 };
  const placements: FootballFormationParticipantPlacement[] = [
    participant('field-goal-long-snapper', 'offense', 'user', 'blocker', 'C', 0, -18),
    participant('field-goal-holder', 'offense', 'user', 'quarterback', 'QB', 0, -25),
    participant('field-goal-kicker', 'offense', 'user', 'runner', 'UNKNOWN', -3, -29),
    participant('field-goal-blocker-left', 'offense', 'user', 'blocker', 'LG', -2.3, -18.4),
    participant('field-goal-blocker-right', 'offense', 'user', 'blocker', 'RG', 2.3, -18.4),
    participant('field-goal-edge-left', 'offense', 'user', 'blocker', 'LT', -4.6, -18.8),
    participant('field-goal-edge-right', 'offense', 'user', 'blocker', 'RT', 4.6, -18.8),
    participant('field-goal-rusher-middle', 'defense', 'opponent', 'defender', 'DL', 0, -13.8),
    participant('field-goal-rusher-left', 'defense', 'opponent', 'defender', 'DL', -2.8, -13.4),
    participant('field-goal-rusher-right', 'defense', 'opponent', 'defender', 'DL', 2.8, -13.4),
    participant('field-goal-edge-rusher-left', 'defense', 'opponent', 'defender', 'OLB', -6, -13.1),
    participant('field-goal-edge-rusher-right', 'defense', 'opponent', 'defender', 'OLB', 6, -13.1),
  ];

  return {
    ballPlacement,
    bounds: calculateFormationBounds(placements, ballPlacement),
    family: 'fieldGoal',
    id: 'dev-field-goal-static',
    participantPlacements: placements,
  };
}

function participant(
  id: string,
  gameplayTeam: PlayerTeam,
  teamSide: FootballPlayerVisualTeamSide,
  role: PlayerRole,
  footballPosition: FootballPlayerVisualPosition,
  x: number,
  z: number,
): FootballFormationParticipantPlacement {
  return {
    facingRadians: gameplayTeam === 'offense' ? 0 : Math.PI,
    footballPosition,
    gameplayTeam,
    id,
    position: { x, z },
    presentationOnly: true,
    role,
    rosterPlayerId: id,
    teamSide,
    visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  };
}

function calculateFormationBounds(
  placements: readonly FootballFormationParticipantPlacement[],
  ballPlacement: FootballSpot,
): FieldBounds {
  return placements.reduce(
    (bounds, placement) => ({
      maxX: Math.max(bounds.maxX, placement.position.x),
      maxZ: Math.max(bounds.maxZ, placement.position.z),
      minX: Math.min(bounds.minX, placement.position.x),
      minZ: Math.min(bounds.minZ, placement.position.z),
    }),
    {
      maxX: ballPlacement.x,
      maxZ: ballPlacement.z,
      minX: ballPlacement.x,
      minZ: ballPlacement.z,
    },
  );
}

function boundsContainsSpot(bounds: FieldBounds, spot: FootballSpot): boolean {
  return (
    spot.x >= bounds.minX &&
    spot.x <= bounds.maxX &&
    spot.z >= bounds.minZ &&
    spot.z <= bounds.maxZ
  );
}

function isSpotInsideField(spot: FootballSpot): boolean {
  return boundsContainsSpot(FIELD_BOUNDS, spot);
}

function resolvePreSnapFacing(team: PlayerTeam): number {
  return team === 'offense' ? 0 : Math.PI;
}

function cloneResolvedFootballFormation(
  formation: ResolvedFootballFormation,
): ResolvedFootballFormation {
  return {
    ballPlacement: cloneSpot(formation.ballPlacement),
    bounds: { ...formation.bounds },
    family: formation.family,
    id: formation.id,
    participantPlacements: formation.participantPlacements.map((participant) => ({
      ...participant,
      position: cloneSpot(participant.position),
    })),
  };
}

function cloneSpot(spot: FootballSpot): FootballSpot {
  return { x: spot.x, z: spot.z };
}
