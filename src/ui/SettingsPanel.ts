import {
  BROADCAST_EXPERIENCE_SETTINGS,
  PERFORMANCE_EXPERIENCE_SETTINGS,
  normalizeGameExperienceSettings,
  type ExperienceCameraMode,
  type ExperiencePreset,
  type GameExperienceSettings,
} from '../config/GameExperienceSettings';
import type { CinematicsSetting } from '../camera/PresentationCameraDirector';
import type {
  ExhibitionGameMode,
  MatchDifficulty,
} from '../match/MatchTypes';
import type { CrowdDensity } from '../presentation/CrowdPresentationController';
import type { QualityMode } from '../performance/QualityProfile';
import { getPlaybookOptions } from '../playbook';
import type { PlaybookId } from '../roster';
import { TeamCustomizationPanel } from './TeamCustomizationPanel';
import { RosterPreviewPanel } from './RosterPreviewPanel';

export interface SettingsPanelOptions {
  initialSettings: GameExperienceSettings;
  onSettingsChange?: (settings: GameExperienceSettings) => void;
  showGameMode?: boolean;
  showTeamCustomization?: boolean;
}

export class SettingsPanel {
  readonly root = document.createElement('section');

  private settings: GameExperienceSettings;
  private readonly onSettingsChange?: (settings: GameExperienceSettings) => void;
  private readonly showGameMode: boolean;
  private readonly showTeamCustomization: boolean;
  private readonly teamCustomizationPanel: TeamCustomizationPanel | null;
  private readonly rosterPreviewPanel: RosterPreviewPanel | null;
  private readonly presetSelect = document.createElement('select');
  private readonly gameModeSelect = document.createElement('select');
  private readonly playbookSelect = document.createElement('select');
  private readonly quarterLengthSelect = document.createElement('select');
  private readonly difficultySelect = document.createElement('select');
  private readonly qualityModeSelect = document.createElement('select');
  private readonly debugToolsInput = document.createElement('input');
  private readonly cameraSelect = document.createElement('select');
  private readonly cameraDescription = document.createElement('p');
  private readonly cinematicsSelect = document.createElement('select');
  private readonly crowdVisualsInput = document.createElement('input');
  private readonly stadiumInput = document.createElement('input');
  private readonly crowdDensitySelect = document.createElement('select');
  private readonly crowdReactionsInput = document.createElement('input');
  private readonly audioEnabledInput = document.createElement('input');
  private readonly mutedInput = document.createElement('input');
  private readonly masterVolumeInput = document.createElement('input');
  private readonly crowdAudioInput = document.createElement('input');
  private readonly crowdVolumeInput = document.createElement('input');
  private readonly announcerInput = document.createElement('input');
  private readonly announcerVolumeInput = document.createElement('input');
  private readonly captionsInput = document.createElement('input');
  private readonly routeArtInput = document.createElement('input');
  private readonly controlledPlayerLabelInput = document.createElement('input');
  private readonly selectedReceiverLabelInput = document.createElement('input');
  private readonly playerMotionInput = document.createElement('input');
  private readonly officialsInput = document.createElement('input');
  private readonly officialsDebugLabelsInput = document.createElement('input');
  private readonly customControls: HTMLElement[] = [];

  constructor(options: SettingsPanelOptions) {
    this.settings = normalizeGameExperienceSettings(options.initialSettings);
    this.onSettingsChange = options.onSettingsChange;
    this.showGameMode = options.showGameMode ?? true;
    this.showTeamCustomization = options.showTeamCustomization ?? true;
    this.teamCustomizationPanel = this.showTeamCustomization
      ? new TeamCustomizationPanel({
          initialSettings: this.settings.teamProfiles,
          onSettingsChange: (teamProfiles) => {
            this.updateSettings({
              ...this.settings,
              teamProfiles,
            });
          },
        })
      : null;
    this.rosterPreviewPanel = this.showTeamCustomization
      ? new RosterPreviewPanel(this.settings)
      : null;
    this.root.className = 'game-setup-screen settings-panel';
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
      this.createSelectRow('Quality mode', this.qualityModeSelect, [
        ['adaptive60', 'Adaptive 60 FPS'],
        ['lockedBroadcast', 'Broadcast Quality Locked'],
        ['lockedPerformance', 'Performance Quality Locked'],
      ]),
      this.createCheckboxRow('Debug tools', this.debugToolsInput, false),
    );

