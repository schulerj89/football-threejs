import { describe, expect, it } from 'vitest';
import { BALL_CARRY_ATTACHMENT, updateCarriedBallPosition } from '../src/ballModel';
import { LINE_OF_SCRIMMAGE_Z } from '../src/field';
import { PLAYER_MOVEMENT_CONFIG } from '../src/playerModel';
import {
  GAMEPLAY_CONFIG,
  createGameplayModel,
  hasCrossedOpposingGoalLine,
  markPlayDead,
  resetPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
} from '../src/playState';

describe('play state transitions', () => {
  it('starts in preSnap at the line of scrimmage without ball possession', () => {
    const gameplay = createGameplayModel();

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.player.position).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z });
    expect(gameplay.player.velocity).toEqual({ x: 0, z: 0 });
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
  });

  it('starts a valid play from preSnap and gives the player possession', () => {
    const gameplay = createGameplayModel();

    expect(startPlay(gameplay)).toBe(true);

    expect(gameplay.playState).toBe('live');
    expect(gameplay.ball.possession).toEqual({
      kind: 'player',
      playerId: gameplay.player.id,
    });
    expect(gameplay.ball.position.x).toBeCloseTo(gameplay.player.position.x + BALL_CARRY_ATTACHMENT.x);
    expect(gameplay.ball.position.y).toBeCloseTo(BALL_CARRY_ATTACHMENT.y);
    expect(gameplay.ball.position.z).toBeCloseTo(gameplay.player.position.z + BALL_CARRY_ATTACHMENT.z);
  });

  it('rejects invalid start and dead transitions', () => {
    const gameplay = createGameplayModel();

    expect(markPlayDead(gameplay)).toBe(false);
    expect(gameplay.playState).toBe('preSnap');
    expect(startPlay(gameplay)).toBe(true);
    expect(startPlay(gameplay)).toBe(false);
    expect(gameplay.playState).toBe('live');
    expect(markPlayDead(gameplay)).toBe(true);
    expect(startPlay(gameplay)).toBe(false);
    expect(markPlayDead(gameplay)).toBe(false);
    expect(gameplay.playState).toBe('dead');
  });

  it('resets to preSnap and clears possession from live or dead', () => {
    const gameplay = createGameplayModel();

    startPlay(gameplay);
    gameplay.player.position.x = 8;
    gameplay.player.position.z = -4;
    gameplay.player.velocity.x = 12;
    resetPlay(gameplay);

    expect(snapshotGameplayModel(gameplay)).toMatchObject({
      ball: {
        possession: { kind: 'none' },
        position: { x: 0, y: BALL_CARRY_ATTACHMENT.y, z: LINE_OF_SCRIMMAGE_Z },
      },
      player: {
        position: { x: 0, z: LINE_OF_SCRIMMAGE_Z },
        velocity: { x: 0, z: 0 },
      },
      playState: 'preSnap',
    });

    startPlay(gameplay);
    markPlayDead(gameplay);
    resetPlay(gameplay);
    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
  });

  it('keeps carried ball position derived from the gameplay player model', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.x = 3;
    gameplay.player.position.z = -10;
    gameplay.player.facingRadians = Math.PI / 2;

    updateCarriedBallPosition(gameplay.ball, gameplay.player);

    expect(gameplay.ball.position.x).toBeCloseTo(3 + BALL_CARRY_ATTACHMENT.z);
    expect(gameplay.ball.position.z).toBeCloseTo(-10 - BALL_CARRY_ATTACHMENT.x);
  });

  it('scores when the possessed player crosses the opposing goal line during live play', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    expect(hasCrossedOpposingGoalLine(gameplay.player)).toBe(true);
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toBe('touchdown');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
    expect(gameplay.touchdownResetTimerSeconds).toBe(GAMEPLAY_CONFIG.touchdownResetDelaySeconds);
  });

  it('does not score before crossing the opposing goal line', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth - 0.01;

    expect(hasCrossedOpposingGoalLine(gameplay.player)).toBe(false);
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('live');
    expect(gameplay.lastPlayResult).toBe('none');
    expect(gameplay.score).toBe(0);
  });

  it('does not record multiple touchdowns during one play', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, 0.1);
    updateGameplayModel(gameplay, 0.1);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
  });

  it('auto-resets after the configured touchdown delay without clearing score', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.touchdownResetDelaySeconds);

    expect(snapshotGameplayModel(gameplay)).toMatchObject({
      ball: { possession: { kind: 'none' } },
      lastPlayResult: 'none',
      player: { position: { x: 0, z: LINE_OF_SCRIMMAGE_Z }, velocity: { x: 0, z: 0 } },
      playState: 'preSnap',
      score: GAMEPLAY_CONFIG.touchdownPoints,
    });
  });
});
