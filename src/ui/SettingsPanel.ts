import {
  BROADCAST_EXPERIENCE_SETTINGS,
  PERFORMANCE_EXPERIENCE_SETTINGS,
  normalizeGameExperienceSettings,
  type GameExperienceSettings,
} from '../config/GameExperienceSettings';
import { createAccessibilitySettingsSection } from './settings/AccessibilitySettingsSection';
import { createAudioSettingsSection } from './settings/AudioSettingsSection';
import { createPresentationSettingsSection } from './settings/PresentationSettingsSection';
import { createRangeSetting } from './settings/RangeSetting';
import { createSelectSetting } from './settings/SelectSetting';
import { createSettingsNavigation } from './settings/SettingsNavigation';
import { createToggleSetting } from './settings/ToggleSetting';
import {
  SETTINGS_CATEGORY_LABELS,
  type SettingsCategoryId,
  type SettingsPanelContext,
  type SettingsPanelVariant,
  type SettingsSectionContext,
} from './settings/SettingsTypes';
import type { CinematicsSetting } from '../camera/PresentationCameraDirector';
import type { ExperienceCameraMode, ExperiencePreset } from '../config/GameExperienceSettings';

export interface SettingsPanelOptions {
  initialSettings: GameExperienceSettings;
  context?: SettingsPanelContext;
  onSettingsChange?: (settings: GameExperienceSettings) => void;
  variant?: SettingsPanelVariant;
}

export const SETTINGS_DONE_EVENT = 'football-settings-done';
export const SETTINGS_OPEN_FULL_EVENT = 'football-settings-open-full';

export class SettingsPanel {
  readonly root = document.createElement('section');

  private activeCategory: SettingsCategoryId = 'presentation';
  private context: SettingsPanelContext;
  private settings: GameExperienceSettings;
  private variant: SettingsPanelVariant;
  private readonly onSettingsChange?: (settings: GameExperienceSettings) => void;

  constructor(options: SettingsPanelOptions) {
    this.context = options.context ?? 'menu';
    this.settings = normalizeGameExperienceSettings(options.initialSettings);
    this.variant = options.variant ?? 'full';
    this.onSettingsChange = options.onSettingsChange;
    this.root.className = 'settings-panel';
    this.root.setAttribute('aria-label', 'Settings');
    this.render();
  }

  getSettings(): GameExperienceSettings {
    return {
      ...this.settings,
      teamProfiles: this.settings.teamProfiles,
    };
  }

  setContext(context: SettingsPanelContext): void {
    this.context = context;
    this.render();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settings = normalizeGameExperienceSettings(settings);
    this.render();
  }

  setVariant(variant: SettingsPanelVariant): void {
    this.variant = variant;
    if (variant === 'pause') {
      this.activeCategory = 'audio';
    }
    this.render();
  }

  private render(): void {
    this.root.dataset.variant = this.variant;
    this.root.dataset.context = this.context;
    this.root.replaceChildren(
      this.variant === 'pause' ? this.createPauseContent() : this.createFullContent(),
    );
  }

  private createFullContent(): HTMLElement {
    const shell = document.createElement('div');
    shell.className = 'settings-shell';
    shell.append(this.createHeader('Settings', 'Game preferences and presentation options.'));

    const body = document.createElement('div');
    body.className = 'settings-body';
    body.append(
      createSettingsNavigation({
        activeCategory: this.activeCategory,
        onSelect: (category) => {
          this.activeCategory = category;
          this.render();
        },
      }),
      this.createActiveSection(),
    );

    shell.append(body, this.createFooter(true));
    return shell;
  }

  private createPauseContent(): HTMLElement {
    const shell = document.createElement('div');
    shell.className = 'settings-shell settings-shell-quick';
    shell.append(this.createHeader('Quick Settings', 'Safe changes for the current play state.'));

    const content = document.createElement('div');
    content.className = 'settings-quick-grid';
    content.append(
      createRangeSetting({
        description: 'Overall game audio level.',
        label: 'Master volume',
        onChange: (value) => this.patch({ masterVolume: value }),
        value: this.settings.masterVolume,
      }),
      createRangeSetting({
        description: 'Menu and transition music level.',
        label: 'Music volume',
        onChange: (value) => this.patch({ musicVolume: value }),
        value: this.settings.musicVolume,
      }),
      createToggleSetting({
        checked: this.settings.announcerEnabled,
        description: 'Play broadcast commentary when available.',
        label: 'Announcer',
        onChange: (checked) => this.patch({ announcerEnabled: checked }),
      }),
      createToggleSetting({
        checked: this.settings.captionsEnabled,
        description: 'Show captions for presentation speech.',
        label: 'Captions',
        onChange: (checked) => this.patch({ captionsEnabled: checked }),
      }),
      createSelectSetting<ExperienceCameraMode>({
        description: 'Choose the normal camera used during plays.',
        label: 'Gameplay camera',
        onChange: (value) => this.patch({ gameplayCamera: value }, true),
        options: [
          { label: 'Offense', value: 'offense' },
          { label: 'Tactical', value: 'tactical' },
          { label: 'Cinematic', value: 'cinematic' },
        ],
        value: this.settings.gameplayCamera,
      }),
      createSelectSetting<CinematicsSetting>({
        description: 'Control post-play camera presentation.',
        label: 'Cinematics',
        onChange: (value) => this.patch({ cinematics: value }, true),
        options: [
          { label: 'Off', value: 'off' },
          { label: 'Brief', value: 'brief' },
          { label: 'Full', value: 'full' },
        ],
        value: this.settings.cinematics,
      }),
      createToggleSetting({
        checked: this.settings.routeArtEnabled,
        description: 'Show route and blocking guides before the snap.',
        label: 'Route art',
        onChange: (checked) => this.patch({ routeArtEnabled: checked }, true),
      }),
    );

    shell.append(content, this.createFooter(false));
    return shell;
  }

