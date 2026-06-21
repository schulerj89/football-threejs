import type { GameplaySnapshot } from './playState';

export interface GameplayHud {
  driveStatus: HTMLDivElement;
  incompleteMessage: HTMLDivElement;
  outOfBoundsMessage: HTMLDivElement;
  passWarningMessage: HTMLDivElement;
  playCall: HTMLDivElement;
  resultMessage: HTMLDivElement;
  root: HTMLDivElement;
  sackMessage: HTMLDivElement;
  score: HTMLDivElement;
  tackleMessage: HTMLDivElement;
  touchdownMessage: HTMLDivElement;
  turnoverMessage: HTMLDivElement;
}

export function createGameplayHud(): GameplayHud {
  const root = document.createElement('div');
  root.className = 'gameplay-hud';

  const score = document.createElement('div');
  score.className = 'score-counter';
  root.appendChild(score);

  const driveStatus = document.createElement('div');
  driveStatus.className = 'drive-status';
  root.appendChild(driveStatus);

  const playCall = document.createElement('div');
  playCall.className = 'play-call';
  root.appendChild(playCall);

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

  document.body.appendChild(root);

  return {
    driveStatus,
    incompleteMessage,
    outOfBoundsMessage,
    passWarningMessage,
    playCall,
    resultMessage,
    root,
    sackMessage,
    score,
    tackleMessage,
    touchdownMessage,
    turnoverMessage,
  };
}

export function syncGameplayHud(hud: GameplayHud, gameplay: GameplaySnapshot): void {
  const lastPlayResult = gameplay.lastPlayResult;
  const isTurnoverOnDowns = gameplay.drive.lastDriveResult?.type === 'turnoverOnDowns';

  hud.score.textContent = `Score ${gameplay.score}`;
  hud.driveStatus.textContent = `${formatDown(gameplay.drive.currentDown)} & ${formatDistance(
    gameplay.drive.yardsToFirstDown,
  )} | Ball ${formatNumber(gameplay.drive.lineOfScrimmage.z)}`;
  hud.playCall.textContent = gameplay.selectedPlay.displayName;
  hud.tackleMessage.hidden = isTurnoverOnDowns || lastPlayResult?.type !== 'tackle';
  hud.sackMessage.hidden = isTurnoverOnDowns || lastPlayResult?.type !== 'sack';
  hud.touchdownMessage.hidden = lastPlayResult?.type !== 'touchdown';
  hud.outOfBoundsMessage.hidden = isTurnoverOnDowns || lastPlayResult?.type !== 'outOfBounds';
  hud.incompleteMessage.hidden = isTurnoverOnDowns || lastPlayResult?.type !== 'incomplete';
  hud.passWarningMessage.hidden = gameplay.passFeedback !== 'pastLineOfScrimmage';
  hud.turnoverMessage.hidden = !isTurnoverOnDowns;
  hud.resultMessage.hidden =
    !lastPlayResult || !['tackle', 'outOfBounds', 'incomplete', 'sack'].includes(lastPlayResult.type);
  hud.resultMessage.textContent = lastPlayResult ? formatYards(lastPlayResult.yardsGained) : '';
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
