import { OPPOSING_GOAL_LINE_Z } from './field';
import type { FootballSpot } from './fieldScale';
import {
  PLAYER_MOVEMENT_CONFIG,
  createPlayerModel,
  type PlayerModel,
  type PlayerRole,
  type PlayerTeam,
  type Vector2,
} from './playerModel';

export type PlayId = 'inside-run' | 'outside-run';

export interface FormationPlayer {
  facingRadians: number;
  id: string;
  offset: Vector2;
  role: PlayerRole;
  team: PlayerTeam;
}

export interface RushingPlayDefinition {
  ballCarrierRole: PlayerRole;
  blockerLaneOffsets: Record<string, Vector2>;
  displayName: string;
  formation: FormationPlayer[];
  id: PlayId;
  initialMovementDirection: Vector2;
}

export const RUSHING_PLAYS: RushingPlayDefinition[] = [
  {
    ballCarrierRole: 'runner',
    blockerLaneOffsets: {
      'blocker-left': { x: 2.5, z: 14 },
      'blocker-right': { x: -2.5, z: 14 },
    },
    displayName: 'Inside Run',
    formation: [
      {
        facingRadians: 0,
        id: 'runner',
        offset: { x: 0, z: 0 },
        role: 'runner',
        team: 'offense',
      },
      {
        facingRadians: 0,
        id: 'blocker-left',
        offset: { x: 3, z: 1.5 },
        role: 'blocker',
        team: 'offense',
      },
      {
        facingRadians: 0,
        id: 'blocker-right',
        offset: { x: -3, z: 1.5 },
        role: 'blocker',
        team: 'offense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-left',
        offset: { x: 7, z: 24 },
        role: 'defender',
        team: 'defense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-middle',
        offset: { x: 0, z: 45 },
        role: 'defender',
        team: 'defense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-right',
        offset: { x: -7, z: 24 },
        role: 'defender',
        team: 'defense',
      },
    ],
    id: 'inside-run',
    initialMovementDirection: { x: 0, z: 1 },
  },
  {
    ballCarrierRole: 'runner',
    blockerLaneOffsets: {
      'blocker-left': { x: 11, z: 13 },
      'blocker-right': { x: 15, z: 11 },
    },
    displayName: 'Outside Run',
    formation: [
      {
        facingRadians: 0.35,
        id: 'runner',
        offset: { x: 2.5, z: 0 },
        role: 'runner',
        team: 'offense',
      },
      {
        facingRadians: 0.45,
        id: 'blocker-left',
        offset: { x: 6, z: 1.5 },
        role: 'blocker',
        team: 'offense',
      },
      {
        facingRadians: 0.55,
        id: 'blocker-right',
        offset: { x: 9, z: 0.5 },
        role: 'blocker',
        team: 'offense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-left',
        offset: { x: 9, z: 24 },
        role: 'defender',
        team: 'defense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-middle',
        offset: { x: 0, z: 45 },
        role: 'defender',
        team: 'defense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-right',
        offset: { x: -7, z: 24 },
        role: 'defender',
        team: 'defense',
      },
    ],
    id: 'outside-run',
    initialMovementDirection: { x: 0.7, z: 0.7 },
  },
] as const;

export const DEFAULT_PLAY_ID: PlayId = 'inside-run';

export function getRushingPlay(playId: string): RushingPlayDefinition {
  const play = RUSHING_PLAYS.find((candidate) => candidate.id === playId);

  if (!play) {
    throw new Error(`Unknown rushing play ${playId}`);
  }

  return play;
}

export function createFormationPlayers(
  ballSpot: FootballSpot,
  play: RushingPlayDefinition = getRushingPlay(DEFAULT_PLAY_ID),
): PlayerModel[] {
  return play.formation.map((slot) =>
    createPlayerModel(calculateFormationSpot(ballSpot, slot.offset), {
      collisionRadius: PLAYER_MOVEMENT_CONFIG.collisionRadius,
      facingRadians: slot.facingRadians,
      id: slot.id,
      role: slot.role,
      state: 'idle',
      team: slot.team,
    }),
  );
}

export function resetFormationPlayers(
  players: PlayerModel[],
  ballSpot: FootballSpot,
  play: RushingPlayDefinition,
): void {
  for (const player of players) {
    const slot = getFormationSlot(play, player.id);
    const spot = calculateFormationSpot(ballSpot, slot.offset);

    player.position.x = spot.x;
    player.position.z = spot.z;
    player.velocity.x = 0;
    player.velocity.z = 0;
    player.facingRadians = slot.facingRadians;
    player.currentState = 'idle';
  }
}

export function getBlockingLaneTarget(
  blocker: PlayerModel,
  ballSpot: FootballSpot,
  play: RushingPlayDefinition,
): FootballSpot {
  const slot = getFormationSlot(play, blocker.id);
  const laneOffset = play.blockerLaneOffsets[blocker.id] ?? slot.offset;

  return calculateFormationSpot(ballSpot, laneOffset);
}

export function getFormationSlot(
  play: RushingPlayDefinition,
  playerId: string,
): FormationPlayer {
  const slot = play.formation.find((formationSlot) => formationSlot.id === playerId);

  if (!slot) {
    throw new Error(`Unknown formation player ${playerId}`);
  }

  return slot;
}

function calculateFormationSpot(ballSpot: FootballSpot, offset: Vector2): FootballSpot {
  return {
    x: ballSpot.x + offset.x,
    z: Math.min(OPPOSING_GOAL_LINE_Z - 2, ballSpot.z + offset.z),
  };
}
