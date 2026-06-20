import { LINE_OF_SCRIMMAGE_Z } from './field';
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

export function createBallModel(): BallModel {
  return {
    position: { x: 0, y: BALL_CARRY_ATTACHMENT.y, z: LINE_OF_SCRIMMAGE_Z },
    possession: { kind: 'none' },
  };
}

export function resetBallModel(ball: BallModel): void {
  ball.possession = { kind: 'none' };
  ball.position.x = 0;
  ball.position.y = BALL_CARRY_ATTACHMENT.y;
  ball.position.z = LINE_OF_SCRIMMAGE_Z;
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
