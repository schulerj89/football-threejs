import { INITIAL_BALL_SPOT } from './field';
import type { FootballSpot } from './fieldScale';
import type { PlayerModel } from './playerModel';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type BallPossession =
  | { kind: 'none' }
  | { kind: 'player'; playerId: string };

export interface BallModel {
  position: Vector3;
  possession: BallPossession;
}

export const BALL_CARRY_ATTACHMENT = {
  x: -0.48,
  y: 0.72,
  z: 0.58,
} as const;

export function createBallModel(initialSpot: FootballSpot = INITIAL_BALL_SPOT): BallModel {
  return {
    position: { x: initialSpot.x, y: BALL_CARRY_ATTACHMENT.y, z: initialSpot.z },
    possession: { kind: 'none' },
  };
}

export function resetBallModel(ball: BallModel, spot: FootballSpot = INITIAL_BALL_SPOT): void {
  ball.possession = { kind: 'none' };
  ball.position.x = spot.x;
  ball.position.y = BALL_CARRY_ATTACHMENT.y;
  ball.position.z = spot.z;
}

export function giveBallToPlayer(ball: BallModel, player: PlayerModel): void {
  ball.possession = { kind: 'player', playerId: player.id };
  updateCarriedBallPosition(ball, player);
}

export function updateCarriedBallPosition(ball: BallModel, player: PlayerModel): void {
  if (ball.possession.kind !== 'player' || ball.possession.playerId !== player.id) {
    return;
  }

  const cos = Math.cos(player.facingRadians);
  const sin = Math.sin(player.facingRadians);

  ball.position.x = player.position.x + BALL_CARRY_ATTACHMENT.x * cos + BALL_CARRY_ATTACHMENT.z * sin;
  ball.position.y = BALL_CARRY_ATTACHMENT.y;
  ball.position.z = player.position.z - BALL_CARRY_ATTACHMENT.x * sin + BALL_CARRY_ATTACHMENT.z * cos;
}
