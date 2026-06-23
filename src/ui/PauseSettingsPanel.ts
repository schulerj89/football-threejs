import {
  SETTINGS_DONE_EVENT,
  SETTINGS_OPEN_FULL_EVENT,
} from './SettingsPanel';

export interface PauseSettingsPanelOptions {
  onFullSettings?: () => void;
  setupElement: HTMLElement;
  onClose: () => void;
  onReturnToTitle: () => void;
}

export class PauseSettingsPanel {
  readonly root = document.createElement('div');

  private readonly returnToTitleButton = document.createElement('button');

  constructor(options: PauseSettingsPanelOptions) {
    this.root.className = 'pause-settings-panel';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
    this.root.addEventListener('touchmove', (event) => event.stopPropagation(), { passive: true });
    options.setupElement.addEventListener(SETTINGS_DONE_EVENT, () => options.onClose());
    options.setupElement.addEventListener(SETTINGS_OPEN_FULL_EVENT, () => options.onFullSettings?.());

    const panel = document.createElement('div');
    panel.className = 'pause-settings-card';

    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = 'Settings';
    header.append(title);

    const note = document.createElement('p');
    note.className = 'settings-note';
    note.textContent = 'Quick changes apply immediately. Use Full Settings for safe presentation and audio details.';

    this.returnToTitleButton.type = 'button';
    this.returnToTitleButton.className = 'return-title-button';
    this.returnToTitleButton.textContent = 'Return to Title';
    this.returnToTitleButton.addEventListener('click', options.onReturnToTitle);

    panel.append(header, note, options.setupElement, this.returnToTitleButton);
    this.root.append(panel);
    document.body.append(this.root);
  }

  isVisible(): boolean {
    return !this.root.hidden;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) {
      const firstControl = this.root.querySelector<HTMLElement>('button, select, input');
      firstControl?.focus({ preventScroll: true });
    }
  }
}
