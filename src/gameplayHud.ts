import type { GameplaySnapshot } from './playState';

export interface GameplayHud {
  root: HTMLDivElement;
  score: HTMLDivElement;
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

  document.body.appendChild(root);

  return { root, score, touchdownMessage };
}

export function syncGameplayHud(hud: GameplayHud, gameplay: GameplaySnapshot): void {
  hud.score.textContent = `Score ${gameplay.score}`;
  hud.touchdownMessage.hidden = gameplay.lastPlayResult !== 'touchdown';
}
