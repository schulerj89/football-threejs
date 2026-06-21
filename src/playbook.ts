import { OPPOSING_GOAL_LINE_Z, PLAYABLE_FIELD_BOUNDS } from './field';
import type { FootballSpot } from './fieldScale';
import {
  PLAYER_MOVEMENT_CONFIG,
  createPlayerModel,
  type PlayerModel,
  type PlayerRole,
  type PlayerTeam,
  type Vector2,
} from './playerModel';

export type PlayId = 'inside-run' | 'outside-run' | 'quick-pass' | 'slant-flat';
export type PlayKind = 'run' | 'pass';
export type PreSnapFacingDefinition =
  | { kind: 'playDirection' }
  | { kind: 'againstPlayDirection' };

export interface FormationPlayer {
  id: string;
  offset: Vector2;
  preSnapFacing: PreSnapFacingDefinition;
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
    coverageAssignments?: Record<string, string>;
    eligibleReceiverIds: string[];
    receiverDisplayNames?: Record<string, string>;
  };
  receiverRoutes?: Record<string, ReceiverRouteDefinition>;
}

export type RushingPlayDefinition = PlayDefinition;

const OFFENSE_PRE_SNAP_FACING: PreSnapFacingDefinition = { kind: 'playDirection' };
const DEFENSE_PRE_SNAP_FACING: PreSnapFacingDefinition = { kind: 'againstPlayDirection' };

