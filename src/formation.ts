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

export interface FormationPlayer {
  facingRadians: number;
  id: string;
  laneOffset?: Vector2;
  offset: Vector2;
  role: PlayerRole;
  team: PlayerTeam;
}

export const RUSHING_DRILL_FORMATION: FormationPlayer[] = [
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
    laneOffset: { x: 7, z: 14 },
    offset: { x: 4, z: 1.5 },
    role: 'blocker',
    team: 'offense',
  },
  {
    facingRadians: 0,
    id: 'blocker-right',
    laneOffset: { x: -7, z: 14 },
    offset: { x: -4, z: 1.5 },
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
] as const;

export function createFormationPlayers(ballSpot: FootballSpot): PlayerModel[] {
  return RUSHING_DRILL_FORMATION.map((slot) =>
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

export function resetFormationPlayers(players: PlayerModel[], ballSpot: FootballSpot): void {
  for (const player of players) {
    const slot = getFormationSlot(player.id);
    const spot = calculateFormationSpot(ballSpot, slot.offset);

    player.position.x = spot.x;
    player.position.z = spot.z;
    player.velocity.x = 0;
    player.velocity.z = 0;
    player.facingRadians = slot.facingRadians;
    player.currentState = 'idle';
  }
}

export function getBlockingLaneTarget(blocker: PlayerModel, ballSpot: FootballSpot): FootballSpot {
  const slot = getFormationSlot(blocker.id);
  const laneOffset = slot.laneOffset ?? slot.offset;

  return calculateFormationSpot(ballSpot, laneOffset);
}

export function getFormationSlot(playerId: string): FormationPlayer {
  const slot = RUSHING_DRILL_FORMATION.find((formationSlot) => formationSlot.id === playerId);

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
