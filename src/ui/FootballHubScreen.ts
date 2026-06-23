import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import type { LeagueData } from '../league/LeagueTypes';
import { calculateOverallRating } from '../ratings/OverallRatingCalculator';
import { PLAYER_ATTRIBUTE_DEFINITIONS, type PlayerAttributeKey } from '../ratings/PlayerAttribute';
import { getPositionRatingProfile } from '../ratings/PositionRatingProfile';
import type { RosterPlayer } from '../roster/RosterPlayer';
import type { TeamRoster } from '../roster/TeamRoster';
import type { TeamProfile } from '../teams/TeamProfile';
import {
  normalizeTeamProfileSettings,
  type TeamProfileSettings,
} from '../teams/TeamProfileStore';
import {
  getReadableTextColor,
  resolveTeamPresentationTheme,
} from '../teams/TeamThemeApplier';
import { SETTINGS_DONE_EVENT, SettingsPanel } from './SettingsPanel';
import { createTeamLogoBadge, type TeamLogoBadge } from './TeamLogoBadge';
import {
  createTeamSummaryViewModel,
  resolveRosterPlayerStatus,
  type TeamSummaryViewModel,
} from './TeamSummaryViewModel';
import {
  createAutoUniformCorrectionForMatchup,
  createMatchupSelection,
  createTeamProfileSettingsFromMatchupSelection,
  updateMatchupTeam,
  updateMatchupUniform,
  validateMatchupSelection,
  type MatchupSelection,
} from './MatchSetupModel';
import type { UniformVariant } from '../teams/UniformPalette';

type HubSection = 'playNow' | 'dynasty' | 'rosters' | 'settings';
type RosterTab = 'offense' | 'defense' | 'specialists';
type RosterSort = 'number' | 'name' | 'overall' | 'position';

export interface FootballHubScreenOptions {
  getLeagueData: () => LeagueData | null;
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
  private readonly dynastyView = document.createElement('section');
  private readonly rostersView = document.createElement('section');
  private readonly settingsView = document.createElement('section');
  private readonly playNowTeamSelects = {
    opponent: document.createElement('select'),
    user: document.createElement('select'),
  };
  private readonly playNowUniformSelects = {
    opponent: document.createElement('select'),
    user: document.createElement('select'),
  };
  private readonly playNowValidation = document.createElement('div');
  private readonly playNowCorrectionButton = document.createElement('button');
  private readonly playNowPlayButton = document.createElement('button');
  private readonly userLogo: TeamLogoBadge;
  private readonly opponentLogo: TeamLogoBadge;
  private readonly teamOverviewLogo: TeamLogoBadge;
  private readonly playNowSummary = document.createElement('div');
  private readonly teamOverview = document.createElement('article');
  private readonly rosterPreviousTeamButton = document.createElement('button');
  private readonly rosterNextTeamButton = document.createElement('button');
  private readonly rosterTeamSelect = document.createElement('select');
  private readonly rosterPositionFilter = document.createElement('select');
  private readonly rosterSortSelect = document.createElement('select');
  private readonly rosterTabs = new Map<RosterTab, HTMLButtonElement>();
  private readonly rosterTableBody = document.createElement('tbody');
  private readonly rosterDetail = document.createElement('aside');
  private readonly settingsPanel: SettingsPanel;
  private activeSection: HubSection = 'playNow';
  private rosterTab: RosterTab = 'offense';
  private rosterSort: RosterSort = 'overall';
  private rosterPositionFilterValue = 'all';
  private selectedTeamId: string;
  private selectedRosterPlayerId: string | null = null;
  private settings: GameExperienceSettings;
  private matchupSelection: MatchupSelection;
  private firstGestureHandled = false;
  private visible = false;