  private createHeader(titleText: string, description: string): HTMLElement {
    const header = document.createElement('header');
    header.className = 'settings-header';
    const title = document.createElement('h2');
    title.textContent = titleText;
    const copy = document.createElement('p');
    copy.textContent = description;
    header.append(title, copy);
    return header;
  }

  private createActiveSection(): HTMLElement {
    const context = this.createSectionContext();
    if (this.activeCategory === 'presentation') {
      return createPresentationSettingsSection(context);
    }
    if (this.activeCategory === 'audio') {
      return createAudioSettingsSection(context);
    }
    if (this.activeCategory === 'accessibility') {
      return createAccessibilitySettingsSection(context);
    }
    return createPresentationSettingsSection(context);
  }

  private createSectionContext(): SettingsSectionContext {
    return {
      context: this.context,
      onPatch: (patch, custom) => this.patch(patch, custom),
      onPresetChange: (preset) => this.applyPreset(preset),
      settings: this.settings,
    };
  }

  private createFooter(full: boolean): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = 'settings-footer';
    if (!full) {
      const fullSettings = document.createElement('button');
      fullSettings.type = 'button';
      fullSettings.className = 'settings-secondary-action';
      fullSettings.textContent = 'Full Settings';
      fullSettings.addEventListener('click', () => {
        this.root.dispatchEvent(new CustomEvent(SETTINGS_OPEN_FULL_EVENT, { bubbles: true }));
      });
      footer.append(fullSettings);
    } else {
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'settings-secondary-action';
      restore.textContent = 'Restore Defaults';
      restore.addEventListener('click', () => this.restoreDefaults());
      footer.append(restore);
    }

    const categoryLabel = this.variant === 'full'
      ? SETTINGS_CATEGORY_LABELS[this.activeCategory]
      : 'Quick Settings';
    const hint = document.createElement('span');
    hint.className = 'settings-footer-hint';
    hint.textContent = categoryLabel;

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'settings-done-action';
    done.textContent = 'Done';
    done.addEventListener('click', () => {
      this.root.dispatchEvent(new CustomEvent(SETTINGS_DONE_EVENT, { bubbles: true }));
    });
    footer.append(hint, done);
    return footer;
  }

  private applyPreset(preset: ExperiencePreset): void {
    if (preset === 'custom') {
      this.update({ ...this.settings, preset: 'custom' });
      return;
    }

    const defaults = preset === 'performance'
      ? PERFORMANCE_EXPERIENCE_SETTINGS
      : BROADCAST_EXPERIENCE_SETTINGS;
    this.update(normalizeGameExperienceSettings({
      ...defaults,
      gameMode: this.settings.gameMode,
      matchDifficulty: this.settings.matchDifficulty,
      playbookId: this.settings.playbookId,
      quarterLengthSeconds: this.settings.quarterLengthSeconds,
      teamProfiles: this.settings.teamProfiles,
    }));
  }

  private patch(patch: Partial<GameExperienceSettings>, custom = false): void {
    this.update({
      ...this.settings,
      ...patch,
      preset: custom ? 'custom' : this.settings.preset,
    });
  }

  private restoreDefaults(): void {
    if (!globalThis.confirm?.('Restore default game, presentation, audio, and accessibility settings? Team colors and selected teams will be preserved.')) {
      return;
    }

    this.update(normalizeGameExperienceSettings({
      ...BROADCAST_EXPERIENCE_SETTINGS,
      teamProfiles: this.settings.teamProfiles,
    }));
  }

  private update(settings: GameExperienceSettings): void {
    this.settings = normalizeGameExperienceSettings(settings);
    this.onSettingsChange?.(this.getSettings());
    this.render();
  }
}
