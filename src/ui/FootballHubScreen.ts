import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import { createDynastyHubViewModel } from '../dynasty/DynastyHubViewModel';
import {
  createAndPersistDynastySave,
  loadDynastySave,
  persistDynastySave,
  type DynastySaveStore,
} from '../dynasty/DynastySaveRepository';
import {
  advanceDynastyWeek as advanceDynastyWeekSave,
  canAdvanceDynastyWeek,
  getCurrentDynastyWeek,
  getCurrentDynastyUserGame,
  simulateCurrentDynastyUserGame,
  simulateCurrentDynastyWeekNonUserGames,
} from '../dynasty/DynastyWeekAdvance';
import { approveCurrentDynastyWeekProgression } from '../dynasty/DynastyProgressionPreview';
import { IndexedDbDynastySaveStore } from '../dynasty/IndexedDbDynastySaveStore';
import { createDynastyMatchStoryContext } from '../dynasty/DynastyStoryContext';
import type { DynastySaveData, DynastySaveSource } from '../dynasty/DynastyTypes';
import type { DynastyMatchStoryContext, MatchDifficulty } from '../match/MatchTypes';
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
import type { WeatherCondition } from '../weather/WeatherTypes';

type HubSection = 'playNow' | 'dynasty' | 'rosters' | 'settings';
type DynastyPage = 'week' | 'standings' | 'awards' | 'program' | 'training' | 'schedule' | 'roster';
type RosterTab = 'offense' | 'defense' | 'specialists';
type RosterSort = 'number' | 'name' | 'overall' | 'position';

export const DYNASTY_DECISION_DOC_PATH = 'docs/DYNASTY_DECISIONS.md';

export type FootballHubLaunchSource = 'dynasty' | 'playNow';

export interface FootballHubLaunchOptions {
  readonly dynastyStoryContext?: DynastyMatchStoryContext | null;
  readonly source: FootballHubLaunchSource;
}

export interface DynastyTeamChoiceOption {
  readonly abbreviation: string;
  readonly displayName: string;
  readonly logoUrl: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly shortName: string;
  readonly teamId: string;
}

export function shouldPersistFootballHubLaunchSettings(options: FootballHubLaunchOptions): boolean {
  return options.source === 'playNow';
}

export function createDynastyTeamChoiceOptions(league: LeagueData): DynastyTeamChoiceOption[] {
  return league.teams.map((team) => ({
    abbreviation: team.abbreviation,
    displayName: team.displayName,
    logoUrl: team.logoUrl,
    primaryColor: team.colors.primary,
    secondaryColor: team.colors.secondary,
    shortName: team.shortName,
    teamId: team.id,
  }));
}

export interface FootballHubScreenOptions {
  dynastySaveStore?: DynastySaveStore | null;
  getLeagueData: () => LeagueData | null;
  initialSettings: GameExperienceSettings;
  onBack: () => void;
  onFirstGesture?: () => void;
  onPlayGame: (settings: GameExperienceSettings, options: FootballHubLaunchOptions) => void;
  onSettingsChange: (settings: GameExperienceSettings) => void;
}

export class FootballHubScreen {
  readonly root = document.createElement('div');

  private readonly nav = document.createElement('nav');
  private readonly navButtons = new Map<HubSection, HTMLButtonElement>();
  private readonly dynastyNavButtons = new Map<DynastyPage, HTMLButtonElement>();
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
  private readonly playNowGameSettings = document.createElement('section');
  private readonly playNowQuarterLengthSelect = document.createElement('select');
  private readonly playNowDifficultySelect = document.createElement('select');
  private readonly playNowWeatherSelect = document.createElement('select');
  private readonly userLogo: TeamLogoBadge;
  private readonly opponentLogo: TeamLogoBadge;
  private readonly teamOverviewLogo: TeamLogoBadge;
  private readonly dynastyLogo: TeamLogoBadge;
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
  private readonly dynastySaveStore: DynastySaveStore | null;
  private dynastyPage: DynastyPage = 'week';
  private dynastySave: DynastySaveData | null = null;
  private dynastySaveLoadKey: string | null = null;
  private dynastySaveLoading = false;
  private dynastyTeamChoiceRequired = false;
  private dynastySelectedTeamId: string | null = null;
  private dynastySaveSource: DynastySaveSource = 'none';
  private dynastySaveWarning: string | null = null;
  private firstGestureHandled = false;
  private visible = false;

