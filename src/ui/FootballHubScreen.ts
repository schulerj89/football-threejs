import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import type { LeagueData } from '../league/LeagueTypes';
import { calculateOverallRating } from '../ratings/OverallRatingCalculator';
import { PLAYER_ATTRIBUTE_DEFINITIONS, type PlayerAttributeKey } from '../ratings/PlayerAttribute';
import { getPositionRatingProfile } from '../ratings/PositionRatingProfile';
import { calculateTeamRatings, type TeamRatings } from '../ratings/TeamRatingCalculator';
import type { RosterPlayer } from '../roster/RosterPlayer';
import type { TeamRoster } from '../roster/TeamRoster';
import type { TeamProfile } from '../teams/TeamProfile';
import {
  DEFAULT_TEAM_PROFILE_SETTINGS,
  normalizeTeamProfileSettings,
  resolveCustomizedTeamProfile,
  type TeamProfileSettings,
} from '../teams/TeamProfileStore';
import {
  getReadableTextColor,
  resolveTeamPresentationTheme,
} from '../teams/TeamThemeApplier';
import type { UniformPalette } from '../teams/UniformPalette';
import { SETTINGS_DONE_EVENT, SettingsPanel } from './SettingsPanel';
import { createTeamHelmetBadge, syncTeamHelmetBadge } from './TeamHelmetBadge';
import { createTeamLogoBadge, type TeamLogoBadge } from './TeamLogoBadge';
import { MatchSetupHelmetPreviewRenderer } from './MatchSetupHelmetPreview';

type HubSection = 'playNow' | 'teams' | 'rosters' | 'settings';
type RosterTab = 'offense' | 'defense' | 'specialists';
type RosterSort = 'number' | 'name' | 'overall' | 'position';

export interface FootballHubScreenOptions {
  getLeagueData: () => LeagueData | null;
  helmetPreview?: MatchSetupHelmetPreviewRenderer;
  initialSettings: GameExperienceSettings;
  onBack: () => void;
  onFirstGesture?: () => void;
  onPlayGame: (settings: GameExperienceSettings) => void;
  onSettingsChange: (settings: GameExperienceSettings) => void;
}

export class FootballHubScreen {
  readonly root = document.createElement('div');

  private readonly navButtons = new Map<HubSection, HTMLButtonElement>();
  private readonly sectionTitle = document.createElement('h2');
  private readonly sectionSubtitle = document.createElement('p');
  private readonly content = document.createElement('div');
  private readonly playNowView = document.createElement('section');
  private readonly teamsView = document.createElement('section');
  private readonly rostersView = document.createElement('section');
  private readonly settingsView = document.createElement('section');
  private readonly playNowUserHelmet = document.createElement('div');
  private readonly playNowOpponentHelmet = document.createElement('div');
  private readonly teamOverviewHelmet = document.createElement('div');
  private readonly playNowUserBadge = createTeamHelmetBadge(resolveCustomizedTeamProfile(
    DEFAULT_TEAM_PROFILE_SETTINGS.userTeamId,
    DEFAULT_TEAM_PROFILE_SETTINGS,
  ).homeUniform);
  private readonly playNowOpponentBadge = createTeamHelmetBadge(resolveCustomizedTeamProfile(
    DEFAULT_TEAM_PROFILE_SETTINGS.opponentTeamId,
    DEFAULT_TEAM_PROFILE_SETTINGS,
  ).awayUniform);
  private readonly teamOverviewBadge = createTeamHelmetBadge(resolveCustomizedTeamProfile(
    DEFAULT_TEAM_PROFILE_SETTINGS.userTeamId,
    DEFAULT_TEAM_PROFILE_SETTINGS,
  ).homeUniform);
  private readonly userLogo: TeamLogoBadge;
  private readonly opponentLogo: TeamLogoBadge;
  private readonly teamOverviewLogo: TeamLogoBadge;
  private readonly playNowSummary = document.createElement('div');
  private readonly teamList = document.createElement('div');
  private readonly teamOverview = document.createElement('article');
  private readonly rosterTeamSelect = document.createElement('select');
  private readonly rosterPositionFilter = document.createElement('select');
  private readonly rosterSortSelect = document.createElement('select');
  private readonly rosterTabs = new Map<RosterTab, HTMLButtonElement>();
  private readonly rosterTableBody = document.createElement('tbody');
  private readonly rosterDetail = document.createElement('aside');
  private readonly settingsPanel: SettingsPanel;
  private readonly helmetPreview: MatchSetupHelmetPreviewRenderer;
  private readonly ownsHelmetPreview: boolean;
  private activeSection: HubSection = 'playNow';
  private rosterTab: RosterTab = 'offense';
  private rosterSort: RosterSort = 'overall';
  private rosterPositionFilterValue = 'all';
  private selectedTeamId: string;
  private selectedRosterPlayerId: string | null = null;
  private settings: GameExperienceSettings;
  private firstGestureHandled = false;
  private visible = false;

