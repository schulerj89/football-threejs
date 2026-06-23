import type { MatchSnapshot } from '../match/MatchTypes';
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
  private readonly drives = document.createElement('ul');
  private readonly continueButton = document.createElement('button');
  private readonly rematchButton = document.createElement('button');
  private readonly returnButton = document.createElement('button');

  constructor(options: QuarterTransitionOptions) {
    this.root.className = 'match-transition-panel quarter-transition-panel';
    this.root.setAttribute('role', 'dialog');
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

  dispose(): void {
    this.root.remove();
  }
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