  constructor(private readonly options: FootballHubScreenOptions) {
    this.dynastySaveStore = options.dynastySaveStore ?? IndexedDbDynastySaveStore.createFromGlobal();
    this.settings = options.initialSettings;
    this.matchupSelection = createMatchupSelection(options.initialSettings.teamProfiles);
    this.selectedTeamId = options.initialSettings.teamProfiles.userTeamId;
    const theme = resolveTeamPresentationTheme(options.initialSettings.teamProfiles);
    this.userLogo = createTeamLogoBadge(theme.offense.profile, 'hub-team-logo');
    this.opponentLogo = createTeamLogoBadge(theme.defense.profile, 'hub-team-logo');
    this.teamOverviewLogo = createTeamLogoBadge(theme.offense.profile, 'hub-team-logo');
    this.dynastyLogo = createTeamLogoBadge(theme.offense.profile, 'hub-team-logo');
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
    this.nav.className = 'football-hub-nav';
    this.nav.setAttribute('aria-label', 'Football hub sections');
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
      this.nav.append(button);
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

    body.append(this.nav, main);
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
      }, {
        source: 'playNow',
      });
    });
    actions.append(this.playNowCorrectionButton, this.playNowPlayButton);
    this.createPlayNowGameSettings();
    this.playNowView.append(matchup, this.playNowSummary, this.playNowGameSettings, actions);
  }

  private createPlayNowGameSettings(): void {
    this.playNowGameSettings.className = 'football-hub-game-settings';
    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = 'Game Settings';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Set this matchup before Play Game.';
    header.append(title, subtitle);

    const grid = document.createElement('div');
    grid.className = 'football-hub-game-settings-grid';

    this.configurePlayNowSelect(
      this.playNowQuarterLengthSelect,
      'Play Now quarter length',
      [
        { label: '1 minute', value: '60' },
        { label: '3 minutes', value: '180' },
        { label: '5 minutes', value: '300' },
        { label: '10 minutes', value: '600' },
      ],
      () => this.updatePlayNowGameSettings({
        quarterLengthSeconds: Number(this.playNowQuarterLengthSelect.value),
      }),
    );
    this.configurePlayNowSelect(
      this.playNowDifficultySelect,
      'Play Now difficulty',
      [
        { label: 'Rookie', value: 'rookie' },
        { label: 'Pro', value: 'pro' },
        { label: 'All-Pro', value: 'allPro' },
      ],
      () => this.updatePlayNowGameSettings({
        matchDifficulty: this.playNowDifficultySelect.value as MatchDifficulty,
      }),
    );
    this.configurePlayNowSelect(
      this.playNowWeatherSelect,
      'Play Now weather',
      [
        { label: 'Clear / Sunny', value: 'clear' },
        { label: 'Overcast', value: 'overcast' },
        { label: 'Rain', value: 'rain' },
      ],
      () => this.updatePlayNowGameSettings({
        weatherCondition: this.playNowWeatherSelect.value as WeatherCondition,
      }),
    );

    grid.append(
      createPlayNowSettingControl('Quarter Length', this.playNowQuarterLengthSelect),
      createPlayNowSettingControl('Difficulty', this.playNowDifficultySelect),
      createPlayNowSettingControl('Weather', this.playNowWeatherSelect),
    );
    this.playNowGameSettings.append(header, grid);
  }

  private configurePlayNowSelect(
    select: HTMLSelectElement,
    ariaLabel: string,
    options: readonly { label: string; value: string }[],
    onChange: () => void,
  ): void {
    select.setAttribute('aria-label', ariaLabel);
    select.replaceChildren(...options.map((option) => {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      return element;
    }));
    select.addEventListener('change', onChange);
  }

  private createDynastyView(): void {
    this.dynastyView.className = 'football-hub-view football-hub-dynasty';
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
    if (section !== 'dynasty') {
      this.dynastyPage = 'week';
    }
    this.sync();
  }

  private setDynastyPage(page: DynastyPage): void {
    this.dynastyPage = page;
    this.sync();
  }

  private sync(): void {
    const league = this.options.getLeagueData();
    if (!league) {
      this.syncUnavailable();
      return;
    }

    this.renderHubNavigation();
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
    this.syncDynasty(league);
    this.syncRosters();
  }

  private renderHubNavigation(): void {
    this.nav.dataset.mode = 'hub';
    this.nav.setAttribute('aria-label', 'Football hub sections');
    this.nav.replaceChildren(...this.navButtons.values());
  }

  private renderDynastyNavigation(currentWeekLabel: string): void {
    this.nav.dataset.mode = 'dynasty';
    this.nav.setAttribute('aria-label', 'Dynasty sections');
    const pages: readonly { label: string; page: DynastyPage }[] = [
      { label: currentWeekLabel, page: 'week' },
      { label: 'Standings', page: 'standings' },
      { label: 'Award Watch', page: 'awards' },
      { label: 'Program Info', page: 'program' },
      { label: 'Training', page: 'training' },
      { label: 'Schedule', page: 'schedule' },
      { label: 'Current Roster', page: 'roster' },
    ];
    const buttons = pages.map(({ label, page }) => {
      let button = this.dynastyNavButtons.get(page);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.addEventListener('click', () => this.setDynastyPage(page));
        this.dynastyNavButtons.set(page, button);
      }
      button.textContent = label;
      button.dataset.active = String(page === this.dynastyPage);
      button.setAttribute('aria-current', page === this.dynastyPage ? 'page' : 'false');
      return button;
    });
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'football-hub-dynasty-exit';
    exit.textContent = 'Exit Dynasty';
    exit.addEventListener('click', () => this.setSection('playNow'));
    this.nav.replaceChildren(...buttons, exit);
  }

  private syncUnavailable(): void {
    this.sectionTitle.textContent = 'Preparing League';
    this.sectionSubtitle.textContent = 'Team and roster data will appear as soon as the local league cache is ready.';
    this.renderHubNavigation();
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

  private syncDynasty(league: LeagueData): void {
    const save = this.dynastySave;
    if (this.dynastyTeamChoiceRequired && !this.dynastySaveLoading && !save) {
      this.renderDynastyTeamChoice(league);
      return;
    }
    this.ensureDynastySaveLoaded(league);
    if (!save || !isDynastySaveCompatibleWithLeague(save, league, save.userTeamId)) {
      this.renderDynastyLoading();
      return;
    }
    const view = createDynastyHubViewModel({ league, save });
    if (this.activeSection === 'dynasty') {
      this.renderDynastyNavigation(view.currentWeekLabel);
    }
    const programProfile = getTeam(league, view.program.teamId) ?? league.teams[0]!;
    this.dynastyLogo.sync(programProfile);
    this.dynastyLogo.root.classList.add('football-hub-dynasty-logo');
    this.dynastyView.replaceChildren();

    const header = document.createElement('article');
    header.className = 'football-hub-dynasty-program';
    const headerText = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'football-hub-dynasty-eyebrow';
    eyebrow.textContent = 'Season Core';
    const title = document.createElement('h3');
    title.textContent = `${view.program.displayName} Dynasty`;
    const meta = document.createElement('p');
    meta.textContent = `${view.seasonLabel} | ${view.currentWeekLabel} | ${view.program.recordLabel}`;
    headerText.append(eyebrow, title, meta);
    const newDynastyButton = document.createElement('button');
    newDynastyButton.type = 'button';
    newDynastyButton.className = 'football-hub-secondary football-hub-dynasty-new';
    newDynastyButton.textContent = 'Start New Dynasty';
    newDynastyButton.addEventListener('click', () => this.openDynastyTeamChoice());
    header.append(this.dynastyLogo.root, headerText, newDynastyButton);

    const upcoming = document.createElement('section');
    upcoming.className = 'football-hub-dynasty-upcoming';
    const upcomingLabel = document.createElement('span');
    upcomingLabel.textContent = view.upcomingGame?.weekLabel ?? view.currentWeekLabel;
    const upcomingTitle = document.createElement('strong');
    upcomingTitle.textContent = view.upcomingGame?.userOpponentLabel ?? 'Season complete';
    const upcomingMeta = document.createElement('p');
    upcomingMeta.textContent = view.upcomingGame
      ? `${view.upcomingGame.venueLabel} | ${view.upcomingGame.matchupLabel} | ${view.upcomingGame.statusLabel}`
      : 'No scheduled game remains.';
    const upcomingStory = document.createElement('p');
    upcomingStory.className = 'football-hub-dynasty-story';
    upcomingStory.textContent = view.storySummary;
    upcoming.append(upcomingLabel, upcomingTitle, upcomingMeta, upcomingStory);
    const currentWeek = getCurrentDynastyWeek(save);
    const userGame = getCurrentDynastyUserGame(save);
    const nonUserScheduledCount = currentWeek?.games.filter((game) =>
      game.status === 'scheduled' &&
      game.awayTeamId !== save.userTeamId &&
      game.homeTeamId !== save.userTeamId).length ?? 0;
    const canAdvanceWeek = canAdvanceDynastyWeek(save);
    const progressionSaved = (save.currentSeason.progressionApplications ?? []).some((application) =>
      application.teamId === save.userTeamId &&
      application.weekIndex === save.currentWeekIndex);
    const actions = document.createElement('div');
    actions.className = 'football-hub-dynasty-actions';
    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'football-hub-primary';
    playButton.textContent = 'Play Dynasty Game';
    playButton.disabled = !userGame || userGame.status !== 'scheduled';
    playButton.addEventListener('click', () => this.playDynastyGame(league));
    const simOtherButton = document.createElement('button');
    simOtherButton.type = 'button';
    simOtherButton.className = 'football-hub-secondary';
    simOtherButton.textContent = 'Sim Other Games';
    simOtherButton.disabled = nonUserScheduledCount === 0;
    simOtherButton.addEventListener('click', () => this.simulateDynastyOtherGames(league));
    const quickSimButton = document.createElement('button');
    quickSimButton.type = 'button';
    quickSimButton.className = 'football-hub-secondary';
    quickSimButton.textContent = 'Quick Sim User Game';
    quickSimButton.disabled = !userGame || userGame.status !== 'scheduled';
    quickSimButton.addEventListener('click', () => this.simulateDynastyUserGame(league));
    const progressionButton = document.createElement('button');
    progressionButton.type = 'button';
    progressionButton.className = 'football-hub-secondary';
    progressionButton.textContent = progressionSaved ? 'Progression Saved' : 'Save Progression';
    progressionButton.disabled = !canAdvanceWeek || progressionSaved;
    progressionButton.addEventListener('click', () => this.approveDynastyProgression(league));
    const advanceButton = document.createElement('button');
    advanceButton.type = 'button';
    advanceButton.className = 'football-hub-secondary';
    advanceButton.textContent = save.status === 'complete' ? 'Season Complete' : 'Advance Week';
    advanceButton.disabled = !canAdvanceWeek;
    advanceButton.addEventListener('click', () => this.advanceDynastyWeek(league));
    actions.append(playButton, simOtherButton, quickSimButton, progressionButton, advanceButton);
    const actionHint = document.createElement('p');
    actionHint.className = 'football-hub-dynasty-action-hint';
    actionHint.textContent = createDynastyActionHint(save, nonUserScheduledCount, canAdvanceWeek);
    upcoming.append(actions, actionHint);

    const standings = document.createElement('section');
    standings.className = 'football-hub-dynasty-standings';
    standings.append(createSectionLabel('Standings'));
    const standingsTable = document.createElement('table');
    const standingsHead = document.createElement('thead');
    const standingsHeadRow = document.createElement('tr');
    for (const label of ['#', 'Team', 'W-L', 'PF', 'PA', '+/-']) {
      const cell = document.createElement('th');
      cell.textContent = label;
      standingsHeadRow.append(cell);
    }
    standingsHead.append(standingsHeadRow);
    const standingsBody = document.createElement('tbody');
    standingsBody.append(...view.standings.map((row) => {
      const tr = document.createElement('tr');
      for (const value of [
        String(row.rank),
        row.team.displayName,
        row.team.recordLabel,
        String(row.pointsFor),
        String(row.pointsAgainst),
        formatSignedNumber(row.pointsMargin),
      ]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }));
    standingsTable.append(standingsHead, standingsBody);
    standings.append(standingsTable);

    const leaders = document.createElement('section');
    leaders.className = 'football-hub-dynasty-leaders';
    leaders.append(createSectionLabel('Weekly Leaders'));
    const leaderList = document.createElement('ol');
    for (const leader of view.leaders) {
      const item = document.createElement('li');
      const category = document.createElement('span');
      category.textContent = leader.category;
      const team = document.createElement('strong');
      team.textContent = leader.team.displayName;
      const value = document.createElement('span');
      value.textContent = leader.valueLabel;
      item.append(category, team, value);
      leaderList.append(item);
    }
    leaders.append(leaderList);

    const awards = document.createElement('section');
    awards.className = 'football-hub-dynasty-awards';
    awards.append(createSectionLabel('Award Watch'));
    const awardList = document.createElement('ol');
    for (const watch of view.awardWatch) {
      const item = document.createElement('li');
      const award = document.createElement('span');
      award.textContent = watch.award;
      const team = document.createElement('strong');
      team.textContent = watch.team.displayName;
      const value = document.createElement('span');
      value.textContent = watch.valueLabel;
      item.append(award, team, value);
      awardList.append(item);
    }
    awards.append(awardList);

    const coachGoals = document.createElement('section');
    coachGoals.className = 'football-hub-dynasty-coach-goals';
    coachGoals.append(createSectionLabel('Coach Goals'));
    const coachGoalsMeta = document.createElement('p');
    coachGoalsMeta.textContent = view.coachGoalsSummaryLabel;
    const coachGoalList = document.createElement('ol');
    for (const goal of view.coachGoals) {
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = goal.title;
      const status = document.createElement('strong');
      status.textContent = `${goal.statusLabel} | ${goal.progressLabel}`;
      const progress = document.createElement('span');
      progress.textContent = `${goal.progressPercent}%`;
      item.append(title, status, progress);
      coachGoalList.append(item);
    }
    coachGoals.append(coachGoalsMeta, coachGoalList);

    const programStrengths = document.createElement('section');
    programStrengths.className = 'football-hub-dynasty-program-strengths';
    programStrengths.append(createSectionLabel('Program Strengths'));
    const strengthsMeta = document.createElement('p');
    strengthsMeta.textContent = view.strengthsSummaryLabel;
    const strengthsList = document.createElement('ol');
    for (const strength of view.programStrengths) {
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = strength.title;
      const detail = document.createElement('strong');
      detail.textContent = strength.detailLabel;
      const score = document.createElement('span');
      score.textContent = `${strength.score} | ${strength.evidenceLabel}`;
      item.append(title, detail, score);
      strengthsList.append(item);
    }
    programStrengths.append(strengthsMeta, strengthsList);

    const budget = document.createElement('section');
    budget.className = 'football-hub-dynasty-budget';
    budget.append(createSectionLabel('Program Budget'));
    const budgetMeta = document.createElement('p');
    budgetMeta.textContent = view.budgetSummaryLabel;
    const budgetList = document.createElement('ol');
    for (const allocation of view.budgetAllocations) {
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = allocation.title;
      const detail = document.createElement('strong');
      detail.textContent = `${allocation.allocationPoints} pts | ${allocation.priorityLabel}`;
      const rationale = document.createElement('span');
      rationale.textContent = allocation.rationaleLabel;
      item.append(title, detail, rationale);
      budgetList.append(item);
    }
    budget.append(budgetMeta, budgetList);

    const staffModifiers = document.createElement('section');
    staffModifiers.className = 'football-hub-dynasty-staff-modifiers';
    staffModifiers.append(createSectionLabel('Staff Modifiers'));
    const staffMeta = document.createElement('p');
    staffMeta.textContent = view.staffSummaryLabel;
    const staffList = document.createElement('ol');
    for (const modifier of view.staffModifiers) {
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = modifier.title;
      const bonus = document.createElement('strong');
      bonus.textContent = `${modifier.bonusLabel} | ${modifier.futureEffectLabel}`;
      const source = document.createElement('span');
      source.textContent = modifier.sourceLabel;
      item.append(title, bonus, source);
      staffList.append(item);
    }
    staffModifiers.append(staffMeta, staffList);

    const training = document.createElement('section');
    training.className = 'football-hub-dynasty-training';
    training.append(createSectionLabel('Weekly Training'));
    const trainingList = document.createElement('ol');
    for (const room of view.trainingSummary) {
      const item = document.createElement('li');
      const roomName = document.createElement('span');
      roomName.textContent = room.room;
      const focus = document.createElement('strong');
      focus.textContent = `${room.focusLabel} | ${room.leaderName}`;
      const points = document.createElement('span');
      points.textContent = `${room.averagePoints} avg`;
      item.append(roomName, focus, points);
      trainingList.append(item);
    }
    training.append(trainingList);

    const progression = document.createElement('section');
    progression.className = 'football-hub-dynasty-progression';
    progression.append(createSectionLabel('Progression Preview'));
    const progressionMeta = document.createElement('p');
    progressionMeta.textContent = view.progressionSummaryLabel;
    const progressionList = document.createElement('ol');
    for (const player of view.progressionPreview) {
      const item = document.createElement('li');
      const position = document.createElement('span');
      position.textContent = player.position;
      const name = document.createElement('strong');
      name.textContent = `${player.playerName} (${player.currentOverall} OVR, +${player.projectedOverallDelta})`;
      const points = document.createElement('span');
      points.textContent = `${player.performancePoints} pts`;
      item.append(position, name, points);
      progressionList.append(item);
    }
    progression.append(progressionMeta, progressionList);

    const schedule = document.createElement('section');
    schedule.className = 'football-hub-dynasty-schedule';
    schedule.append(createSectionLabel('Schedule'));
    const scheduleList = document.createElement('ol');
    for (const game of view.schedule) {
      const item = document.createElement('li');
      const week = document.createElement('span');
      week.textContent = game.weekLabel;
      const matchup = document.createElement('strong');
      matchup.textContent = game.userOpponentLabel;
      const status = document.createElement('span');
      status.textContent = `${game.venueLabel} | ${game.statusLabel}`;
      item.append(week, matchup, status);
      scheduleList.append(item);
    }
    schedule.append(scheduleList);

    const note = document.createElement('p');
    note.className = 'football-hub-dynasty-note';
    note.textContent = this.dynastySaveWarning
      ? `${this.dynastySaveWarning} Decision map: ${DYNASTY_DECISION_DOC_PATH}`
      : `Save: ${formatDynastySaveSource(this.dynastySaveSource)} | Decision map: ${DYNASTY_DECISION_DOC_PATH}`;

    const currentRoster = this.createDynastyRosterSection(league, save);
    const pages: Record<DynastyPage, HTMLElement[]> = {
      awards: [awards],
      program: [coachGoals, programStrengths, budget, staffModifiers, note],
      roster: [currentRoster],
      schedule: [schedule],
      standings: [standings, leaders],
      training: [training, progression],
      week: [upcoming],
    };

    this.dynastyView.append(header, ...pages[this.dynastyPage]);
  }

  private createDynastyRosterSection(league: LeagueData, save: DynastySaveData): HTMLElement {
    const section = document.createElement('section');
    section.className = 'football-hub-dynasty-current-roster';
    section.append(createSectionLabel('Current Roster'));
    const roster = getRoster(league, save.userTeamId);
    if (!roster) {
      section.append(createEmptyState('The current Dynasty roster is unavailable.'));
      return section;
    }

    const table = document.createElement('table');
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['#', 'Name', 'Pos', 'OVR', 'Status']) {
      const cell = document.createElement('th');
      cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement('tbody');
    body.append(...roster.players
      .slice()
      .sort(comparePlayersForDynastyRoster)
      .map((player) => {
        const row = document.createElement('tr');
        const values = [
          `#${player.jerseyNumber}`,
          player.displayName,
          player.footballPosition,
          String(calculateOverallRating(player.footballPosition, player.ratings)),
          resolveRosterPlayerStatus(roster, player),
        ];
        for (const value of values) {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        }
        return row;
      }));
    table.append(head, body);
    section.append(table);
    return section;
  }

  private renderDynastyLoading(): void {
    this.dynastyView.replaceChildren();
    const loading = document.createElement('section');
    loading.className = 'football-hub-dynasty-upcoming football-hub-dynasty-loading';
    const label = document.createElement('span');
    label.textContent = 'Season Core';
    const title = document.createElement('strong');
    title.textContent = this.dynastySaveLoading ? 'Loading Dynasty Save' : 'Preparing Dynasty Save';
    const detail = document.createElement('p');
    detail.textContent = this.dynastySaveWarning ?? 'Your active Dynasty save will appear here shortly.';
    loading.append(label, title, detail);
    this.dynastyView.append(loading);
  }

  private renderDynastyTeamChoice(league: LeagueData): void {
    this.dynastyView.replaceChildren();
    const wrapper = document.createElement('section');
    wrapper.className = 'football-hub-dynasty-team-wizard';
    const header = document.createElement('header');
    const label = document.createElement('span');
    label.className = 'football-hub-dynasty-eyebrow';
    label.textContent = 'Choose Program';
    const title = document.createElement('h3');
    title.textContent = 'Start Dynasty';
    const detail = document.createElement('p');
    detail.textContent = this.dynastySaveWarning ?? 'Pick the program you want to control.';
    header.append(label, title, detail);

    const grid = document.createElement('div');
    grid.className = 'football-hub-dynasty-team-grid';
    for (const option of createDynastyTeamChoiceOptions(league)) {
      const profile = getTeam(league, option.teamId);
      if (!profile) {
        continue;
      }
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'football-hub-dynasty-team-choice';
      choice.style.setProperty('--team-choice-primary', option.primaryColor);
      choice.style.setProperty('--team-choice-secondary', option.secondaryColor);
      choice.setAttribute('aria-label', `Start Dynasty with ${option.displayName}`);
      choice.addEventListener('click', () => this.startDynastyWithTeam(league, option.teamId));
      const logo = createTeamLogoBadge(profile, 'football-hub-dynasty-team-choice-logo');
      const name = document.createElement('strong');
      name.textContent = option.displayName;
      choice.append(logo.root, name);
      grid.append(choice);
    }
    wrapper.append(header, grid);
    this.dynastyView.append(wrapper);
  }

  private playDynastyGame(league: LeagueData): void {
    const save = this.dynastySave;
    if (!save) {
      return;
    }
    const game = getCurrentDynastyUserGame(save);
    if (!game || game.status !== 'scheduled') {
      return;
    }

    const userIsHome = game.homeTeamId === save.userTeamId;
    const opponentTeamId = userIsHome ? game.awayTeamId : game.homeTeamId;
    const matchupSelection = createAutoUniformCorrectionForMatchup({
      opponentTeamId,
      opponentUniform: userIsHome ? 'away' : 'home',
      userTeamId: save.userTeamId,
      userUniform: userIsHome ? 'home' : 'away',
    }, this.settings.teamProfiles);
    this.handleFirstGesture();
    this.options.onPlayGame({
      ...this.settings,
      gameMode: 'exhibition',
      teamProfiles: createTeamProfileSettingsFromMatchupSelection(
        matchupSelection,
        this.settings.teamProfiles,
      ),
    }, {
      dynastyStoryContext: createDynastyMatchStoryContext({
        game,
        league,
        save,
      }),
      source: 'dynasty',
    });
  }

  private simulateDynastyOtherGames(league: LeagueData): void {
    const save = this.dynastySave;
    if (!save) {
      return;
    }
    void this.persistDynastySaveState(simulateCurrentDynastyWeekNonUserGames(save).save, league);
  }

  private simulateDynastyUserGame(league: LeagueData): void {
    const save = this.dynastySave;
    if (!save) {
      return;
    }
    void this.persistDynastySaveState(simulateCurrentDynastyUserGame(save).save, league);
  }

  private approveDynastyProgression(league: LeagueData): void {
    const save = this.dynastySave;
    if (!save) {
      return;
    }
    const result = approveCurrentDynastyWeekProgression({ save });
    if (!result.approved) {
      return;
    }
    void this.persistDynastySaveState(result.save, league);
  }

  private advanceDynastyWeek(league: LeagueData): void {
    const save = this.dynastySave;
    if (!save) {
      return;
    }
    const result = advanceDynastyWeekSave(save);
    void this.persistDynastySaveState(result.save, league);
  }

  private async persistDynastySaveState(save: DynastySaveData, league: LeagueData): Promise<void> {
    this.dynastySave = save;
    this.sync();
    const result = await persistDynastySave(save, { store: this.dynastySaveStore });
    if (!isDynastySaveCompatibleWithLeague(result.save, league, save.userTeamId)) {
      return;
    }
    this.dynastySave = result.save;
    this.dynastySaveSource = result.source;
    this.dynastySaveWarning = result.warning;
    this.sync();
  }

  private ensureDynastySaveLoaded(league: LeagueData): void {
    const userTeamId = this.dynastySelectedTeamId;
    const loadKey = createDynastyLoadKey(league, userTeamId ?? 'choose');
    if (
      this.dynastySaveLoadKey === loadKey &&
      (this.dynastySaveLoading || this.dynastyTeamChoiceRequired || (
        this.dynastySave &&
        isDynastySaveCompatibleWithLeague(this.dynastySave, league, this.dynastySave.userTeamId)
      ))
    ) {
      return;
    }

    this.dynastySaveLoadKey = loadKey;
    this.dynastySaveLoading = true;
    this.dynastyTeamChoiceRequired = false;
    this.dynastySave = null;
    this.dynastySaveWarning = null;
    void this.loadDynastySaveForLeague(league, userTeamId, loadKey);
  }

  private async loadDynastySaveForLeague(
    league: LeagueData,
    userTeamId: string | null,
    loadKey: string,
  ): Promise<void> {
    const loaded = await loadDynastySave({ store: this.dynastySaveStore });
    if (this.dynastySaveLoadKey !== loadKey) {
      return;
    }

    if (
      loaded.save &&
      isDynastySaveCompatibleWithLeague(loaded.save, league, loaded.save.userTeamId) &&
      (!userTeamId || loaded.save.userTeamId === userTeamId)
    ) {
      this.dynastySave = loaded.save;
      this.dynastySelectedTeamId = loaded.save.userTeamId;
      this.dynastySaveSource = loaded.source;
      this.dynastySaveWarning = loaded.warning;
    } else if (userTeamId) {
      const created = await createAndPersistDynastySave({
        seed: `${league.seed}:dynasty:${userTeamId}`,
        store: this.dynastySaveStore,
        teams: league.teams,
        userTeamId,
      });
      if (this.dynastySaveLoadKey !== loadKey) {
        return;
      }
      this.dynastySave = created.save;
      this.dynastySelectedTeamId = userTeamId;
      this.dynastySaveSource = created.source;
      this.dynastySaveWarning = loaded.warning ?? created.warning;
    } else {
      this.dynastySave = null;
      this.dynastySaveSource = loaded.source;
      this.dynastySaveWarning = loaded.warning;
      this.dynastyTeamChoiceRequired = true;
    }

    this.dynastySaveLoading = false;
    this.sync();
  }

  private getDynastyUserTeamId(): string {
    return this.dynastySave?.userTeamId ??
      this.dynastySelectedTeamId ??
      normalizeTeamProfileSettings(this.settings.teamProfiles).userTeamId;
  }

  private startDynastyWithTeam(league: LeagueData, teamId: string): void {
    this.dynastyPage = 'week';
    this.dynastySelectedTeamId = teamId;
    this.dynastyTeamChoiceRequired = false;
    this.dynastySaveLoading = true;
    this.dynastySave = null;
    this.dynastySaveWarning = null;
    const loadKey = createDynastyLoadKey(league, teamId);
    this.dynastySaveLoadKey = loadKey;
    this.renderDynastyLoading();
    void this.loadDynastySaveForLeague(league, teamId, loadKey);
  }

  private openDynastyTeamChoice(): void {
    this.dynastyPage = 'week';
    this.dynastySave = null;
    this.dynastySaveLoading = false;
    this.dynastyTeamChoiceRequired = true;
    this.dynastySaveLoadKey = null;
    this.dynastySaveWarning = 'Choose a team to replace the active Dynasty save.';
    this.sync();
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
    this.syncPlayNowGameSettings();
    this.syncPlayNowValidation();
    this.playNowSummary.className = 'football-hub-match-summary';
    this.playNowSummary.textContent = `${theme.offense.profile.displayName} ${theme.offense.profile.abbreviation} vs ${theme.defense.profile.displayName} ${theme.defense.profile.abbreviation} | ${formatGameSummary(this.settings)}`;
  }

  private syncPlayNowGameSettings(): void {
    this.playNowQuarterLengthSelect.value = getQuarterLengthOptionValue(
      this.settings.quarterLengthSeconds,
    );
    this.playNowDifficultySelect.value = this.settings.matchDifficulty;
    this.playNowWeatherSelect.value = this.settings.weatherCondition;
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

  private updatePlayNowGameSettings(
    patch: Partial<Pick<GameExperienceSettings, 'matchDifficulty' | 'quarterLengthSeconds' | 'weatherCondition'>>,
  ): void {
    const nextSettings: GameExperienceSettings = {
      ...this.settings,
      ...patch,
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
      ? this.playNowTeamSelects.user.value || this.matchupSelection.userTeamId
      : this.playNowTeamSelects.opponent.value || this.matchupSelection.opponentTeamId;
    const excludedTeamId = side === 'user'
      ? this.playNowTeamSelects.opponent.value || this.matchupSelection.opponentTeamId
      : this.playNowTeamSelects.user.value || this.matchupSelection.userTeamId;
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
    dynasty: 'Review your program, current week, schedule, and standings.',
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

function createSectionLabel(text: string): HTMLElement {
  const label = document.createElement('h3');
  label.textContent = text;
  return label;
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

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function createDynastyLoadKey(league: LeagueData, userTeamId: string): string {
  return `${league.seed}:${userTeamId}:${league.teams.map((team) => team.id).sort().join('|')}`;
}

function isDynastySaveCompatibleWithLeague(
  save: DynastySaveData,
  league: LeagueData,
  userTeamId: string,
): boolean {
  const leagueTeamIds = new Set(league.teams.map((team) => team.id));
  return save.userTeamId === userTeamId &&
    save.currentSeason.teamIds.length === leagueTeamIds.size &&
    save.currentSeason.teamIds.every((teamId) => leagueTeamIds.has(teamId));
}

function formatDynastySaveSource(source: DynastySaveSource): string {
  return {
    created: 'Created active save',
    indexedDB: 'IndexedDB',
    memoryFallback: 'Memory fallback',
    none: 'New active save',
  }[source];
}

function createDynastyActionHint(
  save: DynastySaveData,
  nonUserScheduledCount: number,
  canAdvanceWeek: boolean,
): string {
  if (save.status === 'complete') {
    return 'The regular season is complete for this starter Dynasty save.';
  }
  if (canAdvanceWeek) {
    return 'All games are final. Advance to the next week.';
  }
  const userGame = getCurrentDynastyUserGame(save);
  if (nonUserScheduledCount > 0 && userGame?.status === 'scheduled') {
    return 'Play or quick-sim your matchup, then sim the rest of the league before advancing.';
  }
  if (nonUserScheduledCount > 0) {
    return 'Sim the remaining league games before advancing.';
  }
  if (userGame?.status === 'scheduled') {
    return 'Play or quick-sim your matchup before advancing.';
  }
  return 'No advance action is available for the current week.';
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

function comparePlayersForDynastyRoster(a: RosterPlayer, b: RosterPlayer): number {
  return a.footballPosition.localeCompare(b.footballPosition) ||
    calculateOverallRating(b.footballPosition, b.ratings) -
      calculateOverallRating(a.footballPosition, a.ratings) ||
    a.jerseyNumber - b.jerseyNumber;
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

function createPlayNowSettingControl(labelText: string, select: HTMLSelectElement): HTMLElement {
  const control = document.createElement('label');
  control.className = 'football-hub-game-setting';
  const label = document.createElement('span');
  label.textContent = labelText;
  control.append(label, select);
  return control;
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
    `${formatWeatherCondition(settings.weatherCondition)} weather`,
  ].join(' | ');
}

function formatWeatherCondition(condition: WeatherCondition): string {
  if (condition === 'clear') {
    return 'Clear / Sunny';
  }

  return capitalize(condition);
}

function getQuarterLengthOptionValue(value: number): '180' | '300' | '60' | '600' {
  if (value === 60 || value === 180 || value === 300 || value === 600) {
    return String(value) as '180' | '300' | '60' | '600';
  }

  return '180';
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
