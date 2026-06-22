import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import { listTeamProfiles } from '../teams/TeamRegistry';
import {
  resolveCustomizedTeamProfile,
  type TeamProfileSettings,
} from '../teams/TeamProfileStore';
import type { TeamSide } from '../teams/TeamProfile';
import type { UniformPalette, UniformVariant } from '../teams/UniformPalette';
import {
  getReadableTextColor,
} from '../teams/TeamThemeApplier';
import { createTeamHelmetBadge, syncTeamHelmetBadge } from './TeamHelmetBadge';

export interface TeamSelectionCardOptions {
  onTeamChange: (teamId: string) => void;
  onUniformChange: (uniform: UniformVariant) => void;
  settings: TeamProfileSettings;
  side: TeamSide;
  title: string;
}

export class TeamSelectionCard {
  readonly root = document.createElement('section');

  private readonly badge: SVGSVGElement;
  private readonly displayName = document.createElement('strong');
  private readonly identityPanel = document.createElement('div');
  private readonly previewHost = document.createElement('div');
  private readonly teamOptions = listTeamProfiles();
  private readonly teamSelect = document.createElement('select');
  private readonly uniformSelect = document.createElement('select');
  private readonly abbreviation = document.createElement('span');
  private readonly swatches = document.createElement('div');
  private readonly quarterback = document.createElement('p');
  private settings: TeamProfileSettings;

  constructor(private readonly options: TeamSelectionCardOptions) {
    this.settings = options.settings;
    this.badge = createTeamHelmetBadge(
      resolveCustomizedTeamProfile(this.getTeamId(), this.settings).homeUniform,
    );
    this.root.className = 'match-team-card';
    this.root.dataset.side = options.side;
    this.root.append(this.createContent(options.title));
    this.sync(options.settings);
  }

  getHelmetFallbackBadge(): SVGSVGElement {
    return this.badge;
  }

  getHelmetPreviewHost(): HTMLElement {
    return this.previewHost;
  }

  getUniformPalette(): UniformPalette {
    const profile = resolveCustomizedTeamProfile(this.getTeamId(), this.settings);
    return this.getUniform() === 'away' ? profile.awayUniform : profile.homeUniform;
  }

  sync(settings: TeamProfileSettings): void {
    this.settings = settings;
    const teamId = this.getTeamId();
    const profile = resolveCustomizedTeamProfile(teamId, this.settings);
    const uniformVariant = this.getUniform();
    const uniform = uniformVariant === 'away' ? profile.awayUniform : profile.homeUniform;
    const quarterback = getStartingQuarterback(teamId);

    this.teamSelect.value = teamId;
    this.uniformSelect.value = uniformVariant;
    this.displayName.textContent = profile.displayName;
    this.abbreviation.textContent = profile.abbreviation;
    this.identityPanel.style.setProperty('--team-panel-primary', profile.colors.primary);
    this.identityPanel.style.setProperty('--team-panel-secondary', profile.colors.secondary);
    this.abbreviation.style.setProperty('--team-abbreviation-bg', profile.colors.primary);
    this.abbreviation.style.setProperty('--team-abbreviation-fg', getReadableTextColor(profile.colors.primary));
    syncTeamHelmetBadge(this.badge, uniform);
    this.swatches.replaceChildren(
      createSwatch('Primary', profile.colors.primary),
      createSwatch('Secondary', profile.colors.secondary),
      createSwatch('Jersey', uniform.jersey),
      createSwatch('Helmet', uniform.helmetShell),
    );
    this.quarterback.textContent = quarterback
      ? `QB ${quarterback.displayName} #${quarterback.jerseyNumber}`
      : 'QB unavailable';
  }

