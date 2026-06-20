import type { GameplaySnapshot } from './playState';

export interface GameplayHud {
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

  document.body.appendChild(root);

  return { root, score, tackleMessage, touchdownMessage };
}

export function syncGameplayHud(hud: GameplayHud, gameplay: GameplaySnapshot): void {
  hud.score.textContent = `Score ${gameplay.score}`;
  hud.tackleMessage.hidden = gameplay.lastPlayResult !== 'tackle';
  hud.touchdownMessage.hidden = gameplay.lastPlayResult !== 'touchdown';
}
