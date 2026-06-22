import type { MenuMusicPlaylistSnapshot } from '../audio/MenuMusicPlaylistController';

export interface NowPlayingIndicatorOptions {
  onNext: () => void;
  onPrevious: () => void;
}

export class NowPlayingIndicator {
  readonly root = document.createElement('aside');

  private readonly playbackDot = document.createElement('span');
  private readonly title = document.createElement('strong');
  private readonly composer = document.createElement('span');
  private readonly previousButton = document.createElement('button');
  private readonly nextButton = document.createElement('button');

  constructor(options: NowPlayingIndicatorOptions) {
    this.root.className = 'now-playing-indicator';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Now playing');

    this.playbackDot.className = 'now-playing-dot';
    this.playbackDot.setAttribute('aria-hidden', 'true');
    const text = document.createElement('div');
    text.className = 'now-playing-text';
    this.title.textContent = 'No music';
    this.composer.textContent = 'Football JS Original Soundtrack';
    text.append(this.title, this.composer);

    const controls = document.createElement('div');
    controls.className = 'now-playing-controls';
    this.previousButton.type = 'button';
    this.previousButton.className = 'now-playing-button';
    this.previousButton.textContent = 'Prev';
    this.previousButton.setAttribute('aria-label', 'Previous music track');
    this.previousButton.addEventListener('click', () => options.onPrevious());
    this.nextButton.type = 'button';
    this.nextButton.className = 'now-playing-button';
    this.nextButton.textContent = 'Next';
    this.nextButton.setAttribute('aria-label', 'Next music track');
    this.nextButton.addEventListener('click', () => options.onNext());
    controls.append(this.previousButton, this.nextButton);

    this.root.append(this.playbackDot, text, controls);
    document.body.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  sync(snapshot: MenuMusicPlaylistSnapshot): void {
    this.title.textContent = snapshot.trackTitle ?? 'No music';
    this.composer.textContent = snapshot.composerDisplay ?? 'Football JS Original Soundtrack';
    this.root.dataset.state = snapshot.state;
    this.root.dataset.playing = String(snapshot.loopActive);
    this.previousButton.disabled = snapshot.trackCount <= 1;
    this.nextButton.disabled = snapshot.trackCount <= 1;
  }

  dispose(): void {
    this.root.remove();
  }
}
