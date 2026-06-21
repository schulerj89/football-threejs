import type { GameplaySnapshot } from '../playState';
import type { MatchSnapshot } from '../match/MatchTypes';

export interface MatchScorebugOptions {
  onPunt: () => void;
}

export class MatchScorebug {
  readonly root = document.createElement('div');

  private readonly teams = document.createElement('div');
  private readonly clock = document.createElement('div');
  private readonly context = document.createElement('div');
  private readonly puntButton = document.createElement('button');

  constructor(options: MatchScorebugOptions) {
    this.root.className = 'match-scorebug';
    this.teams.className = 'match-scorebug-teams';
    this.clock.className = 'match-scorebug-clock';
    this.context.className = 'match-scorebug-context';
    this.puntButton.className = 'match-punt-button';
    this.puntButton.type = 'button';
    this.puntButton.textContent = 'Punt';
    this.puntButton.addEventListener('click', options.onPunt);
    this.root.append(this.teams, this.clock, this.context, this.puntButton);
    document.body.append(this.root);
  }

  sync(match: MatchSnapshot | null, gameplay: GameplaySnapshot | null, visible: boolean): void {
    this.root.hidden = !visible || !match || !gameplay;
    if (!match || !gameplay || this.root.hidden) {
      return;
    }

    this.teams.textContent = `${match.userTeam.abbreviation} ${match.userScore}  |  ${match.opponentTeam.abbreviation} ${match.opponentScore}`;
    this.clock.textContent = `Q${match.quarter} ${formatClock(match.clock.remainingSeconds)}`;
    this.context.textContent = `${formatPossession(match.possession)} | ${formatDown(gameplay.drive.currentDown)} & ${formatDistance(
      gameplay.drive.yardsToFirstDown,
    )} | ${formatBallLocation(gameplay.drive.lineOfScrimmage.z)}`;
    this.puntButton.disabled = !(match.canPunt && gameplay.playState === 'preSnap');
  }

  dispose(): void {
    this.root.remove();
  }
}

export function formatMatchClock(seconds: number): string {
  return formatClock(seconds);
}

export function formatBallLocation(z: number): string {
  const yardsFromOwnGoal = Math.max(0, Math.min(100, Math.round(z + 50)));
  if (yardsFromOwnGoal === 50) {
    return '50';
  }

  if (yardsFromOwnGoal < 50) {
    return `OWN ${yardsFromOwnGoal}`;
  }

  return `OPP ${100 - yardsFromOwnGoal}`;
}

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clamped / 60);
  const remainingSeconds = clamped % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatPossession(possession: MatchSnapshot['possession']): string {
  return possession === 'user' ? 'BALL USER' : 'BALL OPP';
}

function formatDown(down: number): string {
  if (down === 1) {
    return '1st';
  }
  if (down === 2) {
    return '2nd';
  }
  if (down === 3) {
    return '3rd';
  }
  return '4th';
}

function formatDistance(distance: number): string {
  return distance <= 0 ? 'GOAL' : Math.max(1, Math.round(distance)).toString();
}
