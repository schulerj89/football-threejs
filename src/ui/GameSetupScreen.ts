import {
  BROADCAST_EXPERIENCE_SETTINGS,
  PERFORMANCE_EXPERIENCE_SETTINGS,
  normalizeGameExperienceSettings,
  type ExperienceCameraMode,
  type ExperiencePreset,
  type GameExperienceSettings,
} from '../config/GameExperienceSettings';
import type { CinematicsSetting } from '../camera/PresentationCameraDirector';
import type { CrowdDensity } from '../presentation/CrowdPresentationController';
import type { PlaybookId } from '../roster';

export interface GameSetupScreenOptions {
  initialSettings: GameExperienceSettings;
  onSettingsChange?: (settings: GameExperienceSettings) => void;
  showGameMode?: boolean;
}

export class GameSetupScreen {
  readonly root = document.createElement('section');

  private settings: GameExperienceSettings;
  private readonly onSettingsChange?: (settings: GameExperienceSettings) => void;
  private readonly showGameMode: boolean;
  private readonly presetSelect = document.createElement('select');
  private readonly playbookSelect = document.createElement('select');
  private readonly cameraSelect = document.createElement('select');
  private readonly cinematicsSelect = document.createElement('select');
  private readonly crowdVisualsInput = document.createElement('input');
  private readonly crowdDensitySelect = document.createElement('select');
  private readonly crowdReactionsInput = document.createElement('input');
  private readonly audioEnabledInput = document.createElement('input');
  private readonly crowdAudioInput = document.createElement('input');
  private readonly announcerInput = document.createElement('input');
  private readonly captionsInput = document.createElement('input');
  private readonly customControls: HTMLElement[] = [];

  constructor(options: GameSetupScreenOptions) {
    this.settings = normalizeGameExperienceSettings(options.initialSettings);
    this.onSettingsChange = options.onSettingsChange;
    this.showGameMode = options.showGameMode ?? true;
    this.root.className = 'game-setup-screen';
    this.root.append(this.createContent());
    this.syncControls();
  }

  getSettings(): GameExperienceSettings {
    return { ...this.settings };
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settings = normalizeGameExperienceSettings(settings);
    this.syncControls();
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'game-setup-grid';

    const primary = document.createElement('div');
    primary.className = 'game-setup-primary';
    primary.append(
      this.createSelectRow('Presentation preset', this.presetSelect, [
        ['broadcast', 'Broadcast'],
        ['performance', 'Performance'],
        ['custom', 'Custom'],
      ]),
    );

    if (this.showGameMode) {
      primary.append(
        this.createSelectRow('Game mode', this.playbookSelect, [
          ['7v7', '7v7 Prototype'],
          ['5v5', '5v5 Legacy Development Mode'],
        ]),
      );
    } else {
      const lockedMode = document.createElement('p');
      lockedMode.className = 'settings-note';
      lockedMode.textContent = 'Game mode changes require returning to the title screen.';
      primary.append(lockedMode);
    }

    const custom = document.createElement('div');
    custom.className = 'game-setup-custom';
    const customTitle = document.createElement('h3');
    customTitle.textContent = 'Custom Settings';
    custom.append(
      customTitle,
      this.createSelectRow('Gameplay camera', this.cameraSelect, [
        ['offense', 'Offense'],
        ['tactical', 'Tactical'],
        ['cinematic', 'Cinematic'],
      ]),
      this.createSelectRow('Cinematics', this.cinematicsSelect, [
        ['off', 'Off'],
        ['brief', 'Brief'],
        ['full', 'Full'],
      ]),
      this.createCheckboxRow('Crowd visuals', this.crowdVisualsInput),
      this.createSelectRow('Crowd density', this.crowdDensitySelect, [
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
      ]),
      this.createCheckboxRow('Crowd reactions', this.crowdReactionsInput),
      this.createCheckboxRow('Master audio', this.audioEnabledInput),
      this.createCheckboxRow('Crowd audio', this.crowdAudioInput),
      this.createCheckboxRow('Announcer', this.announcerInput),
      this.createCheckboxRow('Captions', this.captionsInput),
    );

    content.append(primary, custom);
    this.installHandlers();
    return content;
  }

