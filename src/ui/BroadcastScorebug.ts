import type { GameplaySnapshot } from '../playState';
import type { MatchSnapshot } from '../match/MatchTypes';
import {
  BROADCAST_SCOREBUG_LAYOUT,
  applyScorebugSafeZone,
} from './ScorebugLayout';
import {
  createBroadcastScorebugViewModel,
  type BroadcastScorebugViewModel,
} from './ScorebugViewModel';
import { createTeamLogoBadge, type TeamLogoBadge } from './TeamLogoBadge';

export interface BroadcastScorebugOptions {
  onPunt: () => void;
}

export class BroadcastScorebug {
  readonly root = document.createElement('div');

  private readonly shell = document.createElement('img');
  private readonly userLogo: TeamLogoBadge;
  private readonly opponentLogo: TeamLogoBadge;
  private readonly userAbbreviation = document.createElement('span');
  private readonly opponentAbbreviation = document.createElement('span');
  private readonly userScore = document.createElement('span');
  private readonly opponentScore = document.createElement('span');
  private readonly quarter = document.createElement('span');
  private readonly gameClock = document.createElement('span');
  private readonly possession = document.createElement('span');
  private readonly downDistance = document.createElement('span');
  private readonly ballLocation = document.createElement('span');
  private readonly liveRegion = document.createElement('div');
  private readonly puntButton = document.createElement('button');
  private previousQuarterText: string | null = null;
  private previousScoreKey: string | null = null;
  private warnedShellFailure = false;

  constructor(options: BroadcastScorebugOptions) {
    this.root.className = 'match-scorebug broadcast-scorebug';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Game score');
    this.root.dataset.contextMode = 'normal';
    this.root.hidden = true;

    this.shell.className = 'broadcast-scorebug-shell';
    this.shell.alt = '';
    this.shell.decoding = 'async';
    this.shell.src = BROADCAST_SCOREBUG_LAYOUT.shellUrl;
    this.shell.addEventListener('error', () => this.handleShellError());

    this.userLogo = createTeamLogoBadge(createFallbackScorebugTeamProfile('user'), 'scorebug-team-logo broadcast-scorebug-logo');
    this.opponentLogo = createTeamLogoBadge(createFallbackScorebugTeamProfile('opponent'), 'scorebug-team-logo broadcast-scorebug-logo');
    this.userAbbreviation.className = 'broadcast-scorebug-abbreviation broadcast-scorebug-user-abbreviation';
    this.opponentAbbreviation.className = 'broadcast-scorebug-abbreviation broadcast-scorebug-opponent-abbreviation';
    this.userScore.className = 'broadcast-scorebug-score broadcast-scorebug-user-score';
    this.opponentScore.className = 'broadcast-scorebug-score broadcast-scorebug-opponent-score';
    this.quarter.className = 'broadcast-scorebug-center broadcast-scorebug-quarter';
    this.gameClock.className = 'broadcast-scorebug-center broadcast-scorebug-game-clock';
    this.possession.className = 'broadcast-scorebug-strip broadcast-scorebug-possession';
    this.downDistance.className = 'broadcast-scorebug-strip broadcast-scorebug-down-distance';
    this.ballLocation.className = 'broadcast-scorebug-strip broadcast-scorebug-ball-location';
    this.liveRegion.className = 'broadcast-scorebug-live-region';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');

    this.puntButton.className = 'match-punt-button broadcast-scorebug-punt';
    this.puntButton.type = 'button';
    this.puntButton.textContent = 'Punt';
    this.puntButton.addEventListener('click', options.onPunt);

    this.applyZone(this.userLogo.root, 'userLogo');
    this.applyZone(this.userAbbreviation, 'userAbbreviation');
    this.applyZone(this.userScore, 'userScore');
    this.applyZone(this.opponentScore, 'opponentScore');
    this.applyZone(this.opponentLogo.root, 'opponentLogo');
    this.applyZone(this.opponentAbbreviation, 'opponentAbbreviation');
    this.applyZone(this.quarter, 'quarter');
    this.applyZone(this.gameClock, 'gameClock');
    this.applyZone(this.possession, 'possession');
    this.applyZone(this.downDistance, 'downDistance');
    this.applyZone(this.ballLocation, 'ballLocation');

    this.root.append(
      this.shell,
      this.userLogo.root,
      this.userAbbreviation,
      this.userScore,
      this.opponentScore,
      this.opponentLogo.root,
      this.opponentAbbreviation,
      this.quarter,
      this.gameClock,
      this.possession,
      this.downDistance,
      this.ballLocation,
      this.puntButton,
      this.liveRegion,
    );
    document.body.append(this.root);
  }

