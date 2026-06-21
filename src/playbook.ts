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

export type PlayId = 'inside-run' | 'outside-run' | 'quick-pass';
export type PlayKind = 'run' | 'pass';

export interface FormationPlayer {
  facingRadians: number;
  id: string;
  offset: Vector2;
  role: PlayerRole;
  team: PlayerTeam;
}

export interface ReceiverRouteDefinition {
  targetOffset: Vector2;
  speed: number;
}

export interface PlayDefinition {
  ballCarrierRole: PlayerRole;
  blockerLaneOffsets: Record<string, Vector2>;
  displayName: string;
  formation: FormationPlayer[];
  id: PlayId;
  initialMovementDirection: Vector2;
  kind: PlayKind;
  pass?: {
    eligibleReceiverId: string;
  };
  receiverRoutes?: Record<string, ReceiverRouteDefinition>;
}

export type RushingPlayDefinition = PlayDefinition;

export const PLAYS: PlayDefinition[] = [
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
    kind: 'run',
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
    kind: 'run',
  },
  {
    ballCarrierRole: 'quarterback',
    blockerLaneOffsets: {
      'blocker-right': { x: 4, z: 8 },
    },
    displayName: 'Quick Pass',
    formation: [
      {
        facingRadians: 0,
        id: 'runner',
        offset: { x: 0, z: 0 },
        role: 'quarterback',
        team: 'offense',
      },
      {
        facingRadians: 0.15,
        id: 'blocker-left',
        offset: { x: -7, z: 1.5 },
        role: 'receiver',
        team: 'offense',
      },
      {
        facingRadians: 0.25,
        id: 'blocker-right',
        offset: { x: 3, z: 1.5 },
        role: 'blocker',
        team: 'offense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-left',
        offset: { x: -8, z: 9 },
        role: 'coverageDefender',
        team: 'defense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-middle',
        offset: { x: 0, z: 24 },
        role: 'defender',
        team: 'defense',
      },
      {
        facingRadians: Math.PI,
        id: 'defender-right',
        offset: { x: 8, z: 24 },
        role: 'defender',
        team: 'defense',
      },
    ],
    id: 'quick-pass',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      eligibleReceiverId: 'blocker-left',
    },
    receiverRoutes: {
      'blocker-left': {
        speed: 9.5,
        targetOffset: { x: -1.5, z: 11 },
      },
    },
  },
];

export const RUSHING_PLAYS = PLAYS.filter((play) => play.kind === 'run');

export const DEFAULT_PLAY_ID: PlayId = 'inside-run';

export function getPlay(playId: string): PlayDefinition {
  const play = PLAYS.find((candidate) => candidate.id === playId);

  if (!play) {
    throw new Error(`Unknown play ${playId}`);
  }

  return play;
}

export function getRushingPlay(playId: string): RushingPlayDefinition {
  return getPlay(playId);
}

export function createFormationPlayers(
  ballSpot: FootballSpot,
  play: PlayDefinition = getPlay(DEFAULT_PLAY_ID),
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
  play: PlayDefinition,
): void {
  for (const player of players) {
    const slot = getFormationSlot(play, player.id);
    const spot = calculateFormationSpot(ballSpot, slot.offset);

    player.position.x = spot.x;
    player.position.z = spot.z;
    player.velocity.x = 0;
    player.velocity.z = 0;
    player.collisionRadius = PLAYER_MOVEMENT_CONFIG.collisionRadius;
    player.facingRadians = slot.facingRadians;
    player.role = slot.role;
    player.team = slot.team;
    player.currentState = 'idle';
  }
}

export function getBlockingLaneTarget(
  blocker: PlayerModel,
  ballSpot: FootballSpot,
  play: PlayDefinition,
): FootballSpot {
  const slot = getFormationSlot(play, blocker.id);
  const laneOffset = play.blockerLaneOffsets[blocker.id] ?? slot.offset;

  return calculateFormationSpot(ballSpot, laneOffset);
}

export function getFormationSlot(
  play: PlayDefinition,
  playerId: string,
): FormationPlayer {
  const slot = play.formation.find((formationSlot) => formationSlot.id === playerId);

  if (!slot) {
    throw new Error(`Unknown formation player ${playerId}`);
  }

  return slot;
}

export function getReceiverRouteTarget(
  receiver: PlayerModel,
  ballSpot: FootballSpot,
  play: PlayDefinition,
): FootballSpot | null {
  const route = play.receiverRoutes?.[receiver.id];

  if (!route) {
    return null;
  }

  return calculateFormationSpot(ballSpot, route.targetOffset);
}

export function getReceiverRouteSpeed(receiver: PlayerModel, play: PlayDefinition): number {
  return play.receiverRoutes?.[receiver.id]?.speed ?? 0;
}

function calculateFormationSpot(ballSpot: FootballSpot, offset: Vector2): FootballSpot {
  return {
    x: ballSpot.x + offset.x,
    z: Math.min(OPPOSING_GOAL_LINE_Z - 2, ballSpot.z + offset.z),
  };
}