    if (this.showGameMode) {
      primary.append(
        this.createSelectRow('Game mode', this.gameModeSelect, [
          ['exhibition', 'Exhibition - Offense Only'],
          ['scoreAttack', 'Development Score Attack'],
        ]),
        this.createSelectRow('Quarter length', this.quarterLengthSelect, [
          ['60', '1 minute'],
          ['180', '3 minutes'],
          ['300', '5 minutes'],
          ['600', '10 minutes'],
        ]),
        this.createSelectRow('Difficulty', this.difficultySelect, [
          ['rookie', 'Rookie'],
          ['pro', 'Pro'],
          ['allPro', 'All-Pro'],
        ]),
        this.createSelectRow(
          'Regression playbook',
          this.playbookSelect,
          getPlaybookOptions().map((option) => [option.id, option.displayName]),
        ),
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
    const cameraRow = this.createSelectRow('Gameplay camera', this.cameraSelect, [
      ['offense', 'Offense'],
      ['tactical', 'Tactical'],
      ['cinematic', 'Cinematic'],
    ]);
    this.cameraDescription.className = 'settings-note';
    custom.append(
      customTitle,
      cameraRow,
      this.cameraDescription,
      this.createSelectRow('Cinematics', this.cinematicsSelect, [
        ['off', 'Off'],
        ['brief', 'Brief'],
        ['full', 'Full'],
      ]),
      this.createCheckboxRow('Crowd visuals', this.crowdVisualsInput),
      this.createCheckboxRow('Stadium', this.stadiumInput),
      this.createSelectRow('Crowd density', this.crowdDensitySelect, [
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
      ]),
      this.createCheckboxRow('Crowd reactions', this.crowdReactionsInput),
      this.createCheckboxRow('Master audio', this.audioEnabledInput),
      this.createCheckboxRow('Muted', this.mutedInput),
      this.createRangeRow('Master volume', this.masterVolumeInput),
      this.createCheckboxRow('Crowd audio', this.crowdAudioInput),
      this.createRangeRow('Crowd volume', this.crowdVolumeInput),
      this.createCheckboxRow('Announcer', this.announcerInput),
      this.createRangeRow('Announcer volume', this.announcerVolumeInput),
      this.createCheckboxRow('Captions', this.captionsInput),
      this.createCheckboxRow('Route art', this.routeArtInput),
      this.createCheckboxRow('Controlled player label', this.controlledPlayerLabelInput),
      this.createCheckboxRow('Selected receiver label', this.selectedReceiverLabelInput),
      this.createCheckboxRow('Player motion', this.playerMotionInput),
      this.createCheckboxRow('Officials', this.officialsInput),
      this.createCheckboxRow('Officials debug labels', this.officialsDebugLabelsInput),
    );

    content.append(primary, custom);
    if (this.teamCustomizationPanel) {
      const teamWrapper = document.createElement('div');
      teamWrapper.className = 'game-setup-team';
      teamWrapper.append(this.teamCustomizationPanel.root);
      if (this.rosterPreviewPanel) {
        teamWrapper.append(this.rosterPreviewPanel.root);
      }
      content.append(teamWrapper);
    }
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

  private createCheckboxRow(
    labelText: string,
    input: HTMLInputElement,
    customControl = true,
  ): HTMLElement {
    const label = document.createElement('label');
    label.className = 'settings-row settings-row-checkbox';
    input.type = 'checkbox';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, input);
    if (customControl) {
      this.customControls.push(input);
    }
    return label;
  }

  private createRangeRow(labelText: string, input: HTMLInputElement): HTMLElement {
    const label = document.createElement('label');
    label.className = 'settings-row settings-row-range';
    const span = document.createElement('span');
    span.textContent = labelText;
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    label.append(span, input);
    this.customControls.push(input);
    return label;
  }

  private installHandlers(): void {
    this.presetSelect.addEventListener('change', () => {
      const preset = this.presetSelect.value as ExperiencePreset;
      const playbookId = this.settings.playbookId;
      const debugToolsEnabled = this.settings.debugToolsEnabled;
      const gameMode = this.settings.gameMode;
      const matchDifficulty = this.settings.matchDifficulty;
      const quarterLengthSeconds = this.settings.quarterLengthSeconds;
      const teamProfiles = this.settings.teamProfiles;
      const next =
        preset === 'broadcast'
          ? {
              ...BROADCAST_EXPERIENCE_SETTINGS,
              debugToolsEnabled,
              gameMode,
              matchDifficulty,
              playbookId,
              quarterLengthSeconds,
              teamProfiles,
            }
          : preset === 'performance'
            ? {
                ...PERFORMANCE_EXPERIENCE_SETTINGS,
                debugToolsEnabled,
                gameMode,
                matchDifficulty,
                playbookId,
                quarterLengthSeconds,
                teamProfiles,
              }
            : { ...this.settings, preset: 'custom' as const };
      this.updateSettings(next);
    });

    this.gameModeSelect.addEventListener('change', () => {
      const gameMode = this.gameModeSelect.value as ExhibitionGameMode;
      this.updateSettings({
        ...this.settings,
        gameMode,
        playbookId: gameMode === 'exhibition' ? '11v11' : this.settings.playbookId,
      });
    });
    this.playbookSelect.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        playbookId: this.playbookSelect.value as PlaybookId,
      });
    });
    this.quarterLengthSelect.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        quarterLengthSeconds: Number(this.quarterLengthSelect.value),
      });
    });
    this.difficultySelect.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        matchDifficulty: this.difficultySelect.value as MatchDifficulty,
      });
    });
    this.qualityModeSelect.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        qualityMode: this.qualityModeSelect.value as QualityMode,
      });
    });
    this.debugToolsInput.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        debugToolsEnabled: this.debugToolsInput.checked,
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
    this.stadiumInput.addEventListener('change', () => {
      this.updateCustomSettings({ stadiumEnabled: this.stadiumInput.checked });
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
    this.mutedInput.addEventListener('change', () => {
      this.updateCustomSettings({ muted: this.mutedInput.checked });
    });
    this.masterVolumeInput.addEventListener('input', () => {
      this.updateCustomSettings({ masterVolume: Number(this.masterVolumeInput.value) });
    });
    this.crowdAudioInput.addEventListener('change', () => {
      this.updateCustomSettings({ crowdAudioEnabled: this.crowdAudioInput.checked });
    });
    this.crowdVolumeInput.addEventListener('input', () => {
      this.updateCustomSettings({ crowdVolume: Number(this.crowdVolumeInput.value) });
    });
    this.announcerInput.addEventListener('change', () => {
      this.updateCustomSettings({ announcerEnabled: this.announcerInput.checked });
    });
    this.announcerVolumeInput.addEventListener('input', () => {
      this.updateCustomSettings({ announcerVolume: Number(this.announcerVolumeInput.value) });
    });
    this.captionsInput.addEventListener('change', () => {
      this.updateCustomSettings({ captionsEnabled: this.captionsInput.checked });
    });
    this.routeArtInput.addEventListener('change', () => {
      this.updateCustomSettings({ routeArtEnabled: this.routeArtInput.checked });
    });
    this.controlledPlayerLabelInput.addEventListener('change', () => {
      this.updateCustomSettings({
        controlledPlayerLabelEnabled: this.controlledPlayerLabelInput.checked,
      });
    });
    this.selectedReceiverLabelInput.addEventListener('change', () => {
      this.updateCustomSettings({
        selectedReceiverLabelEnabled: this.selectedReceiverLabelInput.checked,
      });
    });
    this.playerMotionInput.addEventListener('change', () => {
      this.updateCustomSettings({ playerMotionEnabled: this.playerMotionInput.checked });
    });
    this.officialsInput.addEventListener('change', () => {
      this.updateCustomSettings({ officialsEnabled: this.officialsInput.checked });
    });
    this.officialsDebugLabelsInput.addEventListener('change', () => {
      this.updateCustomSettings({
        officialsDebugLabels: this.officialsDebugLabelsInput.checked,
      });
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
    this.gameModeSelect.value = this.settings.gameMode;
    this.playbookSelect.value = this.settings.playbookId;
    this.quarterLengthSelect.value = getQuarterLengthOptionValue(this.settings.quarterLengthSeconds);
    this.difficultySelect.value = this.settings.matchDifficulty;
    this.qualityModeSelect.value = this.settings.qualityMode;
    this.debugToolsInput.checked = this.settings.debugToolsEnabled;
    this.cameraSelect.value = this.settings.gameplayCamera;
    this.cameraDescription.textContent = getGameplayCameraDescription(this.settings.gameplayCamera);
    this.cinematicsSelect.value = this.settings.cinematics;
    this.crowdVisualsInput.checked = this.settings.crowdVisualsEnabled;
    this.stadiumInput.checked = this.settings.stadiumEnabled;
    this.crowdDensitySelect.value = this.settings.crowdDensity;
    this.crowdReactionsInput.checked = this.settings.crowdReactionsEnabled;
    this.audioEnabledInput.checked = this.settings.audioEnabled;
    this.mutedInput.checked = this.settings.muted;
    this.masterVolumeInput.value = String(this.settings.masterVolume);
    this.crowdAudioInput.checked = this.settings.crowdAudioEnabled;
    this.crowdVolumeInput.value = String(this.settings.crowdVolume);
    this.announcerInput.checked = this.settings.announcerEnabled;
    this.announcerVolumeInput.value = String(this.settings.announcerVolume);
    this.captionsInput.checked = this.settings.captionsEnabled;
    this.routeArtInput.checked = this.settings.routeArtEnabled;
    this.controlledPlayerLabelInput.checked = this.settings.controlledPlayerLabelEnabled;
    this.selectedReceiverLabelInput.checked = this.settings.selectedReceiverLabelEnabled;
    this.playerMotionInput.checked = this.settings.playerMotionEnabled;
    this.officialsDebugLabelsInput.checked = this.settings.officialsDebugLabels;
    this.officialsInput.checked = this.settings.officialsEnabled;
    this.teamCustomizationPanel?.setSettings(this.settings.teamProfiles);
    this.rosterPreviewPanel?.setSettings(this.settings);

    const customEnabled = this.settings.preset === 'custom';
    for (const control of this.customControls) {
      if (
        control === this.presetSelect ||
        control === this.gameModeSelect ||
        control === this.playbookSelect ||
        control === this.quarterLengthSelect ||
        control === this.difficultySelect ||
        control === this.qualityModeSelect
      ) {
        control.removeAttribute('disabled');
      } else {
        control.toggleAttribute('disabled', !customEnabled);
      }
    }
    this.playbookSelect.toggleAttribute('disabled', this.settings.gameMode === 'exhibition');
    this.root.dataset.preset = this.settings.preset;
    this.root.dataset.gameMode = this.settings.gameMode;
  }
}

function getQuarterLengthOptionValue(value: number): string {
  if ([60, 180, 300, 600].includes(value)) {
    return String(value);
  }

  return '180';
}

function getGameplayCameraDescription(mode: ExperienceCameraMode): string {
  if (mode === 'tactical') {
    return 'Fixed tactical overview; cinematic camera cuts disabled.';
  }

  if (mode === 'cinematic') {
    return 'Broadcast gameplay and full presentation camera language.';
  }

  return 'Behind-offense gameplay camera; post-score presentation optional.';
}