  private createSelectRow(
    labelText: string,
    select: HTMLSelectElement,
    options: Array<readonly [string, string]>,
  ): HTMLElement {
    const label = document.createElement('label');
    label.className = 'settings-row';
    const span = document.createElement('span');
    span.textContent = labelText;
    for (const [value, text] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    label.append(span, select);
    this.customControls.push(select);
    return label;
  }

  private createCheckboxRow(labelText: string, input: HTMLInputElement): HTMLElement {
    const label = document.createElement('label');
    label.className = 'settings-row settings-row-checkbox';
    input.type = 'checkbox';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, input);
    this.customControls.push(input);
    return label;
  }

  private installHandlers(): void {
    this.presetSelect.addEventListener('change', () => {
      const preset = this.presetSelect.value as ExperiencePreset;
      const playbookId = this.settings.playbookId;
      const next =
        preset === 'broadcast'
          ? { ...BROADCAST_EXPERIENCE_SETTINGS, playbookId }
          : preset === 'performance'
            ? { ...PERFORMANCE_EXPERIENCE_SETTINGS, playbookId }
            : { ...this.settings, preset: 'custom' as const };
      this.updateSettings(next);
    });

    this.playbookSelect.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        playbookId: this.playbookSelect.value as PlaybookId,
      });
    });

    this.cameraSelect.addEventListener('change', () => {
      this.updateCustomSettings({ gameplayCamera: this.cameraSelect.value as ExperienceCameraMode });
    });
    this.cinematicsSelect.addEventListener('change', () => {
      this.updateCustomSettings({ cinematics: this.cinematicsSelect.value as CinematicsSetting });
    });
    this.crowdVisualsInput.addEventListener('change', () => {
      this.updateCustomSettings({ crowdVisualsEnabled: this.crowdVisualsInput.checked });
    });
    this.crowdDensitySelect.addEventListener('change', () => {
      this.updateCustomSettings({ crowdDensity: this.crowdDensitySelect.value as CrowdDensity });
    });
    this.crowdReactionsInput.addEventListener('change', () => {
      this.updateCustomSettings({ crowdReactionsEnabled: this.crowdReactionsInput.checked });
    });
    this.audioEnabledInput.addEventListener('change', () => {
      this.updateCustomSettings({ audioEnabled: this.audioEnabledInput.checked });
    });
    this.crowdAudioInput.addEventListener('change', () => {
      this.updateCustomSettings({ crowdAudioEnabled: this.crowdAudioInput.checked });
    });
    this.announcerInput.addEventListener('change', () => {
      this.updateCustomSettings({ announcerEnabled: this.announcerInput.checked });
    });
    this.captionsInput.addEventListener('change', () => {
      this.updateCustomSettings({ captionsEnabled: this.captionsInput.checked });
    });
  }

  private updateCustomSettings(patch: Partial<GameExperienceSettings>): void {
    this.updateSettings({
      ...this.settings,
      ...patch,
      preset: 'custom',
    });
  }

  private updateSettings(settings: GameExperienceSettings): void {
    this.settings = normalizeGameExperienceSettings(settings);
    this.syncControls();
    this.onSettingsChange?.(this.getSettings());
  }

  private syncControls(): void {
    this.presetSelect.value = this.settings.preset;
    this.playbookSelect.value = this.settings.playbookId;
    this.cameraSelect.value = this.settings.gameplayCamera;
    this.cinematicsSelect.value = this.settings.cinematics;
    this.crowdVisualsInput.checked = this.settings.crowdVisualsEnabled;
    this.crowdDensitySelect.value = this.settings.crowdDensity;
    this.crowdReactionsInput.checked = this.settings.crowdReactionsEnabled;
    this.audioEnabledInput.checked = this.settings.audioEnabled;
    this.crowdAudioInput.checked = this.settings.crowdAudioEnabled;
    this.announcerInput.checked = this.settings.announcerEnabled;
    this.captionsInput.checked = this.settings.captionsEnabled;

    const customEnabled = this.settings.preset === 'custom';
    for (const control of this.customControls) {
      if (control === this.presetSelect || control === this.playbookSelect) {
        control.removeAttribute('disabled');
      } else {
        control.toggleAttribute('disabled', !customEnabled);
      }
    }
    this.root.dataset.preset = this.settings.preset;
  }
}
