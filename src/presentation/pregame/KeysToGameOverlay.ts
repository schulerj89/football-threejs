import { getReadableTextColor, type TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import { createTeamHelmetBadge, syncTeamHelmetBadge } from '../../ui/TeamHelmetBadge';
import type { MatchSnapshot } from '../../match/MatchTypes';
import type { KeyToGame } from './KeysToGameResolver';
import type { PregamePresentationSnapshot } from './PregamePresentationTypes';

export interface KeysToGameOverlayUpdateOptions {
  keys: readonly KeyToGame[];
  matchSnapshot: MatchSnapshot | null;
  pregameSnapshot: PregamePresentationSnapshot;
  stadiumName?: string | null;
  teamTheme: TeamPresentationTheme;
}

export interface KeysToGameOverlaySnapshot {
  keyCount: number;
  mode: 'hidden' | 'keys' | 'matchup';
  visible: boolean;
}

export class KeysToGameOverlay {
  readonly root = document.createElement('div');

  private readonly matchupCard = document.createElement('section');
  private readonly keysCard = document.createElement('section');
  private readonly userHelmet = createTeamHelmetBadge({
    faceguard: '#d7dcdf',
    helmetShell: '#365fd8',
    jersey: '#365fd8',
    number: '#f7fbf8',
    pants: '#f7fbf8',
    shoe: '#101512',
    shoulder: '#24408a',
    socks: '#f7fbf8',
    stripe: '#f7fbf8',
  });
  private readonly opponentHelmet = createTeamHelmetBadge({
    faceguard: '#d7dcdf',
    helmetShell: '#b92f32',
    jersey: '#b92f32',
    number: '#f7fbf8',
    pants: '#f7fbf8',
    shoe: '#101512',
    shoulder: '#7f1f22',
    socks: '#f7fbf8',
    stripe: '#f7fbf8',
  });
  private snapshot: KeysToGameOverlaySnapshot = {
    keyCount: 0,
    mode: 'hidden',
    visible: false,
  };

  constructor() {
    this.root.className = 'pregame-broadcast-overlay';
    this.root.hidden = true;
    this.matchupCard.className = 'pregame-matchup-card';
    this.keysCard.className = 'pregame-keys-card';
    this.root.append(this.matchupCard, this.keysCard);
    document.body.append(this.root);
  }

  update(options: KeysToGameOverlayUpdateOptions): void {
    const mode = options.pregameSnapshot.introOverlay;
    if (options.pregameSnapshot.phase !== 'running' || mode === 'hidden') {
      this.hide('hidden');
      return;
    }

    this.root.hidden = false;
    this.matchupCard.hidden = mode !== 'matchup';
    this.keysCard.hidden = mode !== 'keys';
    this.root.dataset.mode = mode;

    if (mode === 'matchup') {
      this.syncMatchupCard(options);
    } else {
      this.syncKeysCard(options);
    }

    this.snapshot = {
      keyCount: options.keys.length,
      mode,
      visible: true,
    };
  }

  hide(mode: KeysToGameOverlaySnapshot['mode'] = 'hidden'): void {
    this.root.hidden = true;
    this.matchupCard.hidden = true;
    this.keysCard.hidden = true;
    this.snapshot = {
      keyCount: this.snapshot.keyCount,
      mode,
      visible: false,
    };
  }

  getSnapshot(): KeysToGameOverlaySnapshot {
    return { ...this.snapshot };
  }

  dispose(): void {
    this.root.remove();
  }

  private syncMatchupCard(options: KeysToGameOverlayUpdateOptions): void {
    const user = options.matchSnapshot?.userTeam ?? options.teamTheme.offense.profile;
    const opponent = options.matchSnapshot?.opponentTeam ?? options.teamTheme.defense.profile;
    syncTeamHelmetBadge(this.userHelmet, options.teamTheme.offense.uniform);
    syncTeamHelmetBadge(this.opponentHelmet, options.teamTheme.defense.uniform);
    this.matchupCard.style.setProperty('--pregame-user-accent', options.teamTheme.offense.profile.colors.primary);
    this.matchupCard.style.setProperty('--pregame-user-text', getReadableTextColor(options.teamTheme.offense.profile.colors.primary));
    this.matchupCard.style.setProperty('--pregame-opponent-accent', options.teamTheme.defense.profile.colors.primary);
    this.matchupCard.style.setProperty('--pregame-opponent-text', getReadableTextColor(options.teamTheme.defense.profile.colors.primary));
    this.matchupCard.replaceChildren(
      createTeamPanel(this.userHelmet, user.displayName, user.abbreviation, 'user'),
      createVsElement(),
      createTeamPanel(this.opponentHelmet, opponent.displayName, opponent.abbreviation, 'opponent'),
      createMetaRow(`Weather: ${options.pregameSnapshot.weatherCondition.toUpperCase()}`, options.stadiumName ?? 'Football JS Stadium'),
    );
  }

  private syncKeysCard(options: KeysToGameOverlayUpdateOptions): void {
    this.keysCard.style.setProperty('--pregame-keys-accent', options.teamTheme.offense.profile.colors.accent);
    const title = document.createElement('h2');
    title.textContent = 'Keys to the Game';
    const list = document.createElement('ol');
    for (const key of options.keys.slice(0, 3)) {
      const item = document.createElement('li');
      item.textContent = key.text;
      item.dataset.source = key.source;
      list.append(item);
    }
    this.keysCard.replaceChildren(title, list);
  }
}

function createTeamPanel(
  helmet: SVGSVGElement,
  name: string,
  abbreviation: string,
  side: 'opponent' | 'user',
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `pregame-matchup-team pregame-matchup-team-${side}`;
  const helmetWrap = document.createElement('div');
  helmetWrap.className = 'pregame-matchup-helmet';
  helmetWrap.append(helmet);
  const text = document.createElement('div');
  const teamName = document.createElement('strong');
  teamName.textContent = name;
  const teamAbbreviation = document.createElement('span');
  teamAbbreviation.textContent = abbreviation;
  text.append(teamName, teamAbbreviation);
  panel.append(helmetWrap, text);
  return panel;
}

function createVsElement(): HTMLElement {
  const element = document.createElement('div');
  element.className = 'pregame-matchup-vs';
  element.textContent = 'VS';
  return element;
}

function createMetaRow(weather: string, stadium: string): HTMLElement {
  const row = document.createElement('p');
  row.className = 'pregame-matchup-meta';
  row.textContent = `${weather}  |  ${stadium}`;
  return row;
}
