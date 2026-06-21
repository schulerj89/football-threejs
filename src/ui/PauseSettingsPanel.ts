export interface PauseSettingsPanelOptions {
  setupElement: HTMLElement;
  onClose: () => void;
  onReturnToTitle: () => void;
}

export class PauseSettingsPanel {
  readonly root = document.createElement('div');

  private readonly closeButton = document.createElement('button');
  private readonly returnToTitleButton = document.createElement('button');

  constructor(options: PauseSettingsPanelOptions) {
    this.root.className = 'pause-settings-panel';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
    this.root.addEventListener('touchmove', (event) => event.stopPropagation(), { passive: true });

    const panel = document.createElement('div');
    panel.className = 'pause-settings-card';

    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = 'Settings';
    this.closeButton.type = 'button';
    this.closeButton.className = 'pause-close-button';
    this.closeButton.textContent = 'Close';
    this.closeButton.addEventListener('click', options.onClose);
    header.append(title, this.closeButton);

    const note = document.createElement('p');
    note.className = 'settings-note';
    note.textContent = 'Volume, captions, crowd, and camera presentation changes apply immediately. Change game mode, teams, or uniforms from the title screen.';

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
      this.closeButton.focus({ preventScroll: true });
    }
  }
}
