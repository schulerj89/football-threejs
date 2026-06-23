import type { MatchPossession, MatchSnapshot } from '../../match/MatchTypes';
import { getRosterPlayer } from '../../roster/TeamRoster';
import { getTeamRosterOrDefault } from '../../roster/RosterRegistry';
import { getReadableTextColor } from '../../teams/TeamThemeApplier';
import type {
  HalftimeLeaderView,
  HalftimeStatsViewModel,
  HalftimeStory,
  HalftimeTeamStatsView,
} from './HalftimePresentationTypes';

export interface HalftimeStatsOverlayOptions {
  onContinue: () => void;
}

export class HalftimeStatsOverlay {
  readonly root = document.createElement('section');

  private readonly title = document.createElement('div');
  private readonly story = document.createElement('p');
  private readonly teamRow = document.createElement('div');
  private readonly statGrid = document.createElement('div');
  private readonly leaders = document.createElement('div');
  private readonly continueButton = document.createElement('button');

  constructor(options: HalftimeStatsOverlayOptions) {
    this.root.className = 'halftime-stats-overlay';
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    this.title.className = 'halftime-stats-title';
    this.story.className = 'halftime-stats-story';
    this.teamRow.className = 'halftime-stats-teams';
    this.statGrid.className = 'halftime-stats-grid';
    this.leaders.className = 'halftime-stats-leaders';
    this.continueButton.type = 'button';
    this.continueButton.className = 'halftime-continue-button';
    this.continueButton.textContent = 'Continue';
    this.continueButton.addEventListener('click', options.onContinue);
    this.root.append(
      this.title,
      this.story,
      this.teamRow,
      this.statGrid,
      this.leaders,
      this.continueButton,
    );
    document.body.append(this.root);
  }

  sync(options: {
    canContinue: boolean;
    matchSnapshot: MatchSnapshot | null;
    story: HalftimeStory | null;
    visible: boolean;
  }): HalftimeStatsViewModel | null {
    this.root.hidden = !options.visible || !options.matchSnapshot;
    if (this.root.hidden || !options.matchSnapshot) {
      return null;
    }

    const viewModel = createHalftimeStatsViewModel(options.matchSnapshot);
    this.title.textContent = 'Halftime Report';
    this.story.textContent = formatStoryText(options.story, options.matchSnapshot);
    this.continueButton.disabled = !options.canContinue;
    this.renderTeams(viewModel, options.matchSnapshot);
    this.renderRows(viewModel);
    this.renderLeaders(viewModel);
    return viewModel;
  }

  hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }

  private renderTeams(viewModel: HalftimeStatsViewModel, match: MatchSnapshot): void {
    const [user, opponent] = viewModel.teams;
    const userPanel = createTeamPanel(user, match.userTeam.colors.secondary);
    const opponentPanel = createTeamPanel(opponent, match.opponentTeam.colors.secondary);
    this.teamRow.replaceChildren(userPanel, opponentPanel);
  }

  private renderRows(viewModel: HalftimeStatsViewModel): void {
    this.statGrid.replaceChildren(
      ...viewModel.rows.map((row) => {
        const item = document.createElement('div');
        item.className = 'halftime-stat-row';
        item.innerHTML = `<span>${row.user}</span><strong>${row.label}</strong><span>${row.opponent}</span>`;
        return item;
      }),
    );
  }

  private renderLeaders(viewModel: HalftimeStatsViewModel): void {
    this.leaders.replaceChildren(
      ...viewModel.leaders.map((leader) => {
        const item = document.createElement('div');
        item.className = `halftime-leader halftime-leader-${leader.team}`;
        item.innerHTML = `<span>${leader.label}</span><strong>${leader.value}</strong><em>${leader.statText}</em>`;
        return item;
      }),
    );
  }
}

export function createHalftimeStatsViewModel(match: MatchSnapshot): HalftimeStatsViewModel {
  const user = createTeamStatsView(match, 'user');
  const opponent = createTeamStatsView(match, 'opponent');
  return {
    leaders: createLeaderViews(match),
    rows: [
      { key: 'score', label: 'Score', opponent: String(opponent.score), user: String(user.score) },
      { key: 'totalYards', label: 'Total Yards', opponent: String(opponent.totalYards), user: String(user.totalYards) },
      { key: 'passingYards', label: 'Passing', opponent: String(opponent.passingYards), user: String(user.passingYards) },
      { key: 'rushingYards', label: 'Rushing', opponent: String(opponent.rushingYards), user: String(user.rushingYards) },
      { key: 'firstDowns', label: 'First Downs', opponent: String(opponent.firstDowns), user: String(user.firstDowns) },
      { key: 'turnovers', label: 'Turnovers', opponent: String(opponent.turnovers), user: String(user.turnovers) },
      { key: 'timeOfPossession', label: 'Possession', opponent: formatSeconds(opponent.possessionSeconds), user: formatSeconds(user.possessionSeconds) },
      { key: 'thirdDown', label: 'Third Down', opponent: opponent.thirdDownText, user: user.thirdDownText },
    ],
    teams: [user, opponent],
  };
}

