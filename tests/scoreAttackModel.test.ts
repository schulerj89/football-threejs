import { describe, expect, it } from 'vitest';
import {
  canStartScoreAttackPlay,
  createScoreAttackModel,
  markScoreAttackGameOver,
  resetScoreAttack,
  startScoreAttack,
  updateScoreAttackClock,
} from '../src/scoreAttackModel';

describe('score attack clock model', () => {
  it('starts ready at 120 seconds and does not tick before the first snap', () => {
    const scoreAttack = createScoreAttackModel();

    updateScoreAttackClock(scoreAttack, 5);

    expect(scoreAttack).toMatchObject({
      durationSeconds: 120,
      finalScore: null,
      remainingSeconds: 120,
      state: 'ready',
    });
    expect(canStartScoreAttackPlay(scoreAttack)).toBe(true);
  });

  it('starts on demand and decreases from supplied delta time', () => {
    const scoreAttack = createScoreAttackModel();

    expect(startScoreAttack(scoreAttack)).toBe(true);
    updateScoreAttackClock(scoreAttack, 12.5);

    expect(scoreAttack.state).toBe('running');
    expect(scoreAttack.remainingSeconds).toBeCloseTo(107.5);
  });

  it('clamps at zero and rejects further play starts after expiry', () => {
    const scoreAttack = createScoreAttackModel();

    startScoreAttack(scoreAttack);
    updateScoreAttackClock(scoreAttack, 999);

    expect(scoreAttack.remainingSeconds).toBe(0);
    expect(scoreAttack.state).toBe('expired');
    expect(canStartScoreAttackPlay(scoreAttack)).toBe(false);
  });

  it('records final score at game over and resets to a fresh challenge', () => {
    const scoreAttack = createScoreAttackModel();

    startScoreAttack(scoreAttack);
    updateScoreAttackClock(scoreAttack, 120);
    markScoreAttackGameOver(scoreAttack, 18);

    expect(scoreAttack).toMatchObject({
      finalScore: 18,
      remainingSeconds: 0,
      state: 'gameOver',
    });

    resetScoreAttack(scoreAttack);

    expect(scoreAttack).toMatchObject({
      finalScore: null,
      remainingSeconds: 120,
      state: 'ready',
    });
  });
});
