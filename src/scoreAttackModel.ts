export type ScoreAttackState = 'ready' | 'running' | 'expired' | 'gameOver';

export interface ScoreAttackModel {
  durationSeconds: number;
  finalScore: number | null;
  remainingSeconds: number;
  state: ScoreAttackState;
}

export interface ScoreAttackSnapshot {
  durationSeconds: number;
  finalScore: number | null;
  remainingSeconds: number;
  state: ScoreAttackState;
}

export const SCORE_ATTACK_CONFIG = {
  durationSeconds: 120,
} as const;

export function createScoreAttackModel(
  durationSeconds = SCORE_ATTACK_CONFIG.durationSeconds,
): ScoreAttackModel {
  return {
    durationSeconds,
    finalScore: null,
    remainingSeconds: durationSeconds,
    state: 'ready',
  };
}

export function startScoreAttack(scoreAttack: ScoreAttackModel): boolean {
  if (!canStartScoreAttackPlay(scoreAttack)) {
    return false;
  }

  if (scoreAttack.state === 'ready') {
    scoreAttack.state = 'running';
  }

  return true;
}

export function updateScoreAttackClock(
  scoreAttack: ScoreAttackModel,
  deltaSeconds: number,
): void {
  if (scoreAttack.state !== 'running') {
    return;
  }

  scoreAttack.remainingSeconds = Math.max(
    0,
    scoreAttack.remainingSeconds - Math.max(0, deltaSeconds),
  );

  if (scoreAttack.remainingSeconds === 0) {
    scoreAttack.state = 'expired';
  }
}

export function canStartScoreAttackPlay(scoreAttack: ScoreAttackModel): boolean {
  return (
    scoreAttack.remainingSeconds > 0 &&
    (scoreAttack.state === 'ready' || scoreAttack.state === 'running')
  );
}

export function hasScoreAttackExpired(scoreAttack: ScoreAttackModel): boolean {
  return scoreAttack.state === 'expired';
}

export function markScoreAttackGameOver(
  scoreAttack: ScoreAttackModel,
  finalScore: number,
): void {
  scoreAttack.remainingSeconds = 0;
  scoreAttack.finalScore = finalScore;
  scoreAttack.state = 'gameOver';
}

export function resetScoreAttack(scoreAttack: ScoreAttackModel): void {
  scoreAttack.remainingSeconds = scoreAttack.durationSeconds;
  scoreAttack.finalScore = null;
  scoreAttack.state = 'ready';
}

export function snapshotScoreAttack(
  scoreAttack: ScoreAttackModel,
): ScoreAttackSnapshot {
  return {
    durationSeconds: scoreAttack.durationSeconds,
    finalScore: scoreAttack.finalScore,
    remainingSeconds: scoreAttack.remainingSeconds,
    state: scoreAttack.state,
  };
}
