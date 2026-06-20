import { describe, expect, it } from 'vitest';
import { BALL_CARRY_ATTACHMENT, updateCarriedBallPosition } from '../src/ballModel';
import { LINE_OF_SCRIMMAGE_Z } from '../src/field';
import {
  createGameplayModel,
  markPlayDead,
  resetPlay,
  snapshotGameplayModel,
  startPlay,
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
});
