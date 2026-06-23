import { APP_VERSION_LABEL } from '../config/AppVersion';
import { GAME_BRAND } from '../config/GameBrand';

export interface TitleLoadingState {
  helmet: string;
  audio: string;
  crowd: string;
  league?: string;
  leagueLoadingVisible?: boolean;
  developmentDetails?: readonly string[];
}

export interface TitleScreenOptions {
  onFirstGesture?: () => void;
  onStart: () => void;
}

export class TitleScreen {
  readonly root = document.createElement('div');

  private readonly startButton = document.createElement('button');
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

    actions.append(this.startButton);

    const footer = document.createElement('footer');
    footer.className = 'title-footer';
    const hint = document.createElement('p');
    hint.textContent = 'Enter starts | F1 developer tools';
    const version = document.createElement('p');
    version.className = 'title-version';
    version.textContent = APP_VERSION_LABEL;
    this.loadingLine.className = 'title-loading-line';
    this.developmentDetails.className = 'title-development-details';
    footer.append(hint, version, this.loadingLine, this.developmentDetails);

    content.append(emblem, title, actions, footer);
    this.root.append(art, overlay, content);
    this.root.addEventListener('pointerdown', () => this.handleFirstGesture(options.onFirstGesture), {
      capture: true,
    });
    this.root.addEventListener('keydown', (event) => {
      this.handleFirstGesture(options.onFirstGesture);

      if (
        event.key === 'Enter' &&
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
      this.startButton.focus({ preventScroll: true });
    }
  }

  isVisible(): boolean {
    return this.visible && !this.root.hidden;
  }

  syncLoadingState(state: TitleLoadingState): void {
    const parts = [
      `Helmet ${state.helmet}`,
      `Audio ${state.audio}`,
      `Crowd ${state.crowd}`,
    ];
    if (state.leagueLoadingVisible || state.league) {
      parts.push(state.leagueLoadingVisible ? `Preparing League... ${state.league ?? ''}` : `League ${state.league}`);
    }
    this.loadingLine.textContent = parts.join(' | ');
    const details = state.developmentDetails?.filter(Boolean) ?? [];
    this.developmentDetails.textContent = details.join(' | ');
    this.developmentDetails.hidden = details.length === 0;
  }

  private handleFirstGesture(callback?: () => void): void {
    if (this.firstGestureHandled) {
      return;
    }

    this.firstGestureHandled = true;
    callback?.();
  }
}
