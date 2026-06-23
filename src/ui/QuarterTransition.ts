import type { MatchSnapshot } from '../match/MatchTypes';
import { createHalftimeStatsViewModel } from '../presentation/halftime/HalftimeStatsOverlay';
import { resolvePostgameStory } from '../presentation/postgame/PostgameStoryResolver';
import { getReadableTextColor } from '../teams/TeamThemeApplier';
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
  private readonly actions = document.createElement('div');
  private readonly continueButton = document.createElement('button');
  private readonly rematchButton = document.createElement('button');
  private readonly returnButton = document.createElement('button');

  constructor(options: QuarterTransitionOptions) {
    this.root.className = 'match-transition-panel quarter-transition-panel';
    this.root.setAttribute('role', 'dialog');
    this.story.className = 'match-transition-story';
    this.finalStats.className = 'match-transition-final-stats';
    this.actions.className = 'match-transition-actions';
    this.continueButton.type = 'button';
    this.continueButton.textContent = 'Continue';
    this.continueButton.addEventListener('click', options.onContinue);
    this.rematchButton.type = 'button';
    this.rematchButton.textContent = 'Rematch';
    this.rematchButton.addEventListener('click', options.onRematch);
    this.returnButton.type = 'button';
    this.returnButton.textContent = 'Return to Title';
    this.returnButton.addEventListener('click', options.onReturnToTitle);
    this.actions.append(this.continueButton, this.rematchButton, this.returnButton);
    this.root.append(
      this.title,
      this.summary,
      this.story,
      this.finalStats,
      this.drives,
      this.actions,
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

    const isGameOver = phase === 'gameOver';
    this.root.classList.toggle('match-transition-panel-final', isGameOver);
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
    this.drives.hidden = isGameOver;
    this.continueButton.hidden = isGameOver;
    this.rematchButton.hidden = !isGameOver;
    this.returnButton.hidden = !isGameOver;
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
    const viewModel = createHalftimeStatsViewModel(match);
    this.story.hidden = false;
    this.story.textContent = story.caption;
    this.finalStats.hidden = false;
    this.finalStats.replaceChildren(
      createFinalTeamRow(viewModel, match),
      createFinalStatsGrid(viewModel),
      createFinalLeaders(viewModel),
    );
  }

  dispose(): void {
    this.root.remove();
  }
}

function createFinalTeamRow(
  viewModel: ReturnType<typeof createHalftimeStatsViewModel>,
  match: MatchSnapshot,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'halftime-stats-teams';
  row.append(
    createFinalTeamPanel(viewModel.teams[0], match.userTeam.colors.secondary),
    createFinalTeamPanel(viewModel.teams[1], match.opponentTeam.colors.secondary),
  );
  return row;
}

function createFinalStatsGrid(
  viewModel: ReturnType<typeof createHalftimeStatsViewModel>,
): HTMLDivElement {
  const grid = document.createElement('div');
  grid.className = 'halftime-stats-grid';
  grid.replaceChildren(
    ...viewModel.rows.map((row) => {
      const item = document.createElement('div');
      const user = document.createElement('span');
      const label = document.createElement('strong');
      const opponent = document.createElement('span');
      item.className = 'halftime-stat-row';
      user.textContent = row.user;
      label.textContent = row.label;
      opponent.textContent = row.opponent;
      item.append(user, label, opponent);
      return item;
    }),
  );
  return grid;
}

function createFinalLeaders(
  viewModel: ReturnType<typeof createHalftimeStatsViewModel>,
): HTMLDivElement {
  const leaders = document.createElement('div');
  leaders.className = 'halftime-stats-leaders';
  leaders.replaceChildren(
    ...viewModel.leaders.map((leader) => {
      const item = document.createElement('div');
      const label = document.createElement('span');
      const value = document.createElement('strong');
      const statText = document.createElement('em');
      item.className = `halftime-leader halftime-leader-${leader.team}`;
      label.textContent = leader.label;
      value.textContent = leader.value;
      statText.textContent = leader.statText;
      item.append(label, value, statText);
      return item;
    }),
  );
  return leaders;
}

function createFinalTeamPanel(
  team: ReturnType<typeof createHalftimeStatsViewModel>['teams'][number],
  secondaryColor: string,
): HTMLDivElement {
  const panel = document.createElement('div');
  const swatch = document.createElement('span');
  const name = document.createElement('strong');
  const score = document.createElement('span');
  panel.className = `halftime-team-panel halftime-team-panel-${team.team}`;
  panel.style.setProperty('--halftime-team-color', team.primaryColor);
  panel.style.setProperty('--halftime-team-secondary', secondaryColor);
  panel.style.setProperty('--halftime-team-text', getReadableTextColor(team.primaryColor));
  swatch.className = 'halftime-team-color-chip';
  swatch.setAttribute('aria-hidden', 'true');
  name.textContent = team.name;
  score.textContent = String(team.score);
  panel.append(swatch, name, score);
  return panel;
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