  constructor(private readonly options: FootballHubScreenOptions) {
    this.settings = options.initialSettings;
    this.matchupSelection = createMatchupSelection(options.initialSettings.teamProfiles);
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
    this.root.addEventListener('pointerdown', () => this.handleFirstGesture(), { capture: true });
    this.root.addEventListener('keydown', (event) => this.handleKeyDown(event));
    document.body.append(this.root);
    this.sync();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settings = settings;
    this.matchupSelection = createMatchupSelection(settings.teamProfiles);
    this.selectedTeamId = normalizeTeamProfileSettings(settings.teamProfiles).userTeamId;
    this.settingsPanel.setSettings(settings);
    this.sync();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
    if (visible) {
      this.sync();
      this.root.focus({ preventScroll: true });
    }
  }

  isVisible(): boolean {
    return this.visible && !this.root.hidden;
  }

  dispose(): void {
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
      ['dynasty', 'Dynasty'],
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
    this.createDynastyView();
    this.createRostersView();
    this.settingsView.className = 'football-hub-view football-hub-settings-view';
    this.settingsView.append(this.settingsPanel.root);
    this.content.append(this.playNowView, this.dynastyView, this.rostersView, this.settingsView);
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
    this.playNowCorrectionButton.type = 'button';
    this.playNowCorrectionButton.className = 'football-hub-secondary';
    this.playNowCorrectionButton.textContent = 'Auto Fix Uniforms';
    this.playNowCorrectionButton.addEventListener('click', () => {
      this.updateMatchupSelection(createAutoUniformCorrectionForMatchup(
        this.matchupSelection,
        this.settings.teamProfiles,
      ));
    });
    this.playNowPlayButton.type = 'button';
    this.playNowPlayButton.className = 'football-hub-primary';
    this.playNowPlayButton.textContent = 'Play Game';
    this.playNowPlayButton.addEventListener('click', () => {
      this.handleFirstGesture();
      if (!validateMatchupSelection(this.matchupSelection).canConfirm) {
        return;
      }
      this.options.onPlayGame({
        ...this.settings,
        teamProfiles: createTeamProfileSettingsFromMatchupSelection(
          this.matchupSelection,
          this.settings.teamProfiles,
        ),
      });
    });
    actions.append(this.playNowCorrectionButton, this.playNowPlayButton);
    this.playNowView.append(matchup, this.playNowSummary, actions);
  }

  private createDynastyView(): void {
    this.dynastyView.className = 'football-hub-view football-hub-dynasty';
    const hero = document.createElement('article');
    hero.className = 'football-hub-dynasty-hero';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'football-hub-dynasty-eyebrow';
    eyebrow.textContent = 'Planning Shell';

    const title = document.createElement('h3');
    title.textContent = 'Build a program, not just a lineup';

    const summary = document.createElement('p');
    summary.textContent = 'Dynasty will become the long-term mode for seasons, recruiting, staff decisions, roster growth, and program identity. This shell is intentionally non-playable while we lock the scope and data model.';

    const phases = document.createElement('ol');
    phases.className = 'football-hub-dynasty-phases';
    for (const phase of [
      'Season hub, schedule, standings, and weekly advance',
      'Roster progression, seniors leaving, and lightweight recruiting',
      'Coach goals, program identity, and budget choices',
      'Offseason cycle with signing, depth review, and next-season setup',
    ]) {
      const item = document.createElement('li');
      item.textContent = phase;
      phases.append(item);
    }

    const note = document.createElement('p');
    note.className = 'football-hub-dynasty-note';
    note.textContent = 'Decision map: docs/DYNASTY_DECISIONS.md';

    hero.append(eyebrow, title, summary, phases, note);
    this.dynastyView.append(hero);
  }

  private createPlayTeamPanel(side: 'opponent' | 'user'): HTMLElement {
    const panel = document.createElement('article');
    panel.className = 'football-hub-play-team';
    panel.dataset.side = side;
    const logo = side === 'user' ? this.userLogo : this.opponentLogo;
    logo.root.classList.add('football-hub-play-team-logo');
    const logoStage = document.createElement('div');
    logoStage.className = 'football-hub-play-team-logo-stage';
    logoStage.append(logo.root);
    const title = document.createElement('div');
    title.className = 'football-hub-play-team-title';
    title.dataset.role = side;
    const ratings = document.createElement('div');
    ratings.className = 'football-hub-rating-grid';
    ratings.dataset.role = `${side}-ratings`;
    const controls = this.createPlayTeamControls(side);
    panel.append(title, logoStage, ratings, controls);
    return panel;
  }

