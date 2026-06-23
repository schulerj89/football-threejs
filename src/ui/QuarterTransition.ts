import type { MatchSnapshot } from '../match/MatchTypes';
import { resolvePostgameStory } from '../presentation/postgame/PostgameStoryResolver';
import { formatMatchClock } from './MatchScorebug';

export interface QuarterTransitionOptions {
  onContinue: () => void;
  onRematch: () => void;
  onReturnToTitle: () => void;
}

export class QuarterTransitionPanel {
  readonly root = document.createElement('div');

  private readonly title = document.createElement('h2');
  private readonly summary = document.createElement('p');
  private readonly story = document.createElement('p');
  private readonly finalStats = document.createElement('div');
  private readonly drives = document.createElement('ul');
  private readonly continueButton = document.createElement('button');
  private readonly rematchButton = document.createElement('button');
  private readonly returnButton = document.createElement('button');

  constructor(options: QuarterTransitionOptions) {
    this.root.className = 'match-transition-panel quarter-transition-panel';
    this.root.setAttribute('role', 'dialog');
    this.story.className = 'match-transition-story';
    this.finalStats.className = 'match-transition-final-stats';
    this.continueButton.type = 'button';
    this.continueButton.textContent = 'Continue';
    this.continueButton.addEventListener('click', options.onContinue);
    this.rematchButton.type = 'button';
    this.rematchButton.textContent = 'Rematch';
    this.rematchButton.addEventListener('click', options.onRematch);
    this.returnButton.type = 'button';
    this.returnButton.textContent = 'Return to Title';
    this.returnButton.addEventListener('click', options.onReturnToTitle);
    this.root.append(
      this.title,
      this.summary,
      this.story,
      this.finalStats,
      this.drives,
      this.continueButton,
      this.rematchButton,
      this.returnButton,
    );
    document.body.append(this.root);
  }

  sync(match: MatchSnapshot | null, visible: boolean): void {
    const phase = match?.phase ?? 'pregame';
    this.root.hidden =
      !visible || !match || !['quarterBreak', 'halftime', 'gameOver'].includes(phase);
    if (this.root.hidden || !match) {
      return;
    }

    this.title.textContent = getTransitionTitle(match);
    this.summary.textContent = `${match.userTeam.abbreviation} ${match.userScore} - ${match.opponentTeam.abbreviation} ${match.opponentScore} | Q${match.quarter} ${formatMatchClock(
      match.clock.remainingSeconds,
    )}`;
    this.syncPostgameStory(match);
    const completedDrives = match.driveSummaries.filter((drive) => drive.result !== 'endOfQuarter');
    this.drives.replaceChildren(
      ...completedDrives.slice(-8).map((drive) => {
        const item = document.createElement('li');
        item.textContent = `${drive.possession === 'user' ? match.userTeam.abbreviation : match.opponentTeam.abbreviation}: ${drive.result}, ${drive.yards} yards`;
        return item;
      }),
    );
    this.continueButton.hidden = phase === 'gameOver';
    this.rematchButton.hidden = phase !== 'gameOver';
    this.returnButton.hidden = phase !== 'gameOver';
  }

  private syncPostgameStory(match: MatchSnapshot): void {
    if (match.phase !== 'gameOver') {
      this.story.hidden = true;
      this.story.textContent = '';
      this.finalStats.hidden = true;
      this.finalStats.replaceChildren();
      return;
    }

    const story = resolvePostgameStory(match);
    this.story.hidden = false;
    this.story.textContent = story.caption;
    this.finalStats.hidden = false;
    this.finalStats.replaceChildren(
      createFinalStatChip('Total Yards', match.stats.teams.user.totalYards, match.stats.teams.opponent.totalYards),
      createFinalStatChip('Passing', match.stats.teams.user.passingYards, match.stats.teams.opponent.passingYards),
      createFinalStatChip('Rushing', match.stats.teams.user.rushingYards, match.stats.teams.opponent.rushingYards),
      createFinalStatChip('Turnovers', match.stats.teams.user.turnovers, match.stats.teams.opponent.turnovers),
    );
  }

  dispose(): void {
    this.root.remove();
  }
}

function createFinalStatChip(label: string, user: number, opponent: number): HTMLDivElement {
  const chip = document.createElement('div');
  const userValue = document.createElement('span');
  const labelElement = document.createElement('strong');
  const opponentValue = document.createElement('span');
  chip.className = 'match-transition-final-stat';
  userValue.textContent = String(user);
  labelElement.textContent = label;
  opponentValue.textContent = String(opponent);
  chip.append(userValue, labelElement, opponentValue);
  return chip;
}

function getTransitionTitle(match: MatchSnapshot): string {
  if (match.phase === 'gameOver') {
    if (match.winner === 'tie') {
      return 'Final: Tie Game';
    }
    const winner = match.winner === 'user' ? match.userTeam.shortName : match.opponentTeam.shortName;
    return `Final: ${winner} Win`;
  }

  if (match.phase === 'halftime') {
    const receiver = match.secondHalfPossession === 'user'
      ? match.userTeam.shortName
      : match.opponentTeam.shortName;
    return `Halftime | ${receiver} receive after the break`;
  }

  return `End of Q${match.quarter}`;
}
