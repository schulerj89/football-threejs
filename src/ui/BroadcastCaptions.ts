import type { BroadcastCommentarySnapshot } from '../audio/BroadcastCommentaryDirector';

export function createBroadcastCaptions(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'broadcast-captions';
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('role', 'status');
  element.hidden = true;
  document.body.appendChild(element);
  return element;
}

export function syncBroadcastCaptions(
  element: HTMLElement,
  snapshot: BroadcastCommentarySnapshot,
): void {
  const caption = snapshot.currentCaption;
  const visible = snapshot.enabled && snapshot.captionsEnabled && !!caption;

  element.hidden = !visible;
  element.textContent = visible ? caption : '';
}