  constructor(private readonly options: FootballHubScreenOptions) {
    this.settings = options.initialSettings;
    this.selectedTeamId = options.initialSettings.teamProfiles.userTeamId;
    const theme = resolveTeamPresentationTheme(options.initialSettings.teamProfiles);
    this.userLogo = createTeamLogoBadge(theme.offense.profile, 'hub-team-logo');
    this.opponentLogo = createTeamLogoBadge(theme.defense.profile, 'hub-team-logo');
    this.teamOverviewLogo = createTeamLogoBadge(theme.offense.profile, 'hub-team-logo');
    this.settingsPanel = new SettingsPanel({
      initialSettings: options.initialSettings,
      onSettingsChange: (settings) => {
        this.settings = settings;
        options.onSettingsChange(settings);
        this.sync();
      },
    });
    this.settingsPanel.root.addEventListener(SETTINGS_DONE_EVENT, () => this.setSection('playNow'));
    this.root.className = 'football-hub-screen';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'football-hub-heading');
    this.root.tabIndex = -1;
    this.root.append(this.createShell());
    this.helmetPreview = options.helmetPreview ?? new MatchSetupHelmetPreviewRenderer(this.root);
    this.ownsHelmetPreview = !options.helmetPreview;
    this.registerHelmetPreviews();
    this.root.addEventListener('pointerdown', () => this.handleFirstGesture(), { capture: true });
    this.root.addEventListener('keydown', (event) => this.handleKeyDown(event));
    document.body.append(this.root);
    this.sync();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settings = settings;
    this.selectedTeamId = normalizeTeamProfileSettings(settings.teamProfiles).userTeamId;
    this.settingsPanel.setSettings(settings);
    this.sync();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
    this.helmetPreview.setVisible(visible);
    if (visible) {
      this.sync();
      this.root.focus({ preventScroll: true });
    }
  }

  isVisible(): boolean {
    return this.visible && !this.root.hidden;
  }

  dispose(): void {
    if (this.ownsHelmetPreview) {
      this.helmetPreview.dispose();
    }
    this.settingsPanel.root.remove();
    this.root.remove();
  }

  private createShell(): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'football-hub-panel';

    const header = document.createElement('header');
    header.className = 'football-hub-header';
    const heading = document.createElement('h1');
    heading.id = 'football-hub-heading';
    heading.textContent = 'Football Hub';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'football-hub-back';
    back.textContent = 'Back';
    back.addEventListener('click', () => this.options.onBack());
    header.append(heading, back);

    const body = document.createElement('div');
    body.className = 'football-hub-body';
    const nav = document.createElement('nav');
    nav.className = 'football-hub-nav';
    nav.setAttribute('aria-label', 'Football hub sections');
    for (const [section, label] of [
      ['playNow', 'Play Now'],
      ['teams', 'Teams'],
      ['rosters', 'Rosters'],
      ['settings', 'Settings'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => this.setSection(section));
      this.navButtons.set(section, button);
      nav.append(button);
    }

    const main = document.createElement('main');
    main.className = 'football-hub-main';
    const sectionHeader = document.createElement('header');
    sectionHeader.className = 'football-hub-section-header';
    this.sectionSubtitle.className = 'football-hub-section-subtitle';
    sectionHeader.append(this.sectionTitle, this.sectionSubtitle);
    this.content.className = 'football-hub-content';
    this.createPlayNowView();
    this.createTeamsView();
    this.createRostersView();
    this.settingsView.className = 'football-hub-view football-hub-settings-view';
    this.settingsView.append(this.settingsPanel.root);
    this.content.append(this.playNowView, this.teamsView, this.rostersView, this.settingsView);
    main.append(sectionHeader, this.content);

    body.append(nav, main);
    panel.append(header, body);
    return panel;
  }

  private createPlayNowView(): void {
    this.playNowView.className = 'football-hub-view football-hub-playnow';
    const matchup = document.createElement('div');
    matchup.className = 'football-hub-matchup';
    matchup.append(
      this.createPlayTeamPanel('user'),
      this.createVsBlock(),
      this.createPlayTeamPanel('opponent'),
    );

    const actions = document.createElement('div');
    actions.className = 'football-hub-actions';
    const changeTeam = document.createElement('button');
    changeTeam.type = 'button';
    changeTeam.className = 'football-hub-secondary';
    changeTeam.textContent = 'Change Team';
    changeTeam.addEventListener('click', () => this.setSection('teams'));
    const playGame = document.createElement('button');
    playGame.type = 'button';
    playGame.className = 'football-hub-primary';
    playGame.textContent = 'Play Game';
    playGame.addEventListener('click', () => {
      this.handleFirstGesture();
      this.options.onPlayGame(this.settings);
    });
    actions.append(changeTeam, playGame);
    this.playNowView.append(matchup, this.playNowSummary, actions);
  }

  private createPlayTeamPanel(side: 'opponent' | 'user'): HTMLElement {
    const panel = document.createElement('article');
    panel.className = 'football-hub-play-team';
    panel.dataset.side = side;
    const logo = side === 'user' ? this.userLogo : this.opponentLogo;
    const helmet = side === 'user' ? this.playNowUserHelmet : this.playNowOpponentHelmet;
    const badge = side === 'user' ? this.playNowUserBadge : this.playNowOpponentBadge;
    helmet.className = 'football-hub-helmet-preview';
    helmet.dataset.preview = 'fallback';
    helmet.append(badge);
    const title = document.createElement('div');
    title.className = 'football-hub-play-team-title';
    title.dataset.role = side;
    const ratings = document.createElement('div');
    ratings.className = 'football-hub-rating-grid';
    ratings.dataset.role = `${side}-ratings`;
    panel.append(logo.root, title, helmet, ratings);
    return panel;
  }

  private createVsBlock(): HTMLElement {
    const vs = document.createElement('div');
    vs.className = 'football-hub-vs';
    vs.textContent = 'VS';
    return vs;
  }

  private createTeamsView(): void {
    this.teamsView.className = 'football-hub-view football-hub-teams';
    this.teamList.className = 'football-hub-team-list';
    this.teamOverview.className = 'football-hub-team-overview';
    const helmet = this.teamOverviewHelmet;
    helmet.className = 'football-hub-helmet-preview football-hub-overview-helmet';
    helmet.dataset.preview = 'fallback';
    helmet.append(this.teamOverviewBadge);
    this.teamOverview.append(this.teamOverviewLogo.root, helmet);
    this.teamsView.append(this.teamList, this.teamOverview);
  }

  private createRostersView(): void {
    this.rostersView.className = 'football-hub-view football-hub-rosters';
    const controls = document.createElement('div');
    controls.className = 'football-hub-roster-controls';
    this.rosterTeamSelect.setAttribute('aria-label', 'Roster team');
    this.rosterTeamSelect.addEventListener('change', () => {
      this.selectedTeamId = this.rosterTeamSelect.value;
      this.selectedRosterPlayerId = null;
      this.syncRosters();
    });
    this.rosterPositionFilter.setAttribute('aria-label', 'Position filter');
    this.rosterPositionFilter.addEventListener('change', () => {
      this.rosterPositionFilterValue = this.rosterPositionFilter.value;
      this.selectedRosterPlayerId = null;
      this.syncRosters();
    });
    this.rosterSortSelect.setAttribute('aria-label', 'Roster sort');
    for (const [value, label] of [
      ['overall', 'Overall'],
      ['position', 'Position'],
      ['number', 'Number'],
      ['name', 'Name'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = `Sort: ${label}`;
      this.rosterSortSelect.append(option);
    }
    this.rosterSortSelect.value = this.rosterSort;
    this.rosterSortSelect.addEventListener('change', () => {
      this.rosterSort = this.rosterSortSelect.value as RosterSort;
      this.syncRosters();
    });
    controls.append(this.rosterTeamSelect, this.rosterPositionFilter, this.rosterSortSelect);

    const tabs = document.createElement('div');
    tabs.className = 'football-hub-roster-tabs';
    tabs.setAttribute('role', 'tablist');
    for (const [tab, label] of [
      ['offense', 'Offense'],
      ['defense', 'Defense'],
      ['specialists', 'Specialists'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.textContent = label;
      button.addEventListener('click', () => {
        this.rosterTab = tab;
        this.selectedRosterPlayerId = null;
        this.syncRosters();
      });
      this.rosterTabs.set(tab, button);
      tabs.append(button);
    }

    const table = document.createElement('table');
    table.className = 'football-hub-roster-table';
    const head = document.createElement('thead');
    const row = document.createElement('tr');
    for (const label of ['#', 'Name', 'Pos', 'OVR', 'Archetype']) {
      const th = document.createElement('th');
      th.textContent = label;
      row.append(th);
    }
    head.append(row);
    table.append(head, this.rosterTableBody);
    const tableWrap = document.createElement('div');
    tableWrap.className = 'football-hub-roster-table-wrap';
    tableWrap.append(table);
    this.rosterDetail.className = 'football-hub-player-detail';
    this.rostersView.append(controls, tabs, tableWrap, this.rosterDetail);
  }

  private registerHelmetPreviews(): void {
    this.helmetPreview.registerPreview(
      'hub-user',
      this.playNowUserHelmet,
      this.playNowUserBadge,
      resolveTeamPresentationTheme(this.settings.teamProfiles).offense.uniform,
    );
    this.helmetPreview.registerPreview(
      'hub-opponent',
      this.playNowOpponentHelmet,
      this.playNowOpponentBadge,
      resolveTeamPresentationTheme(this.settings.teamProfiles).defense.uniform,
    );
    this.helmetPreview.registerPreview(
      'hub-team-overview',
      this.teamOverviewHelmet,
      this.teamOverviewBadge,
      resolveCustomizedTeamProfile(this.selectedTeamId, this.settings.teamProfiles).homeUniform,
    );
  }

  private setSection(section: HubSection): void {
    this.activeSection = section;
    this.sync();
  }

  private sync(): void {
    const league = this.options.getLeagueData();
    if (!league) {
      this.syncUnavailable();
      return;
    }

    for (const [section, button] of this.navButtons) {
      button.dataset.active = String(section === this.activeSection);
      button.setAttribute('aria-current', section === this.activeSection ? 'page' : 'false');
    }
    this.playNowView.hidden = this.activeSection !== 'playNow';
    this.teamsView.hidden = this.activeSection !== 'teams';
    this.rostersView.hidden = this.activeSection !== 'rosters';
    this.settingsView.hidden = this.activeSection !== 'settings';
    this.sectionTitle.textContent = sectionTitle(this.activeSection);
    this.sectionSubtitle.textContent = sectionSubtitle(this.activeSection);

    this.syncPlayNow(league);
    this.syncTeams(league);
    this.syncRosters();
  }

  private syncUnavailable(): void {
    this.sectionTitle.textContent = 'Preparing League';
    this.sectionSubtitle.textContent = 'Team and roster data will appear as soon as the local league cache is ready.';
    for (const [section, button] of this.navButtons) {
      button.dataset.active = String(section === 'playNow');
      button.setAttribute('aria-current', section === 'playNow' ? 'page' : 'false');
    }
    this.playNowView.hidden = false;
    this.teamsView.hidden = true;
    this.rostersView.hidden = true;
    this.settingsView.hidden = true;
    this.playNowSummary.className = 'football-hub-match-summary';
    this.playNowSummary.textContent = 'League data is unavailable. Return to the title and try again.';
  }

  private syncPlayNow(league: LeagueData): void {
    const theme = resolveTeamPresentationTheme(this.settings.teamProfiles);
    const userRoster = getRoster(league, theme.offense.profile.id);
    const opponentRoster = getRoster(league, theme.defense.profile.id);
    this.userLogo.sync(theme.offense.profile);
    this.opponentLogo.sync(theme.defense.profile);
    syncTeamHelmetBadge(this.playNowUserBadge, theme.offense.uniform);
    syncTeamHelmetBadge(this.playNowOpponentBadge, theme.defense.uniform);
    this.helmetPreview.syncPreview('hub-user', theme.offense.uniform);
    this.helmetPreview.syncPreview('hub-opponent', theme.defense.uniform);
    this.root.style.setProperty('--hub-accent', theme.offense.profile.colors.primary);
    this.root.style.setProperty('--hub-accent-2', theme.defense.profile.colors.primary);

    this.syncPlayTeamTitle('user', theme.offense.profile, this.settings.teamProfiles.userUniform);
    this.syncPlayTeamTitle('opponent', theme.defense.profile, this.settings.teamProfiles.opponentUniform);
    this.syncPlayTeamRatings('user', userRoster);
    this.syncPlayTeamRatings('opponent', opponentRoster);
    this.playNowSummary.className = 'football-hub-match-summary';
    this.playNowSummary.textContent = `${theme.offense.profile.displayName} ${theme.offense.profile.abbreviation} vs ${theme.defense.profile.displayName} ${theme.defense.profile.abbreviation}`;
  }

  private syncPlayTeamTitle(side: 'opponent' | 'user', profile: TeamProfile, uniform: string): void {
    const element = this.playNowView.querySelector<HTMLElement>(`.football-hub-play-team-title[data-role="${side}"]`);
    if (!element) {
      return;
    }
    element.replaceChildren();
    const name = document.createElement('strong');
    name.textContent = profile.displayName;
    const meta = document.createElement('span');
    meta.textContent = `${profile.abbreviation} | ${capitalize(uniform)} uniform`;
    element.append(name, meta);
  }

  private syncPlayTeamRatings(side: 'opponent' | 'user', roster: TeamRoster | null): void {
    const element = this.playNowView.querySelector<HTMLElement>(`.football-hub-rating-grid[data-role="${side}-ratings"]`);
    if (!element) {
      return;
    }
    element.replaceChildren(...createRatingPills(roster ? calculateTeamRatings(roster) : null));
  }

  private syncTeams(league: LeagueData): void {
    this.teamList.replaceChildren(...league.teams.map((team) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'football-hub-team-row';
      button.dataset.active = String(team.id === this.selectedTeamId);
      button.addEventListener('click', () => {
        this.selectedTeamId = team.id;
        this.sync();
      });
      const logo = createTeamLogoBadge(team, 'hub-team-list-logo');
      const ratings = calculateTeamRatings(getRoster(league, team.id)!);
      button.append(logo.root, createTextBlock(team.displayName, team.abbreviation), createScoreBlock('OVR', ratings.overall));
      return button;
    }));

    const profile = getTeam(league, this.selectedTeamId) ?? league.teams[0]!;
    const roster = getRoster(league, profile.id)!;
    const ratings = calculateTeamRatings(roster);
    const quarterback = getStartingQuarterback(roster);
    const bestOffense = getBestPlayer(roster, roster.offensiveStarterIds);
    const bestDefense = getBestPlayer(roster, roster.defensiveStarterIds);
    this.teamOverviewLogo.sync(profile);
    syncTeamHelmetBadge(this.teamOverviewBadge, profile.homeUniform);
    this.helmetPreview.syncPreview('hub-team-overview', profile.homeUniform);
    this.teamOverview.style.setProperty('--team-primary', profile.colors.primary);
    this.teamOverview.style.setProperty('--team-text', getReadableTextColor(profile.colors.primary));
    replaceAfterFirstTwo(this.teamOverview, [
      createOverviewHeader(profile, ratings),
      createStrengthWeaknessPanel(ratings),
      createKeyPlayerPanel('Starting QB', quarterback),
      createKeyPlayerPanel('Best offensive player', bestOffense),
      createKeyPlayerPanel('Best defensive player', bestDefense),
      createRosterSizePanel(roster),
    ]);
  }

  private syncRosters(): void {
    const league = this.options.getLeagueData();
    if (!league) {
      return;
    }
    const teamId = getTeam(league, this.selectedTeamId)?.id ?? this.settings.teamProfiles.userTeamId;
    const roster = getRoster(league, teamId) ?? league.rosters[0]!;
    this.selectedTeamId = roster.teamId;
    syncSelectOptions(
      this.rosterTeamSelect,
      league.teams.map((team) => ({ label: team.displayName, value: team.id })),
      roster.teamId,
    );
    for (const [tab, button] of this.rosterTabs) {
      button.dataset.active = String(tab === this.rosterTab);
      button.setAttribute('aria-selected', String(tab === this.rosterTab));
    }
    const tabPlayers = getRosterTabPlayers(roster, this.rosterTab);
    syncSelectOptions(
      this.rosterPositionFilter,
      [
        { label: 'All positions', value: 'all' },
        ...[...new Set(tabPlayers.map((player) => player.footballPosition))]
          .sort()
          .map((position) => ({ label: position, value: position })),
      ],
      this.rosterPositionFilterValue,
    );
    this.rosterPositionFilterValue = this.rosterPositionFilter.value || 'all';
    const rows = tabPlayers
      .filter((player) => this.rosterPositionFilterValue === 'all' || player.footballPosition === this.rosterPositionFilterValue)
      .sort((a, b) => comparePlayers(a, b, this.rosterSort));
    if (!rows.some((player) => player.id === this.selectedRosterPlayerId)) {
      this.selectedRosterPlayerId = rows[0]?.id ?? null;
    }
    this.rosterTableBody.replaceChildren(...rows.map((player) => this.createRosterRow(player)));
    const selected = rows.find((player) => player.id === this.selectedRosterPlayerId) ?? rows[0] ?? null;
    this.syncRosterDetail(league, roster, selected);
  }

  private createRosterRow(player: RosterPlayer): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.tabIndex = 0;
    row.dataset.selected = String(player.id === this.selectedRosterPlayerId);
    row.addEventListener('click', () => {
      this.selectedRosterPlayerId = player.id;
      this.syncRosters();
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        this.selectedRosterPlayerId = player.id;
        this.syncRosters();
        event.preventDefault();
      }
    });
    for (const value of [
      `#${player.jerseyNumber}`,
      player.displayName,
      player.footballPosition,
      String(calculateOverallRating(player.footballPosition, player.ratings)),
      formatArchetype(player.archetype),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }

  private syncRosterDetail(league: LeagueData, roster: TeamRoster, player: RosterPlayer | null): void {
    const profile = getTeam(league, roster.teamId);
    this.rosterDetail.replaceChildren();
    if (!player || !profile) {
      this.rosterDetail.append(createEmptyState('Select a player.'));
      return;
    }
    const logo = createTeamLogoBadge(profile, 'hub-player-detail-logo');
    const overall = calculateOverallRating(player.footballPosition, player.ratings);
    const header = document.createElement('header');
    header.append(logo.root, createTextBlock(`#${player.jerseyNumber} ${player.displayName}`, `${player.footballPosition} | ${formatArchetype(player.archetype)} | OVR ${overall}`));
    const attributes = document.createElement('div');
    attributes.className = 'football-hub-attribute-list';
    for (const key of getRelevantAttributeKeys(player)) {
      const value = player.ratings[key];
      if (value === undefined) {
        continue;
      }
      const row = document.createElement('div');
      row.className = 'football-hub-attribute-row';
      const label = document.createElement('span');
      label.textContent = getAttributeLabel(key);
      const meter = document.createElement('div');
      meter.className = 'football-hub-attribute-meter';
      meter.style.setProperty('--rating', `${value}%`);
      const number = document.createElement('strong');
      number.textContent = String(value);
      row.append(label, meter, number);
      attributes.append(row);
    }
    this.rosterDetail.append(header, attributes);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.handleFirstGesture();
    if (event.key === 'Escape') {
      this.options.onBack();
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const sections: HubSection[] = ['playNow', 'teams', 'rosters', 'settings'];
      const current = sections.indexOf(this.activeSection);
      this.setSection(sections[wrapIndex(current + (event.key === 'ArrowDown' ? 1 : -1), sections.length)]);
      event.preventDefault();
    }
  }

  private handleFirstGesture(): void {
    if (this.firstGestureHandled) {
      return;
    }
    this.firstGestureHandled = true;
    this.options.onFirstGesture?.();
  }
}

function sectionTitle(section: HubSection): string {
  return {
    playNow: 'Play Now',
    rosters: 'Roster Browser',
    settings: 'Settings',
    teams: 'Team Overview',
  }[section];
}

function sectionSubtitle(section: HubSection): string {
  return {
    playNow: 'Review the matchup, uniforms, helmets, and ratings before setup.',
    rosters: 'Browse starters, specialists, archetypes, and ratings from the loaded league.',
    settings: 'Adjust presentation and gameplay preferences without leaving the hub.',
    teams: 'Compare team identity, ratings, strengths, and key players.',
  }[section];
}

function getTeam(league: LeagueData, teamId: string): TeamProfile | null {
  return league.teams.find((team) => team.id === teamId) ?? null;
}

function getRoster(league: LeagueData, teamId: string): TeamRoster | null {
  return league.rosters.find((roster) => roster.teamId === teamId) ?? null;
}

function createRatingPills(ratings: TeamRatings | null): HTMLElement[] {
  return [
    createScoreBlock('OVR', ratings?.overall ?? 0),
    createScoreBlock('OFF', ratings?.offense ?? 0),
    createScoreBlock('DEF', ratings?.defense ?? 0),
    createScoreBlock('ST', ratings?.specialTeams ?? 0),
  ];
}

function createScoreBlock(label: string, value: number): HTMLElement {
  const block = document.createElement('div');
  block.className = 'football-hub-score-block';
  const strong = document.createElement('strong');
  strong.textContent = String(value);
  const span = document.createElement('span');
  span.textContent = label;
  block.append(strong, span);
  return block;
}

function createTextBlock(title: string, subtitle: string): HTMLElement {
  const block = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = subtitle;
  block.append(strong, span);
  return block;
}

function createOverviewHeader(profile: TeamProfile, ratings: TeamRatings): HTMLElement {
  const header = document.createElement('div');
  header.className = 'football-hub-overview-header';
  header.append(createTextBlock(profile.displayName, `${profile.abbreviation} | ${profile.identity}`), ...createRatingPills(ratings));
  return header;
}

function createStrengthWeaknessPanel(ratings: TeamRatings): HTMLElement {
  const metrics = [
    ['Passing', ratings.passing],
    ['Rushing', ratings.rushing],
    ['Blocking', ratings.blocking],
    ['Pass rush', ratings.passRush],
    ['Coverage', ratings.coverage],
    ['Special teams', ratings.specialTeams],
  ] as const;
  const sorted = [...metrics].sort((a, b) => b[1] - a[1]);
  const panel = document.createElement('div');
  panel.className = 'football-hub-strengths';
  panel.append(
    createTextBlock('Top strengths', sorted.slice(0, 3).map(([label, value]) => `${label} ${value}`).join(' | ')),
    createTextBlock('Watch areas', sorted.slice(-2).map(([label, value]) => `${label} ${value}`).join(' | ')),
  );
  return panel;
}

function createKeyPlayerPanel(label: string, player: RosterPlayer | null): HTMLElement {
  return createTextBlock(label, player
    ? `#${player.jerseyNumber} ${player.displayName} ${player.footballPosition} OVR ${calculateOverallRating(player.footballPosition, player.ratings)}`
    : 'Unavailable');
}

function createRosterSizePanel(roster: TeamRoster): HTMLElement {
  return createTextBlock('Roster size', `${roster.players.length} players`);
}

function replaceAfterFirstTwo(root: HTMLElement, children: HTMLElement[]): void {
  const fixed = Array.from(root.children).slice(0, 2);
  root.replaceChildren(...fixed, ...children);
}

function getStartingQuarterback(roster: TeamRoster): RosterPlayer | null {
  return roster.offensiveStarterIds
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .find((player) => player?.footballPosition === 'QB') ?? null;
}

function getBestPlayer(roster: TeamRoster, ids: readonly string[]): RosterPlayer | null {
  return ids
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .filter((player): player is RosterPlayer => player !== null)
    .sort((a, b) =>
      calculateOverallRating(b.footballPosition, b.ratings) -
      calculateOverallRating(a.footballPosition, a.ratings))[0] ?? null;
}

function getRosterTabPlayers(roster: TeamRoster, tab: RosterTab): RosterPlayer[] {
  const ids = tab === 'offense'
    ? roster.offensiveStarterIds
    : tab === 'defense'
      ? roster.defensiveStarterIds
      : [roster.kickerId, roster.punterId, roster.longSnapperId, ...roster.reserveIds];
  return ids
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .filter((player): player is RosterPlayer => player !== null);
}

function comparePlayers(a: RosterPlayer, b: RosterPlayer, sort: RosterSort): number {
  if (sort === 'number') {
    return a.jerseyNumber - b.jerseyNumber;
  }
  if (sort === 'name') {
    return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
  }
  if (sort === 'position') {
    return a.footballPosition.localeCompare(b.footballPosition) || a.jerseyNumber - b.jerseyNumber;
  }
  return calculateOverallRating(b.footballPosition, b.ratings) -
    calculateOverallRating(a.footballPosition, a.ratings);
}

function syncSelectOptions(
  select: HTMLSelectElement,
  options: readonly { label: string; value: string }[],
  value: string,
): void {
  const signature = options.map((option) => `${option.value}:${option.label}`).join('|');
  if (select.dataset.signature !== signature) {
    select.replaceChildren(...options.map((option) => {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      return element;
    }));
    select.dataset.signature = signature;
  }
  select.value = options.some((option) => option.value === value) ? value : options[0]?.value ?? '';
}

function getRelevantAttributeKeys(player: RosterPlayer): PlayerAttributeKey[] {
  const profile = getPositionRatingProfile(player.footballPosition);
  return [...new Set([...profile.required, ...profile.optional])]
    .filter((key) => player.ratings[key] !== undefined);
}

function getAttributeLabel(key: PlayerAttributeKey): string {
  return PLAYER_ATTRIBUTE_DEFINITIONS.find((definition) => definition.key === key)?.label ?? key;
}

function formatArchetype(archetype: string): string {
  return archetype
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (value) => value.toUpperCase());
}

function createEmptyState(text: string): HTMLElement {
  const element = document.createElement('p');
  element.className = 'football-hub-empty';
  element.textContent = text;
  return element;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
