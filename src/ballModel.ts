import { INITIAL_BALL_SPOT } from './field';
import type { FootballSpot } from './fieldScale';
import type { PlayerModel } from './playerModel';
import { evaluateSweptCatch } from './passTargeting';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type BallPossession =
  | { kind: 'none' }
  | { kind: 'player'; playerId: string };

export type BallState =
  | { kind: 'dead' }
  | { kind: 'possessed'; playerId: string }
  | {
      durationSeconds: number;
      elapsedSeconds: number;
      kind: 'inFlight';
      maxFlightTimeSeconds: number;
      peakHeight: number;
      start: Vector3;
      target: Vector3;
    }
  | { kind: 'caught'; playerId: string }
  | { kind: 'incomplete' };

export interface BallModel {
  position: Vector3;
  previousPosition: Vector3;
  possession: BallPossession;
  state: BallState;
}

export const BALL_CARRY_ATTACHMENT = {
  x: -0.48,
  y: 0.72,
  z: 0.58,
} as const;

export const PASSING_CONFIG = {
  catchRadius: 2.4,
  catchTargetHeight: 1.35,
  targetingIterations: 4,
  maxCatchHeight: 4.4,
  maxFlightSeconds: 1.05,
  maxFlightTimeSeconds: 1.25,
  minCatchHeight: 0.35,
  minFlightSeconds: 0.45,
  passSpeed: 18,
  peakHeight: 3.4,
} as const;

export function createBallModel(initialSpot: FootballSpot = INITIAL_BALL_SPOT): BallModel {
  const position = { x: initialSpot.x, y: BALL_CARRY_ATTACHMENT.y, z: initialSpot.z };

  return {
    position: { ...position },
    previousPosition: { ...position },
    possession: { kind: 'none' },
    state: { kind: 'dead' },
  };
}

export function resetBallModel(ball: BallModel, spot: FootballSpot = INITIAL_BALL_SPOT): void {
  ball.possession = { kind: 'none' };
  ball.state = { kind: 'dead' };
  ball.position.x = spot.x;
  ball.position.y = BALL_CARRY_ATTACHMENT.y;
  ball.position.z = spot.z;
  ball.previousPosition = { ...ball.position };
}

export function giveBallToPlayer(
  ball: BallModel,
  player: PlayerModel,
  stateKind: 'possessed' | 'caught' = 'possessed',
): void {
  ball.possession = { kind: 'player', playerId: player.id };
  ball.state = { kind: stateKind, playerId: player.id };
  updateCarriedBallPosition(ball, player);
  ball.previousPosition = { ...ball.position };
}

export function throwBallToward(ball: BallModel, target: Vector3): boolean {
  if (ball.possession.kind !== 'player') {
    return false;
  }

  const start = { ...ball.position };
  const distance = Math.hypot(target.x - start.x, target.z - start.z);
  const durationSeconds = clamp(
    distance / PASSING_CONFIG.passSpeed,
    PASSING_CONFIG.minFlightSeconds,
    PASSING_CONFIG.maxFlightSeconds,
  );

  ball.possession = { kind: 'none' };
  ball.previousPosition = { ...start };
  ball.state = {
    durationSeconds,
    elapsedSeconds: 0,
    kind: 'inFlight',
    maxFlightTimeSeconds: PASSING_CONFIG.maxFlightTimeSeconds,
    peakHeight: PASSING_CONFIG.peakHeight,
    start,
    target: { ...target },
  };

  return true;
}

export function updateInFlightBall(ball: BallModel, deltaSeconds: number): void {
  if (ball.state.kind !== 'inFlight') {
    return;
  }

  const flight = ball.state;
  ball.previousPosition = { ...ball.position };
  flight.elapsedSeconds = Math.min(
    flight.maxFlightTimeSeconds,
    flight.elapsedSeconds + Math.max(0, deltaSeconds),
  );
  const t = clamp(flight.elapsedSeconds / flight.durationSeconds, 0, 1);

  ball.position.x = lerp(flight.start.x, flight.target.x, t);
  ball.position.z = lerp(flight.start.z, flight.target.z, t);
  ball.position.y =
    lerp(flight.start.y, flight.target.y, t) + Math.sin(Math.PI * t) * flight.peakHeight;
}

export function isPassFlightFinished(ball: BallModel): boolean {
  if (ball.state.kind !== 'inFlight') {
    return false;
  }

  return (
    ball.state.elapsedSeconds >= ball.state.durationSeconds ||
    ball.state.elapsedSeconds >= ball.state.maxFlightTimeSeconds ||
    ball.position.y <= 0
  );
}

export function isBallCatchableByPlayer(ball: BallModel, player: PlayerModel): boolean {
  if (ball.state.kind !== 'inFlight') {
    return false;
  }

  return evaluateSweptCatch(
    ball.previousPosition,
    ball.position,
    player.position,
    player.position,
    PASSING_CONFIG,
  ).catchable;
}

export function markBallIncomplete(ball: BallModel): void {
  ball.possession = { kind: 'none' };
  ball.state = { kind: 'incomplete' };
}

export function markBallDead(ball: BallModel): void {
  ball.possession = { kind: 'none' };
  ball.state = { kind: 'dead' };
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
  ball.previousPosition = { ...ball.position };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
