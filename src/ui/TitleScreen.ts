export interface TitleLoadingState {
  helmet: string;
  audio: string;
  crowd: string;
  developmentDetails?: readonly string[];
}

export interface TitleScreenOptions {
  setupElement: HTMLElement;
  onStart: () => void;
}

export class TitleScreen {
  readonly root = document.createElement('div');

  private readonly startButton = document.createElement('button');
  private readonly loadingList = document.createElement('ul');
  private readonly developmentDetails = document.createElement('p');

  constructor(options: TitleScreenOptions) {
    this.root.className = 'title-screen';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');

    const panel = document.createElement('div');
    panel.className = 'title-panel';

    const header = document.createElement('header');
    header.className = 'title-header';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'title-eyebrow';
    eyebrow.textContent = 'Low-poly football prototype';
    const title = document.createElement('h1');
    title.textContent = 'Gridiron Prototype';
    const subtitle = document.createElement('p');
    subtitle.className = 'title-subtitle';
    subtitle.textContent = 'Choose a presentation profile, pick a prototype mode, then take the field.';
    header.append(eyebrow, title, subtitle);

    this.startButton.className = 'title-start-button';
    this.startButton.type = 'button';
    this.startButton.textContent = 'Start Game';
    this.startButton.addEventListener('click', options.onStart);

    const settingsTitle = document.createElement('h2');
    settingsTitle.textContent = 'Settings';

    const controls = document.createElement('section');
    controls.className = 'title-controls';
    const controlsTitle = document.createElement('h2');
    controlsTitle.textContent = 'Controls';
    const controlsList = document.createElement('ul');
    for (const control of [
      'WASD or arrow keys: Move the controlled player',
      'Space: Snap the ball',
      'F: Throw on passing plays',
      'E: Cycle eligible receivers',
      'R: Reset the current play',
      'C: Cycle development cameras',
      'Escape: Settings during pre-snap or dead-ball pauses',
      'F1: Toggle developer debug tools',
      'M: Mute audio',
    ]) {
      const item = document.createElement('li');
      item.textContent = control;
      controlsList.append(item);
    }
    controls.append(controlsTitle, controlsList);

    const loading = document.createElement('section');
    loading.className = 'title-loading';
    const loadingTitle = document.createElement('h2');
    loadingTitle.textContent = 'Loading';
    this.developmentDetails.className = 'title-development-details';
    loading.append(loadingTitle, this.loadingList, this.developmentDetails);

    const infoGrid = document.createElement('div');
    infoGrid.className = 'title-info-grid';
    infoGrid.append(controls, loading);

    panel.append(header, this.startButton, settingsTitle, options.setupElement, infoGrid);
    this.root.append(panel);
    document.body.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) {
      this.startButton.focus({ preventScroll: true });
    }
  }

  syncLoadingState(state: TitleLoadingState): void {
    this.loadingList.replaceChildren(
      this.createLoadingItem('Helmet', state.helmet),
      this.createLoadingItem('Optional audio', state.audio),
      this.createLoadingItem('Crowd', state.crowd),
    );
    const details = state.developmentDetails?.filter(Boolean) ?? [];
    this.developmentDetails.textContent = details.join(' | ');
    this.developmentDetails.hidden = details.length === 0;
  }

  private createLoadingItem(label: string, value: string): HTMLLIElement {
    const item = document.createElement('li');
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const valueSpan = document.createElement('strong');
    valueSpan.textContent = value;
    item.append(labelSpan, valueSpan);
    return item;
  }
}
