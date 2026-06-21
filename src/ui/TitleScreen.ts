import { GAME_BRAND } from '../config/GameBrand';

export interface TitleLoadingState {
  helmet: string;
  audio: string;
  crowd: string;
  developmentDetails?: readonly string[];
}

export interface TitleScreenOptions {
  setupElement: HTMLElement;
  onFirstGesture?: () => void;
  onStart: () => void;
}

export class TitleScreen {
  readonly root = document.createElement('div');

  private readonly startButton = document.createElement('button');
  private readonly settingsButton = document.createElement('button');
  private readonly settingsCloseButton = document.createElement('button');
  private readonly settingsOverlay = document.createElement('div');
  private readonly loadingLine = document.createElement('p');
  private readonly developmentDetails = document.createElement('p');
  private firstGestureHandled = false;
  private visible = true;

  constructor(options: TitleScreenOptions) {
    this.root.className = 'title-screen';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');

    const art = document.createElement('img');
    art.className = 'title-art';
    art.alt = '';
    art.decoding = 'async';
    art.src = GAME_BRAND.heroImageUrl;
    art.addEventListener('error', () => {
      art.hidden = true;
      this.root.dataset.missingTitleArt = 'true';
    });

    const overlay = document.createElement('div');
    overlay.className = 'title-gradient-overlay';

    const content = document.createElement('section');
    content.className = 'title-content';
    content.setAttribute('aria-labelledby', 'football-js-title-heading');

    const emblem = document.createElement('img');
    emblem.className = 'title-emblem';
    emblem.alt = '';
    emblem.decoding = 'async';
    emblem.src = GAME_BRAND.emblemImageUrl;
    emblem.addEventListener('error', () => {
      emblem.hidden = true;
      this.root.dataset.missingEmblem = 'true';
    });

    const title = document.createElement('h1');
    title.id = 'football-js-title-heading';
    title.textContent = GAME_BRAND.title;

    const actions = document.createElement('div');
    actions.className = 'title-primary-actions';

    this.startButton.className = 'title-primary-button';
    this.startButton.type = 'button';
    this.startButton.textContent = 'Start Game';
    this.startButton.addEventListener('click', () => {
      this.handleFirstGesture(options.onFirstGesture);
      options.onStart();
    });

    this.settingsButton.className = 'title-primary-button';
    this.settingsButton.type = 'button';
    this.settingsButton.textContent = 'Settings';
    this.settingsButton.addEventListener('click', () => {
      this.handleFirstGesture(options.onFirstGesture);
      this.openSettings();
    });
    actions.append(this.startButton, this.settingsButton);

    const footer = document.createElement('footer');
    footer.className = 'title-footer';
    const hint = document.createElement('p');
    hint.textContent = 'Enter starts | F1 developer tools';
    this.loadingLine.className = 'title-loading-line';
    this.developmentDetails.className = 'title-development-details';
    footer.append(hint, this.loadingLine, this.developmentDetails);

    content.append(emblem, title, actions, footer);
    this.settingsOverlay.className = 'title-settings-overlay';
    this.settingsOverlay.hidden = true;
    this.settingsOverlay.setAttribute('role', 'dialog');
    this.settingsOverlay.setAttribute('aria-modal', 'true');
    this.settingsOverlay.setAttribute('aria-label', 'Settings');
    const settingsCard = document.createElement('div');
    settingsCard.className = 'title-settings-card';
    const settingsHeader = document.createElement('header');
    const settingsTitle = document.createElement('h2');
    settingsTitle.textContent = 'Settings';
    this.settingsCloseButton.className = 'title-settings-close-button';
    this.settingsCloseButton.type = 'button';
    this.settingsCloseButton.textContent = 'Done';
    this.settingsCloseButton.addEventListener('click', () => this.closeSettings());
    settingsHeader.append(settingsTitle, this.settingsCloseButton);
    settingsCard.append(settingsHeader, options.setupElement);
    this.settingsOverlay.append(settingsCard);

    this.root.append(art, overlay, content, this.settingsOverlay);
    this.root.addEventListener('pointerdown', () => this.handleFirstGesture(options.onFirstGesture), {
      capture: true,
    });
    this.root.addEventListener('keydown', (event) => {
      this.handleFirstGesture(options.onFirstGesture);

      if (event.key === 'Escape' && this.isSettingsOpen()) {
        this.closeSettings();
        event.preventDefault();
        return;
      }

      if (
        event.key === 'Enter' &&
        !this.isSettingsOpen() &&
        event.target === this.root
      ) {
        this.startButton.click();
        event.preventDefault();
      }
    });
    this.root.tabIndex = -1;
    document.body.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
    if (visible) {
      this.closeSettings(false);
      this.startButton.focus({ preventScroll: true });
    }
  }

  isVisible(): boolean {
    return this.visible && !this.root.hidden;
  }

  isSettingsOpen(): boolean {
    return !this.settingsOverlay.hidden;
  }

  closeSettings(restoreFocus = true): void {
    this.settingsOverlay.hidden = true;
    if (restoreFocus && this.isVisible()) {
      this.settingsButton.focus({ preventScroll: true });
    }
  }

  syncLoadingState(state: TitleLoadingState): void {
    this.loadingLine.textContent = [
      `Helmet ${state.helmet}`,
      `Audio ${state.audio}`,
      `Crowd ${state.crowd}`,
    ].join(' | ');
    const details = state.developmentDetails?.filter(Boolean) ?? [];
    this.developmentDetails.textContent = details.join(' | ');
    this.developmentDetails.hidden = details.length === 0;
  }

  private openSettings(): void {
    this.settingsOverlay.hidden = false;
    this.settingsCloseButton.focus({ preventScroll: true });
  }

  private handleFirstGesture(callback?: () => void): void {
    if (this.firstGestureHandled) {
      return;
    }

    this.firstGestureHandled = true;
    callback?.();
  }
}
