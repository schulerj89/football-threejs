import {
  getDriveSummaryTitle,
} from '../match/DriveSummary';
import type { MatchSnapshot } from '../match/MatchTypes';
import { formatPossessionFieldPosition } from '../match/FieldPositionModel';
import { formatMatchClock } from './MatchScorebug';

export interface OpponentDriveSummaryOptions {
  onContinue: () => void;
}

export class OpponentDriveSummaryPanel {
  readonly root = document.createElement('div');

  private readonly title = document.createElement('h2');
  private readonly description = document.createElement('p');
  private readonly details = document.createElement('p');
  private readonly continueButton = document.createElement('button');

  constructor(options: OpponentDriveSummaryOptions) {
    this.root.className = 'match-transition-panel opponent-drive-summary';
    this.root.setAttribute('role', 'dialog');
    this.title.textContent = 'Opponent Drive';
    this.continueButton.type = 'button';
    this.continueButton.textContent = 'Continue';
    this.continueButton.addEventListener('click', options.onContinue);
    this.root.append(this.title, this.description, this.details, this.continueButton);
    document.body.append(this.root);
  }

  sync(match: MatchSnapshot | null, visible: boolean): void {
    const summary = match?.previousDriveSummary ?? null;
    this.root.hidden = !visible || !match || match.phase !== 'opponentDriveSimulation' || !summary;
    if (this.root.hidden || !match || !summary) {
      return;
    }

    this.title.textContent = `Opponent Drive: ${getDriveSummaryTitle(summary)}`;
    this.description.textContent = summary.description;
    const transitionText = summary.possessionTransition
      ? ` | Drive ended at ${formatPossessionFieldPosition(summary.endingFieldPosition)}; ${formatTeam(
          summary.possessionTransition.toTeam,
          match,
        )} ball at ${formatPossessionFieldPosition(summary.possessionTransition.nextOffenseStartingPosition)}`
      : ` | Drive ended at ${formatPossessionFieldPosition(summary.endingFieldPosition)}`;
    this.details.textContent = `${summary.plays} plays, ${summary.yards} yards, ${formatMatchClock(
      summary.elapsedSeconds,
    )} elapsed${transitionText} | ${match.userTeam.abbreviation} ${match.userScore} - ${match.opponentTeam.abbreviation} ${match.opponentScore}`;
  }

  dispose(): void {
    this.root.remove();
  }
}

function formatTeam(team: MatchSnapshot['possession'], match: MatchSnapshot): string {
  return team === 'user' ? match.userTeam.shortName : match.opponentTeam.shortName;
}
