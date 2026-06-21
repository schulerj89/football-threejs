import type { GameplaySnapshot } from './playState';

export interface GameplayHud {
  outOfBoundsMessage: HTMLDivElement;
  resultMessage: HTMLDivElement;
  root: HTMLDivElement;
  score: HTMLDivElement;
  tackleMessage: HTMLDivElement;
  touchdownMessage: HTMLDivElement;
}

export function createGameplayHud(): GameplayHud {
  const root = document.createElement('div');
  root.className = 'gameplay-hud';

  const score = document.createElement('div');
  score.className = 'score-counter';
  root.appendChild(score);

  const touchdownMessage = document.createElement('div');
  touchdownMessage.className = 'touchdown-message';
  touchdownMessage.textContent = 'TOUCHDOWN';
  root.appendChild(touchdownMessage);

  const tackleMessage = document.createElement('div');
  tackleMessage.className = 'tackle-message';
  tackleMessage.textContent = 'TACKLED';
  root.appendChild(tackleMessage);

  const outOfBoundsMessage = document.createElement('div');
  outOfBoundsMessage.className = 'out-of-bounds-message';
  outOfBoundsMessage.textContent = 'OUT OF BOUNDS';
  root.appendChild(outOfBoundsMessage);

  const resultMessage = document.createElement('div');
  resultMessage.className = 'result-message';
  root.appendChild(resultMessage);

  document.body.appendChild(root);

  return { outOfBoundsMessage, resultMessage, root, score, tackleMessage, touchdownMessage };
}

export function syncGameplayHud(hud: GameplayHud, gameplay: GameplaySnapshot): void {
  const lastPlayResult = gameplay.lastPlayResult;

  hud.score.textContent = `Score ${gameplay.score}`;
  hud.tackleMessage.hidden = lastPlayResult?.type !== 'tackle';
  hud.touchdownMessage.hidden = lastPlayResult?.type !== 'touchdown';
  hud.outOfBoundsMessage.hidden = lastPlayResult?.type !== 'outOfBounds';
  hud.resultMessage.hidden =
    !lastPlayResult || !['tackle', 'outOfBounds'].includes(lastPlayResult.type);
  hud.resultMessage.textContent = lastPlayResult ? formatYards(lastPlayResult.yardsGained) : '';
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