export const PRE_SNAP_FACING_RADIANS = {
  againstPlayDirection: Math.PI,
  playDirection: 0,
} as const;

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
        id: 'runner',
        offset: { x: 0, z: 0 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'runner',
        team: 'offense',
      },
      {
        id: 'blocker-left',
        offset: { x: 3, z: 1.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'blocker',
        team: 'offense',
      },
      {
        id: 'blocker-right',
        offset: { x: -3, z: 1.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'blocker',
        team: 'offense',
      },
      {
        id: 'defender-left',
        offset: { x: 7, z: 24 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'defender',
        team: 'defense',
      },
      {
        id: 'defender-middle',
        offset: { x: 0, z: 45 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'defender',
        team: 'defense',
      },
      {
        id: 'defender-right',
        offset: { x: -7, z: 24 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
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
        id: 'runner',
        offset: { x: 2.5, z: 0 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'runner',
        team: 'offense',
      },
      {
        id: 'blocker-left',
        offset: { x: 6, z: 1.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'blocker',
        team: 'offense',
      },
      {
        id: 'blocker-right',
        offset: { x: 9, z: 0.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'blocker',
        team: 'offense',
      },
      {
        id: 'defender-left',
        offset: { x: 9, z: 24 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'defender',
        team: 'defense',
      },
      {
        id: 'defender-middle',
        offset: { x: 0, z: 45 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'defender',
        team: 'defense',
      },
      {
        id: 'defender-right',
        offset: { x: -7, z: 24 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
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
        id: 'runner',
        offset: { x: 0, z: 0 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'quarterback',
        team: 'offense',
      },
      {
        id: 'blocker-left',
        offset: { x: -7, z: 1.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'receiver',
        team: 'offense',
      },
      {
        id: 'blocker-right',
        offset: { x: 3, z: 1.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'blocker',
        team: 'offense',
      },
      {
        id: 'defender-left',
        offset: { x: -8, z: 9 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'coverageDefender',
        team: 'defense',
      },
      {
        id: 'defender-middle',
        offset: { x: 0, z: 24 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'defender',
        team: 'defense',
      },
      {
        id: 'defender-right',
        offset: { x: 8, z: 24 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'defender',
        team: 'defense',
      },
    ],
    id: 'quick-pass',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      coverageAssignments: {
        'defender-left': 'blocker-left',
      },
      eligibleReceiverIds: ['blocker-left'],
      receiverDisplayNames: {
        'blocker-left': 'Receiver',
      },
    },
    receiverRoutes: {
      'blocker-left': {
        speed: 9.5,
        targetOffset: { x: -1.5, z: 11 },
      },
    },
  },
  {
    ballCarrierRole: 'quarterback',
    blockerLaneOffsets: {},
    displayName: 'Slant Flat',
    formation: [
      {
        id: 'runner',
        offset: { x: 0, z: 0 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'quarterback',
        team: 'offense',
      },
      {
        id: 'blocker-left',
        offset: { x: -8, z: 1.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'receiver',
        team: 'offense',
      },
      {
        id: 'blocker-right',
        offset: { x: 8, z: 1.5 },
        preSnapFacing: OFFENSE_PRE_SNAP_FACING,
        role: 'receiver',
        team: 'offense',
      },
      {
        id: 'defender-left',
        offset: { x: -8, z: 9 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'coverageDefender',
        team: 'defense',
      },
      {
        id: 'defender-middle',
        offset: { x: 0, z: 24 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'defender',
        team: 'defense',
      },
      {
        id: 'defender-right',
        offset: { x: 8, z: 9 },
        preSnapFacing: DEFENSE_PRE_SNAP_FACING,
        role: 'coverageDefender',
        team: 'defense',
      },
    ],
    id: 'slant-flat',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      coverageAssignments: {
        'defender-left': 'blocker-left',
        'defender-right': 'blocker-right',
      },
      eligibleReceiverIds: ['blocker-left', 'blocker-right'],
      receiverDisplayNames: {
        'blocker-left': 'Slant',
        'blocker-right': 'Flat',
      },
    },
    receiverRoutes: {
      'blocker-left': {
        speed: 9.5,
        targetOffset: { x: -2, z: 11 },
      },
      'blocker-right': {
        speed: 8.5,
        targetOffset: { x: 15, z: 5 },
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
      facingRadians: resolvePreSnapFacing(slot.preSnapFacing),
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
    player.facingRadians = resolvePreSnapFacing(slot.preSnapFacing);
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

export function resolvePreSnapFacing(facing: PreSnapFacingDefinition): number {
  return PRE_SNAP_FACING_RADIANS[facing.kind];
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

export function getEligibleReceiverIds(play: PlayDefinition): string[] {
  return play.pass?.eligibleReceiverIds ?? [];
}

export function getDefaultEligibleReceiverId(play: PlayDefinition): string | null {
  return getEligibleReceiverIds(play)[0] ?? null;
}

export function getNextEligibleReceiverId(
  play: PlayDefinition,
  currentReceiverId: string | null,
): string | null {
  const receiverIds = getEligibleReceiverIds(play);

  if (receiverIds.length === 0) {
    return null;
  }

  const currentIndex = currentReceiverId ? receiverIds.indexOf(currentReceiverId) : -1;
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % receiverIds.length;

  return receiverIds[nextIndex];
}

export function isEligibleReceiverId(play: PlayDefinition, receiverId: string | null): boolean {
  return !!receiverId && getEligibleReceiverIds(play).includes(receiverId);
}

export function getReceiverDisplayName(play: PlayDefinition, receiverId: string): string {
  return play.pass?.receiverDisplayNames?.[receiverId] ?? receiverId;
}

export function getCoverageAssignmentReceiverId(
  play: PlayDefinition,
  defenderId: string,
): string | null {
  const receiverIds = getEligibleReceiverIds(play);

  if (receiverIds.length === 0) {
    return null;
  }

  return play.pass?.coverageAssignments?.[defenderId] ?? receiverIds[0];
}

function calculateFormationSpot(ballSpot: FootballSpot, offset: Vector2): FootballSpot {
  const minX = PLAYABLE_FIELD_BOUNDS.minX + PLAYER_MOVEMENT_CONFIG.collisionRadius;
  const maxX = PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius;
  const minZ = PLAYABLE_FIELD_BOUNDS.minZ + PLAYER_MOVEMENT_CONFIG.collisionRadius;
  const maxZ = Math.min(
    OPPOSING_GOAL_LINE_Z - 2,
    PLAYABLE_FIELD_BOUNDS.maxZ - PLAYER_MOVEMENT_CONFIG.collisionRadius,
  );

  return {
    x: clamp(ballSpot.x + offset.x, minX, maxX),
    z: clamp(ballSpot.z + offset.z, minZ, maxZ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
