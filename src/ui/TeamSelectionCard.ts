import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import { listTeamProfiles } from '../teams/TeamRegistry';
import {
  resolveCustomizedTeamProfile,
  type TeamProfileSettings,
} from '../teams/TeamProfileStore';
import type { TeamSide } from '../teams/TeamProfile';
import type { UniformVariant } from '../teams/UniformPalette';
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

  sync(settings: TeamProfileSettings): void {
    this.settings = settings;
    const teamId = this.getTeamId();
    const profile = resolveCustomizedTeamProfile(teamId, this.settings);
    const uniformVariant = this.getUniform();
    const uniform = uniformVariant === 'away' ? profile.awayUniform : profile.homeUniform;
    const quarterback = getStartingQuarterback(teamId);

    this.teamSelect.value = teamId;
    this.uniformSelect.value = uniformVariant;
    this.abbreviation.textContent = profile.abbreviation;
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
    this.abbreviation.className = 'match-team-abbreviation';
    header.append(title, this.abbreviation);

    const teamLabel = document.createElement('label');
    teamLabel.className = 'match-setup-control';
    const teamLabelText = document.createElement('span');
    teamLabelText.textContent = 'Team';
    for (const profile of listTeamProfiles()) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.displayName;
      this.teamSelect.append(option);
    }
    this.teamSelect.addEventListener('change', () => {
      this.options.onTeamChange(this.teamSelect.value);
    });
    teamLabel.append(teamLabelText, this.teamSelect);

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
    uniformLabel.append(uniformLabelText, this.uniformSelect);

    const controls = document.createElement('div');
    controls.className = 'match-team-controls';
    controls.append(teamLabel, uniformLabel);

    this.swatches.className = 'match-team-swatches';
    this.quarterback.className = 'match-team-quarterback';

    fragment.append(header, this.badge, controls, this.swatches, this.quarterback);
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