function createTeamStatsView(
  match: MatchSnapshot,
  team: MatchPossession,
): HalftimeTeamStatsView {
  const profile = team === 'user' ? match.userTeam : match.opponentTeam;
  const stats = match.stats.teams[team];
  return {
    firstDowns: stats.firstDowns,
    logoUrl: profile.logoUrl,
    name: profile.displayName,
    passingYards: stats.passingYards,
    possessionSeconds: match.stats.possessionSeconds[team],
    primaryColor: profile.colors.primary,
    rushingYards: stats.rushingYards,
    score: team === 'user' ? match.userScore : match.opponentScore,
    shortName: profile.abbreviation,
    team,
    thirdDownText: formatConversionRate(stats.thirdDownConversions, stats.thirdDownAttempts),
    totalYards: stats.totalYards,
    turnovers: stats.turnovers,
  };
}

function createLeaderViews(match: MatchSnapshot): HalftimeLeaderView[] {
  return [
    createLeader(match, 'Passer', 'passingYards', 'passing yards'),
    createLeader(match, 'Rusher', 'rushingYards', 'rushing yards'),
    createLeader(match, 'Receiver', 'receivingYards', 'receiving yards'),
  ].filter((leader): leader is HalftimeLeaderView => leader !== null);
}

function createLeader(
  match: MatchSnapshot,
  label: string,
  statKey: 'passingYards' | 'receivingYards' | 'rushingYards',
  statLabel: string,
): HalftimeLeaderView | null {
  let best: { id: string; team: MatchPossession; value: number } | null = null;
  for (const stats of Object.values(match.stats.players)) {
    const value = stats[statKey];
    if (value <= 0 || (best && value <= best.value)) {
      continue;
    }
    best = {
      id: stats.rosterPlayerId,
      team: stats.team,
      value,
    };
  }

  if (!best) {
    return null;
  }
  const profile = best.team === 'user' ? match.userTeam : match.opponentTeam;
  const roster = getTeamRosterOrDefault(profile.id);
  const player = getRosterPlayer(roster, best.id);
  const value = player ? `#${player.jerseyNumber} ${player.displayName}` : best.id;
  return {
    label,
    statText: `${best.value} ${statLabel}`,
    team: best.team,
    value,
  };
}

export function createHalftimeTeamPanel(team: HalftimeTeamStatsView, secondaryColor: string): HTMLDivElement {
  const panel = document.createElement('div');
  const logo = document.createElement('span');
  const image = document.createElement('img');
  const fallback = document.createElement('span');
  const name = document.createElement('strong');
  const score = document.createElement('span');
  panel.className = `halftime-team-panel halftime-team-panel-${team.team}`;
  panel.style.setProperty('--halftime-team-color', team.primaryColor);
  panel.style.setProperty('--halftime-team-secondary', secondaryColor);
  panel.style.setProperty('--halftime-team-text', getReadableTextColor(team.primaryColor));
  logo.className = 'halftime-team-logo';
  logo.setAttribute('aria-label', `${team.name} logo`);
  image.alt = '';
  image.decoding = 'async';
  fallback.className = 'team-logo-badge-fallback';
  fallback.textContent = team.shortName;
  image.addEventListener('error', () => {
    image.hidden = true;
  });
  image.addEventListener('load', () => {
    image.hidden = false;
  });
  if (team.logoUrl) {
    image.src = team.logoUrl;
  } else {
    image.hidden = true;
  }
  logo.append(image, fallback);
  name.textContent = team.name;
  score.className = 'halftime-team-score';
  score.textContent = String(team.score);
  panel.append(logo, name, score);
  return panel;
}

const createTeamPanel = createHalftimeTeamPanel;

function formatStoryText(story: HalftimeStory | null, match: MatchSnapshot): string {
  if (!story) {
    return 'The second half is next.';
  }
  const supportingTeam = story.supportingTeam === 'user'
    ? match.userTeam.shortName
    : story.supportingTeam === 'opponent'
      ? match.opponentTeam.shortName
      : 'Both teams';
  return `${supportingTeam} | ${story.category.replace(/([A-Z])/g, ' $1').toUpperCase()}`;
}

function formatConversionRate(made: number, attempted: number): string {
  if (attempted <= 0) {
    return '0/0';
  }
  return `${made}/${attempted} (${Math.round((made / attempted) * 100)}%)`;
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
