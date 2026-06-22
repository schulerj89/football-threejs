import {
  listTeamProfiles,
} from '../teams/TeamRegistry';
import {
  cloneTeamProfileSettings,
  normalizeTeamProfileSettings,
  resetTeamColorOverrides,
  resolveCustomizedTeamProfile,
  updateTeamColorOverride,
  type TeamProfileSettings,
} from '../teams/TeamProfileStore';
import {
  resolveTeamPresentationTheme,
} from '../teams/TeamThemeApplier';
import type { TeamColorOverrides, TeamSide } from '../teams/TeamProfile';
import type { UniformVariant } from '../teams/UniformPalette';

export interface TeamCustomizationPanelOptions {
  initialSettings: TeamProfileSettings;
  onSettingsChange?: (settings: TeamProfileSettings) => void;
  showTeamSelectors?: boolean;
}

type CustomColorKey = keyof TeamColorOverrides;

const COLOR_CONTROLS: Array<{ key: CustomColorKey; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'helmetShell', label: 'Helmet' },
  { key: 'pants', label: 'Pants' },
  { key: 'faceguard', label: 'Faceguard' },
];

const COLOR_SWATCHES = [
  '#2f66d8',
  '#b83737',
  '#285945',
  '#1f6f7a',
  '#d8b35f',
  '#f2f4f6',
  '#24282e',
  '#1c2228',
];

export class TeamCustomizationPanel {
  readonly root = document.createElement('section');

  private settings: TeamProfileSettings;
  private readonly onSettingsChange?: (settings: TeamProfileSettings) => void;
  private readonly showTeamSelectors: boolean;

  constructor(options: TeamCustomizationPanelOptions) {
    this.settings = normalizeTeamProfileSettings(options.initialSettings);
    this.onSettingsChange = options.onSettingsChange;
    this.showTeamSelectors = options.showTeamSelectors ?? true;
    this.root.className = 'team-customization-panel';
    this.render();
  }

  getSettings(): TeamProfileSettings {
    return cloneTeamProfileSettings(this.settings);
  }

  setSettings(settings: TeamProfileSettings): void {
    this.settings = normalizeTeamProfileSettings(settings);
    this.render();
  }

  private render(): void {
    const title = document.createElement('h3');
    title.textContent = 'Teams';

    const grid = document.createElement('div');
    grid.className = 'team-customization-grid';
    grid.append(
      this.createTeamSection('user', 'User Team'),
      this.createTeamSection('opponent', 'Opponent'),
    );

    const warning = document.createElement('p');
    warning.className = 'team-similarity-warning';
    const theme = resolveTeamPresentationTheme(this.settings);
    warning.hidden = theme.similarityWarning === null;
    warning.textContent = theme.similarityWarning ?? '';

    this.root.replaceChildren(title, grid, warning);
  }

  private createTeamSection(side: TeamSide, titleText: string): HTMLElement {
    const section = document.createElement('section');
    section.className = 'team-customization-card';

    const title = document.createElement('h4');
    title.textContent = titleText;

    const teamSelect = document.createElement('select');
    teamSelect.className = 'team-select';
    for (const profile of listTeamProfiles()) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.displayName;
      teamSelect.append(option);
    }
    teamSelect.value = this.getTeamId(side);
    teamSelect.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        [side === 'user' ? 'userTeamId' : 'opponentTeamId']: teamSelect.value,
      });
    });

    const uniformSelect = document.createElement('select');
    uniformSelect.className = 'uniform-select';
    for (const [value, text] of [
      ['home', 'Home uniform'],
      ['away', 'Away uniform'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      uniformSelect.append(option);
    }
    uniformSelect.value = this.getUniformVariant(side);
    uniformSelect.addEventListener('change', () => {
      this.updateSettings({
        ...this.settings,
        [side === 'user' ? 'userUniform' : 'opponentUniform']:
          uniformSelect.value as UniformVariant,
      });
    });

    const profile = resolveCustomizedTeamProfile(this.getTeamId(side), this.settings);
    const activeUniform = this.getUniformVariant(side) === 'away'
      ? profile.awayUniform
      : profile.homeUniform;
    const colors = {
      faceguard: activeUniform.faceguard,
      helmetShell: activeUniform.helmetShell,
      pants: activeUniform.pants,
      primary: profile.colors.primary,
      secondary: profile.colors.secondary,
    };
    const colorGrid = document.createElement('div');
    colorGrid.className = 'team-color-grid';
    for (const control of COLOR_CONTROLS) {
      colorGrid.append(this.createColorControl(side, control.label, control.key, colors[control.key]));
    }

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'team-reset-button';
    resetButton.textContent = 'Reset to Team Defaults';
    resetButton.addEventListener('click', () => {
      this.updateSettings(resetTeamColorOverrides(this.settings, this.getTeamId(side)));
    });

    if (this.showTeamSelectors) {
      const selectors = document.createElement('div');
      selectors.className = 'team-selector-grid';
      selectors.append(
        this.createLabeledControl('Team', teamSelect),
        this.createLabeledControl('Uniform', uniformSelect),
      );
      section.append(title, selectors, colorGrid, resetButton);
    } else {
      const teamSummary = document.createElement('p');
      teamSummary.className = 'team-customization-summary';
      teamSummary.textContent = `${profile.displayName} ${this.getUniformVariant(side)} uniform`;
      section.append(title, teamSummary, colorGrid, resetButton);
    }

    return section;
  }

  private createColorControl(
    side: TeamSide,
    labelText: string,
    key: CustomColorKey,
    value: string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'team-color-row';

    const label = document.createElement('span');
    label.textContent = labelText;

    const swatches = document.createElement('div');
    swatches.className = 'team-color-swatches';
    for (const swatchColor of COLOR_SWATCHES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'team-color-swatch';
      button.style.background = swatchColor;
      button.setAttribute('aria-label', `${labelText} ${swatchColor}`);
      button.addEventListener('click', () => {
        this.updateTeamColor(side, key, swatchColor);
      });
      swatches.append(button);
    }

    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.addEventListener('input', () => {
      this.updateTeamColor(side, key, input.value);
    });

    row.append(label, swatches, input);
    return row;
  }

  private createLabeledControl(labelText: string, control: HTMLElement): HTMLElement {
    const label = document.createElement('label');
    label.className = 'team-selector-row';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, control);
    return label;
  }

  private updateTeamColor(side: TeamSide, key: CustomColorKey, color: string): void {
    this.updateSettings(
      updateTeamColorOverride(this.settings, this.getTeamId(side), { [key]: color }),
    );
  }

  private updateSettings(settings: TeamProfileSettings): void {
    this.settings = normalizeTeamProfileSettings(settings);
    this.render();
    this.onSettingsChange?.(this.getSettings());
  }

  private getTeamId(side: TeamSide): string {
    return side === 'user' ? this.settings.userTeamId : this.settings.opponentTeamId;
  }

  private getUniformVariant(side: TeamSide): UniformVariant {
    return side === 'user' ? this.settings.userUniform : this.settings.opponentUniform;
  }
}