  private createContent(titleText: string): HTMLElement {
    const fragment = document.createDocumentFragment();

    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = titleText;
    header.append(title);

    this.identityPanel.className = 'match-team-identity';
    this.displayName.className = 'match-team-display-name';
    this.abbreviation.className = 'match-team-abbreviation';
    this.identityPanel.append(this.displayName, this.abbreviation);
    this.previewHost.className = 'team-helmet-preview';
    this.previewHost.dataset.preview = 'fallback';
    this.previewHost.setAttribute('role', 'img');
    this.previewHost.setAttribute('aria-label', `${titleText} helmet preview`);
    this.previewHost.append(this.badge);

    const teamLabel = document.createElement('label');
    teamLabel.className = 'match-setup-control';
    const teamLabelText = document.createElement('span');
    teamLabelText.textContent = 'Team';
    for (const profile of this.teamOptions) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.displayName;
      this.teamSelect.append(option);
    }
    this.teamSelect.addEventListener('change', () => {
      this.options.onTeamChange(this.teamSelect.value);
    });
    const teamStepper = this.createStepperControl(
      `${titleText} team`,
      () => this.cycleTeam(-1),
      this.teamSelect,
      () => this.cycleTeam(1),
    );
    teamLabel.append(teamLabelText, teamStepper);

    const uniformLabel = document.createElement('label');
    uniformLabel.className = 'match-setup-control';
    const uniformLabelText = document.createElement('span');
    uniformLabelText.textContent = 'Uniform';
    for (const [value, label] of [
      ['home', 'Home'],
      ['away', 'Away'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.uniformSelect.append(option);
    }
    this.uniformSelect.addEventListener('change', () => {
      this.options.onUniformChange(this.uniformSelect.value as UniformVariant);
    });
    const uniformStepper = this.createStepperControl(
      `${titleText} uniform`,
      () => this.cycleUniform(-1),
      this.uniformSelect,
      () => this.cycleUniform(1),
    );
    uniformLabel.append(uniformLabelText, uniformStepper);

    const controls = document.createElement('div');
    controls.className = 'match-team-controls';
    controls.append(teamLabel, uniformLabel);

    this.swatches.className = 'match-team-swatches';
    this.quarterback.className = 'match-team-quarterback';

    fragment.append(header, this.identityPanel, this.previewHost, controls, this.swatches, this.quarterback);
    const wrapper = document.createElement('div');
    wrapper.append(fragment);
    return wrapper;
  }

  private getTeamId(): string {
    return this.options.side === 'user'
      ? this.settings.userTeamId
      : this.settings.opponentTeamId;
  }

  private getUniform(): UniformVariant {
    return this.options.side === 'user'
      ? this.settings.userUniform
      : this.settings.opponentUniform;
  }

  private createStepperControl(
    label: string,
    onPrevious: () => void,
    control: HTMLSelectElement,
    onNext: () => void,
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'match-setup-stepper';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'match-setup-stepper-button';
    previous.textContent = '<';
    previous.setAttribute('aria-label', `Previous ${label}`);
    previous.addEventListener('click', onPrevious);

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'match-setup-stepper-button';
    next.textContent = '>';
    next.setAttribute('aria-label', `Next ${label}`);
    next.addEventListener('click', onNext);

    wrapper.append(previous, control, next);
    return wrapper;
  }

  private cycleTeam(delta: -1 | 1): void {
    const currentIndex = this.teamOptions.findIndex((profile) => profile.id === this.teamSelect.value);
    const nextIndex = wrapIndex(currentIndex + delta, this.teamOptions.length);
    const nextTeam = this.teamOptions[nextIndex];
    if (!nextTeam) {
      return;
    }

    this.options.onTeamChange(nextTeam.id);
  }

  private cycleUniform(delta: -1 | 1): void {
    const uniforms: UniformVariant[] = ['home', 'away'];
    const currentIndex = uniforms.indexOf(this.uniformSelect.value as UniformVariant);
    this.options.onUniformChange(uniforms[wrapIndex(currentIndex + delta, uniforms.length)]);
  }
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function createSwatch(label: string, color: string): HTMLElement {
  const swatch = document.createElement('span');
  swatch.className = 'match-team-swatch';
  swatch.style.background = color;
  swatch.title = `${label}: ${color}`;
  swatch.setAttribute('aria-label', `${label} ${color}`);
  return swatch;
}

function getStartingQuarterback(teamId: string) {
  const roster = getTeamRosterOrDefault(teamId);
  const quarterbackId = roster.offensiveStarterIds
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .find((player) => player?.footballPosition === 'QB')?.id;

  return quarterbackId
    ? roster.players.find((player) => player.id === quarterbackId) ?? null
    : null;
}