  sync(match: MatchSnapshot | null, gameplay: GameplaySnapshot | null, visible: boolean): void {
    this.root.hidden = !visible || !match || !gameplay;
    if (!match || !gameplay || this.root.hidden) {
      return;
    }

    this.syncViewModel(createBroadcastScorebugViewModel(match, gameplay));
    this.puntButton.disabled = !(match.canPunt && gameplay.playState === 'preSnap');
  }

  dispose(): void {
    this.root.remove();
  }

  private syncViewModel(viewModel: BroadcastScorebugViewModel): void {
    this.root.setAttribute('aria-label', viewModel.ariaLabel);
    this.root.dataset.contextMode = viewModel.contextMode;
    this.root.style.setProperty('--scorebug-user-accent', viewModel.user.accentColor);
    this.root.style.setProperty('--scorebug-opponent-accent', viewModel.opponent.accentColor);
    this.root.dataset.possession = viewModel.possession;

    this.userLogo.sync(viewModel.user.profile);
    this.opponentLogo.sync(viewModel.opponent.profile);
    syncText(this.userAbbreviation, viewModel.user.abbreviation);
    syncText(this.opponentAbbreviation, viewModel.opponent.abbreviation);
    syncText(this.userScore, String(viewModel.user.score));
    syncText(this.opponentScore, String(viewModel.opponent.score));
    syncText(this.quarter, viewModel.quarterText);
    syncText(this.gameClock, viewModel.clockText);
    syncText(this.possession, viewModel.possessionText);
    syncText(this.downDistance, viewModel.downDistanceText);
    syncText(this.ballLocation, viewModel.ballLocationText);

    const scoreKey = `${viewModel.user.score}:${viewModel.opponent.score}`;
    if (this.previousScoreKey !== null && this.previousScoreKey !== scoreKey) {
      pulseElement(this.root, 'broadcast-scorebug-score-changed');
      this.liveRegion.textContent =
        `${viewModel.user.abbreviation} ${viewModel.user.score}, ${viewModel.opponent.abbreviation} ${viewModel.opponent.score}`;
    }
    this.previousScoreKey = scoreKey;

    if (this.previousQuarterText !== null && this.previousQuarterText !== viewModel.quarterText) {
      pulseElement(this.quarter, 'broadcast-scorebug-quarter-changed');
      this.liveRegion.textContent = `${viewModel.quarterText}, ${viewModel.clockText}`;
    }
    this.previousQuarterText = viewModel.quarterText;
  }

  private applyZone(element: HTMLElement, id: Parameters<typeof applyScorebugSafeZone>[1]): void {
    element.classList.add('broadcast-scorebug-zone');
    element.dataset.zone = id;
    applyScorebugSafeZone(element, id);
  }

  private handleShellError(): void {
    this.root.classList.add('broadcast-scorebug-shell-fallback');
    this.shell.hidden = true;
    if (!this.warnedShellFailure && import.meta.env.DEV) {
      this.warnedShellFailure = true;
      console.warn(`Football JS scorebug shell failed to load: ${BROADCAST_SCOREBUG_LAYOUT.shellUrl}`);
    }
  }
}

function syncText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function pulseElement(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function createFallbackScorebugTeamProfile(side: 'opponent' | 'user') {
  const abbreviation = side === 'user' ? 'USR' : 'OPP';
  const color = side === 'user' ? '#2f66d8' : '#b83737';
  return {
    abbreviation,
    awayUniform: {
      faceguard: '#f2f4f6',
      helmetShell: color,
      jersey: '#f2f4f6',
      number: color,
      pants: color,
      shoe: '#1c2228',
      shoulder: '#f2f4f6',
      socks: color,
      stripe: '#f2f4f6',
    },
    colors: {
      accent: '#f2f4f6',
      primary: color,
      secondary: '#f2f4f6',
    },
    crowdAccentColor: color,
    displayName: abbreviation,
    endZoneColor: color,
    homeUniform: {
      faceguard: '#f2f4f6',
      helmetShell: color,
      jersey: color,
      number: '#f2f4f6',
      pants: '#f2f4f6',
      shoe: '#1c2228',
      shoulder: color,
      socks: color,
      stripe: '#f2f4f6',
    },
    id: `scorebug-${side}`,
    identity: 'Scorebug placeholder',
    logoAssetId: `scorebug-${side}-logo`,
    logoUrl: '',
    rosterId: `scorebug-${side}`,
    shortName: abbreviation,
  };
}
