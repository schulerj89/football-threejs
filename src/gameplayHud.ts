import type { GameplaySnapshot } from './playState';

export interface GameplayHud {
  clock: HTMLDivElement;
  driveStatus: HTMLDivElement;
  gameOverMessage: HTMLDivElement;
  incompleteMessage: HTMLDivElement;
  outOfBoundsMessage: HTMLDivElement;
  passWarningMessage: HTMLDivElement;
  playCall: HTMLDivElement;
  resultMessage: HTMLDivElement;
  root: HTMLDivElement;
  sackMessage: HTMLDivElement;
  score: HTMLDivElement;
  tackleMessage: HTMLDivElement;
  targetLabel: HTMLDivElement;
  touchdownMessage: HTMLDivElement;
  turnoverMessage: HTMLDivElement;
}

export function createGameplayHud(): GameplayHud {
  const root = document.createElement('div');
  root.className = 'gameplay-hud';

  const clock = document.createElement('div');
  clock.className = 'game-clock';
  root.appendChild(clock);

  const score = document.createElement('div');
  score.className = 'score-counter';
  root.appendChild(score);

  const driveStatus = document.createElement('div');
  driveStatus.className = 'drive-status';
  root.appendChild(driveStatus);

  const playCall = document.createElement('div');
  playCall.className = 'play-call';
  root.appendChild(playCall);

  const targetLabel = document.createElement('div');
  targetLabel.className = 'target-label';
  root.appendChild(targetLabel);

  const touchdownMessage = document.createElement('div');
  touchdownMessage.className = 'touchdown-message';
  touchdownMessage.textContent = 'TOUCHDOWN';
  root.appendChild(touchdownMessage);

  const tackleMessage = document.createElement('div');
  tackleMessage.className = 'tackle-message';
  tackleMessage.textContent = 'TACKLED';
  root.appendChild(tackleMessage);

  const sackMessage = document.createElement('div');
  sackMessage.className = 'sack-message';
  sackMessage.textContent = 'SACK';
  root.appendChild(sackMessage);

  const outOfBoundsMessage = document.createElement('div');
  outOfBoundsMessage.className = 'out-of-bounds-message';
  outOfBoundsMessage.textContent = 'OUT OF BOUNDS';
  root.appendChild(outOfBoundsMessage);

  const incompleteMessage = document.createElement('div');
  incompleteMessage.className = 'incomplete-message';
  incompleteMessage.textContent = 'INCOMPLETE';
  root.appendChild(incompleteMessage);

  const passWarningMessage = document.createElement('div');
  passWarningMessage.className = 'pass-warning-message';
  passWarningMessage.textContent = 'PAST LINE OF SCRIMMAGE';
  root.appendChild(passWarningMessage);

  const resultMessage = document.createElement('div');
  resultMessage.className = 'result-message';
  root.appendChild(resultMessage);

  const turnoverMessage = document.createElement('div');
  turnoverMessage.className = 'turnover-message';
  turnoverMessage.textContent = 'TURNOVER ON DOWNS';
  root.appendChild(turnoverMessage);

  const gameOverMessage = document.createElement('div');
  gameOverMessage.className = 'game-over-message';
  root.appendChild(gameOverMessage);

  document.body.appendChild(root);

  return {
    clock,
    driveStatus,
    gameOverMessage,
    incompleteMessage,
    outOfBoundsMessage,
    passWarningMessage,
    playCall,
    resultMessage,
    root,
    sackMessage,
    score,
    tackleMessage,
    targetLabel,
    touchdownMessage,
    turnoverMessage,
  };
}

export function syncGameplayHud(hud: GameplayHud, gameplay: GameplaySnapshot): void {
  const lastPlayResult = gameplay.lastPlayResult;
  const isTurnoverOnDowns = gameplay.drive.lastDriveResult?.type === 'turnoverOnDowns';
  const isGameOver = gameplay.playState === 'gameOver';

  hud.clock.textContent = `Time ${formatClock(gameplay.scoreAttack.remainingSeconds)}`;
  hud.score.textContent = `Score ${gameplay.score}`;
  hud.driveStatus.textContent = `${formatDown(gameplay.drive.currentDown)} & ${formatDistance(
    gameplay.drive.yardsToFirstDown,
  )} | Ball ${formatNumber(gameplay.drive.lineOfScrimmage.z)}`;
  hud.playCall.textContent = gameplay.selectedPlay.displayName;
  hud.targetLabel.hidden = !gameplay.selectedReceiver;
  hud.targetLabel.textContent = gameplay.selectedReceiver
    ? `Target ${gameplay.selectedReceiver.displayName}`
    : '';
  hud.tackleMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'tackle';
  hud.sackMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'sack';
  hud.touchdownMessage.hidden = isGameOver || lastPlayResult?.type !== 'touchdown';
  hud.outOfBoundsMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'outOfBounds';
  hud.incompleteMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'incomplete';
  hud.passWarningMessage.hidden = isGameOver || gameplay.passFeedback !== 'pastLineOfScrimmage';
  hud.turnoverMessage.hidden = isGameOver || !isTurnoverOnDowns;
  hud.resultMessage.hidden =
    isGameOver ||
    !lastPlayResult ||
    !['tackle', 'outOfBounds', 'incomplete', 'sack'].includes(lastPlayResult.type);
  hud.resultMessage.textContent = lastPlayResult ? formatYards(lastPlayResult.yardsGained) : '';
  hud.gameOverMessage.hidden = !isGameOver;
  hud.gameOverMessage.textContent = isGameOver
    ? `FINAL SCORE ${gameplay.scoreAttack.finalScore ?? gameplay.score} - PRESS ENTER`
    : '';
}

function formatClock(totalSeconds: number): string {
  const clampedSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDown(down: number): string {
  if (down === 1) {
    return '1st';
  }

  if (down === 2) {
    return '2nd';
  }

  if (down === 3) {
    return '3rd';
  }

  return `${down}th`;
}

function formatDistance(yardsToFirstDown: number): string {
  return formatNumber(Math.round(yardsToFirstDown * 10) / 10);
}

function formatYards(yardsGained: number): string {
  const roundedYards = Math.round(yardsGained * 10) / 10;

  if (roundedYards > 0) {
    return `+${formatNumber(roundedYards)} yards`;
  }

  return `${formatNumber(roundedYards)} yards`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toFixed(0);
  }

  return value.toFixed(1);
}