  private createPlayTeamControls(side: 'opponent' | 'user'): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'football-hub-play-team-controls';
    const previousButton = document.createElement('button');
    previousButton.type = 'button';
    previousButton.className = 'football-hub-secondary football-hub-team-step';
    previousButton.textContent = '<';
    previousButton.setAttribute('aria-label', side === 'user' ? 'Previous user' : 'Previous opponent');
    previousButton.addEventListener('click', () => this.stepMatchupTeam(side, -1));
    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'football-hub-secondary football-hub-team-step';
    nextButton.textContent = '>';
    nextButton.setAttribute('aria-label', side === 'user' ? 'Next user' : 'Next opponent');
    nextButton.addEventListener('click', () => this.stepMatchupTeam(side, 1));

    const teamSelect = this.playNowTeamSelects[side];
    teamSelect.setAttribute('aria-label', side === 'user' ? 'Your team' : 'Opponent team');
    teamSelect.addEventListener('change', () => {
      this.updateMatchupSelection(updateMatchupTeam(
        this.matchupSelection,
        side,
        teamSelect.value,
        this.settings.teamProfiles,
      ));
    });

    const uniformSelect = this.playNowUniformSelects[side];
    uniformSelect.setAttribute('aria-label', side === 'user' ? 'Your uniform' : 'Opponent uniform');
    for (const [value, label] of [
      ['home', 'Home'],
      ['away', 'Away'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      uniformSelect.append(option);
    }
    uniformSelect.addEventListener('change', () => {
      this.updateMatchupSelection(updateMatchupUniform(
        this.matchupSelection,
        side,
        uniformSelect.value as UniformVariant,
        this.settings.teamProfiles,
      ));
    });

    controls.append(previousButton, teamSelect, nextButton, uniformSelect);
    return controls;
  }

  private createVsBlock(): HTMLElement {
    const vs = document.createElement('div');
    vs.className = 'football-hub-vs';
    const label = document.createElement('strong');
    label.textContent = 'VS';
    this.playNowValidation.className = 'football-hub-play-validation';
    vs.append(label, this.playNowValidation);
    return vs;
  }

  private createRostersView(): void {
    this.rostersView.className = 'football-hub-view football-hub-rosters';
    this.teamOverview.className = 'football-hub-team-overview football-hub-roster-overview';
    this.teamOverview.append(this.teamOverviewLogo.root);

    const controls = document.createElement('div');
    controls.className = 'football-hub-roster-controls';
    this.rosterPreviousTeamButton.type = 'button';
    this.rosterPreviousTeamButton.className = 'football-hub-secondary football-hub-team-step';
    this.rosterPreviousTeamButton.textContent = '<';
    this.rosterPreviousTeamButton.setAttribute('aria-label', 'Previous team');
    this.rosterPreviousTeamButton.addEventListener('click', () => this.stepRosterTeam(-1));
    this.rosterNextTeamButton.type = 'button';
    this.rosterNextTeamButton.className = 'football-hub-secondary football-hub-team-step';
    this.rosterNextTeamButton.textContent = '>';
    this.rosterNextTeamButton.setAttribute('aria-label', 'Next team');
    this.rosterNextTeamButton.addEventListener('click', () => this.stepRosterTeam(1));
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
    controls.append(
      this.rosterPreviousTeamButton,
      this.rosterTeamSelect,
      this.rosterNextTeamButton,
      this.rosterPositionFilter,
      this.rosterSortSelect,
    );

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
    this.rostersView.append(this.teamOverview, controls, tabs, tableWrap, this.rosterDetail);
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
    this.dynastyView.hidden = this.activeSection !== 'dynasty';
    this.rostersView.hidden = this.activeSection !== 'rosters';
    this.settingsView.hidden = this.activeSection !== 'settings';
    this.sectionTitle.textContent = sectionTitle(this.activeSection);
    this.sectionSubtitle.textContent = sectionSubtitle(this.activeSection);

    this.syncPlayNow(league);
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
    this.dynastyView.hidden = true;
    this.rostersView.hidden = true;
    this.settingsView.hidden = true;
    this.playNowSummary.className = 'football-hub-match-summary';
    this.playNowSummary.textContent = 'League data is unavailable. Return to the title and try again.';
  }

  private syncPlayNow(league: LeagueData): void {
    const teamProfiles = createTeamProfileSettingsFromMatchupSelection(
      this.matchupSelection,
      this.settings.teamProfiles,
    );
    const theme = resolveTeamPresentationTheme(teamProfiles);
    const userRoster = getRoster(league, theme.offense.profile.id);
    const opponentRoster = getRoster(league, theme.defense.profile.id);
    const userSummary = userRoster
      ? createTeamSummaryViewModel(theme.offense.profile, userRoster)
      : null;
    const opponentSummary = opponentRoster
      ? createTeamSummaryViewModel(theme.defense.profile, opponentRoster)
      : null;
    this.userLogo.sync(theme.offense.profile);
    this.opponentLogo.sync(theme.defense.profile);
    this.root.style.setProperty('--hub-accent', theme.offense.profile.colors.primary);
    this.root.style.setProperty('--hub-accent-2', theme.defense.profile.colors.primary);

    this.syncPlayTeamControls(
      league,
      'user',
      teamProfiles.userTeamId,
      teamProfiles.userUniform,
      teamProfiles.opponentTeamId,
    );
    this.syncPlayTeamControls(
      league,
      'opponent',
      teamProfiles.opponentTeamId,
      teamProfiles.opponentUniform,
      teamProfiles.userTeamId,
    );
    this.syncPlayTeamTitle('user', theme.offense.profile, teamProfiles.userUniform);
    this.syncPlayTeamTitle('opponent', theme.defense.profile, teamProfiles.opponentUniform);
    this.syncPlayTeamRatings('user', userSummary);
    this.syncPlayTeamRatings('opponent', opponentSummary);
    this.syncPlayNowValidation();
    this.playNowSummary.className = 'football-hub-match-summary';
    this.playNowSummary.textContent = `${theme.offense.profile.displayName} ${theme.offense.profile.abbreviation} vs ${theme.defense.profile.displayName} ${theme.defense.profile.abbreviation} | ${formatGameSummary(this.settings)}`;
  }

  private syncPlayTeamControls(
    league: LeagueData,
    side: 'opponent' | 'user',
    teamId: string,
    uniform: UniformVariant,
    excludedTeamId: string,
  ): void {
    syncSelectOptions(
      this.playNowTeamSelects[side],
      league.teams
        .filter((team) => team.id !== excludedTeamId)
        .map((team) => ({ label: team.displayName, value: team.id })),
      teamId,
    );
    this.playNowUniformSelects[side].value = uniform;
  }

  private syncPlayTeamTitle(side: 'opponent' | 'user', profile: TeamProfile, uniform: string): void {
    const element = this.playNowView.querySelector<HTMLElement>(`.football-hub-play-team-title[data-role="${side}"]`);
    if (!element) {
      return;
    }
    const panel = this.playNowView.querySelector<HTMLElement>(`.football-hub-play-team[data-side="${side}"]`);
    panel?.style.setProperty('--play-team-primary', profile.colors.primary);
    panel?.style.setProperty('--play-team-secondary', profile.colors.secondary);
    panel?.style.setProperty('--play-team-accent', profile.colors.accent);
    panel?.style.setProperty('--play-team-readable', getReadableTextColor(profile.colors.primary));
    panel?.setAttribute(
      'aria-label',
      `${side === 'user' ? 'User matchup card' : 'Opponent matchup card'}: ${profile.displayName}, ${profile.abbreviation}, ${capitalize(uniform)} uniform`,
    );
    element.replaceChildren();
    const name = document.createElement('strong');
    name.textContent = profile.displayName;
    const meta = document.createElement('span');
    meta.textContent = `${profile.abbreviation} | ${capitalize(uniform)} uniform`;
    element.append(name, meta);
  }

  private syncPlayTeamRatings(side: 'opponent' | 'user', summary: TeamSummaryViewModel | null): void {
    const element = this.playNowView.querySelector<HTMLElement>(`.football-hub-rating-grid[data-role="${side}-ratings"]`);
    if (!element) {
      return;
    }
    element.replaceChildren(...createRatingPills(summary));
  }

  private syncPlayNowValidation(): void {
    const validation = validateMatchupSelection(this.matchupSelection);
    this.playNowValidation.replaceChildren();
    if (validation.issues.length === 0) {
      const ok = document.createElement('span');
      ok.textContent = 'Ready to play';
      this.playNowValidation.append(ok);
    } else {
      for (const issue of validation.issues) {
        const item = document.createElement('span');
        item.textContent = issue;
        this.playNowValidation.append(item);
      }
    }
    this.playNowCorrectionButton.hidden = !validation.uniformConflict;
    this.playNowPlayButton.disabled = !validation.canConfirm;
    this.playNowView.dataset.valid = String(validation.canConfirm);
  }

  private updateMatchupSelection(selection: MatchupSelection): void {
    this.matchupSelection = createMatchupSelection(createTeamProfileSettingsFromMatchupSelection(
      selection,
      this.settings.teamProfiles,
    ));
    const nextSettings: GameExperienceSettings = {
      ...this.settings,
      teamProfiles: createTeamProfileSettingsFromMatchupSelection(
        this.matchupSelection,
        this.settings.teamProfiles,
      ),
    };
    this.settings = nextSettings;
    this.settingsPanel.setSettings(nextSettings);
    this.options.onSettingsChange(nextSettings);
    this.sync();
  }

  private stepMatchupTeam(side: 'opponent' | 'user', direction: -1 | 1): void {
    const league = this.options.getLeagueData();
    if (!league || league.teams.length === 0) {
      return;
    }
    const currentTeamId = side === 'user'
      ? this.matchupSelection.userTeamId
      : this.matchupSelection.opponentTeamId;
    const excludedTeamId = side === 'user'
      ? this.matchupSelection.opponentTeamId
      : this.matchupSelection.userTeamId;
    const selectableTeams = league.teams.filter((team) => team.id !== excludedTeamId);
    if (selectableTeams.length === 0) {
      return;
    }
    const current = selectableTeams.findIndex((team) => team.id === currentTeamId);
    const next = selectableTeams[
      wrapIndex((current >= 0 ? current : 0) + direction, selectableTeams.length)
    ] ?? selectableTeams[0]!;
    this.updateMatchupSelection(updateMatchupTeam(
      this.matchupSelection,
      side,
      next.id,
      this.settings.teamProfiles,
    ));
  }

  private syncRosters(): void {
    const league = this.options.getLeagueData();
    if (!league) {
      return;
    }
    const teamId = getTeam(league, this.selectedTeamId)?.id ?? this.settings.teamProfiles.userTeamId;
    const roster = getRoster(league, teamId) ?? league.rosters[0]!;
    const profile = getTeam(league, roster.teamId) ?? league.teams[0]!;
    const summary = createTeamSummaryViewModel(profile, roster);
    this.selectedTeamId = roster.teamId;
    syncSelectOptions(
      this.rosterTeamSelect,
      league.teams.map((team) => ({ label: team.displayName, value: team.id })),
      roster.teamId,
    );
    this.syncRosterOverview(summary);
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

  private syncRosterOverview(summary: TeamSummaryViewModel): void {
    this.teamOverviewLogo.sync(summary.profile);
    this.teamOverview.style.setProperty('--team-primary', summary.profile.colors.primary);
    this.teamOverview.style.setProperty('--team-text', getReadableTextColor(summary.profile.colors.primary));
    this.root.style.setProperty('--hub-accent', summary.profile.colors.primary);
    this.teamOverview.replaceChildren(this.teamOverviewLogo.root, createOverviewHeader(summary));
  }

  private stepRosterTeam(direction: -1 | 1): void {
    const league = this.options.getLeagueData();
    if (!league || league.teams.length === 0) {
      return;
    }

    const current = league.teams.findIndex((team) => team.id === this.selectedTeamId);
    const next = league.teams[wrapIndex(current + direction, league.teams.length)] ?? league.teams[0]!;
    this.selectedTeamId = next.id;
    this.selectedRosterPlayerId = null;
    this.syncRosters();
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
    const status = resolveRosterPlayerStatus(roster, player);
    const header = document.createElement('header');
    header.append(
      logo.root,
      createPlayerDetailHeading(
        `#${player.jerseyNumber} ${player.displayName}`,
        `${player.footballPosition} | ${formatArchetype(player.archetype)} | OVR ${overall} | ${status}`,
      ),
    );
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
      const sections: HubSection[] = ['playNow', 'dynasty', 'rosters', 'settings'];
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
    dynasty: 'Dynasty',
    rosters: 'Roster Browser',
    settings: 'Settings',
  }[section];
}

function sectionSubtitle(section: HubSection): string {
  return {
    playNow: 'Review the matchup, uniforms, logos, and ratings before setup.',
    dynasty: 'Long-term team-building mode is being scoped before implementation.',
    rosters: 'Browse team rosters and player attributes.',
    settings: 'Adjust presentation and gameplay preferences without leaving the hub.',
  }[section];
}

function getTeam(league: LeagueData, teamId: string): TeamProfile | null {
  return league.teams.find((team) => team.id === teamId) ?? null;
}

function getRoster(league: LeagueData, teamId: string): TeamRoster | null {
  return league.rosters.find((roster) => roster.teamId === teamId) ?? null;
}

function createRatingPills(summary: TeamSummaryViewModel | null): HTMLElement[] {
  return [
    createScoreBlock('OVR', summary?.ratings.overall ?? 0),
    createScoreBlock('OFF', summary?.ratings.offense ?? 0),
    createScoreBlock('DEF', summary?.ratings.defense ?? 0),
    createScoreBlock('ST', summary?.ratings.specialTeams ?? 0),
  ];
}

function createScoreBlock(label: string, value: number): HTMLElement {
  const rating = clampRating(value);
  const block = document.createElement('div');
  block.className = 'football-hub-score-block';
  block.setAttribute('aria-label', `${label} rating ${rating} out of 100`);
  block.style.setProperty('--rating-width', `${rating}%`);
  block.style.setProperty('--rating-color', createRatingColor(rating));

  const header = document.createElement('div');
  header.className = 'football-hub-score-block-header';
  const strong = document.createElement('strong');
  strong.textContent = String(rating);
  const span = document.createElement('span');
  span.textContent = label;
  header.append(span, strong);

  const bar = document.createElement('div');
  bar.className = 'football-hub-score-bar';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('i');
  fill.className = 'football-hub-score-bar-fill';
  bar.append(fill);

  block.append(header, bar);
  return block;
}

function clampRating(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function createRatingColor(value: number): string {
  const hue = Math.round((value / 100) * 120);
  return `hsl(${hue} 74% 46%)`;
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

function createPlayerDetailHeading(title: string, subtitle: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'football-hub-player-detail-heading';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = subtitle;
  block.append(strong, span);
  return block;
}

function createOverviewHeader(summary: TeamSummaryViewModel): HTMLElement {
  const header = document.createElement('div');
  header.className = 'football-hub-overview-header';
  header.append(
    createTextBlock(
      summary.profile.displayName,
      `${summary.profile.abbreviation} | ${summary.profile.identity}`,
    ),
    createTextBlock('Roster size', `${summary.rosterSize} players`),
  );
  return header;
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

function formatGameSummary(settings: GameExperienceSettings): string {
  return [
    capitalize(settings.gameMode),
    settings.playbookId,
    `${Math.round(settings.quarterLengthSeconds / 60)}:00 quarters`,
    `${capitalize(settings.matchDifficulty)} difficulty`,
  ].join(' | ');
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
