import { createGameplayRosterBinding } from '../roster/GameplayRosterBinding';
import { STARTER_TEAM_PROFILES } from '../teams/TeamRegistry';
import { resolveTeamPresentationTheme } from '../teams/TeamThemeApplier';
import type { TeamProfileSettings } from '../teams/TeamProfileStore';
import { createClearWeatherSnapshot } from '../weather/WeatherProfile';
import type { MatchSetupValidation } from './MatchSetupModel';
import { createTeamLogoBadge, type TeamLogoBadge } from './TeamLogoBadge';

export class MatchupSummary {
  readonly root = document.createElement('aside');

  private readonly title = document.createElement('h3');
  private readonly teams = document.createElement('p');
  private readonly uniforms = document.createElement('p');
  private readonly weather = document.createElement('p');
  private readonly lineup = document.createElement('p');
  private readonly warning = document.createElement('p');
  private readonly teamLogos = document.createElement('div');
  private readonly userLogo: TeamLogoBadge;
  private readonly opponentLogo: TeamLogoBadge;

  constructor() {
    const fallbackUserTeam = STARTER_TEAM_PROFILES[0]!;
    const fallbackOpponentTeam = STARTER_TEAM_PROFILES[1] ?? fallbackUserTeam;
    this.root.className = 'matchup-summary';
    this.userLogo = createTeamLogoBadge(fallbackUserTeam, 'matchup-summary-logo');
    this.opponentLogo = createTeamLogoBadge(fallbackOpponentTeam, 'matchup-summary-logo');
    this.title.textContent = 'Matchup Summary';
    this.teamLogos.className = 'matchup-summary-logos';
    this.teamLogos.append(this.userLogo.root, document.createTextNode('vs'), this.opponentLogo.root);
    this.warning.className = 'matchup-summary-warning';
    this.root.append(this.title, this.teamLogos, this.teams, this.uniforms, this.weather, this.lineup, this.warning);
  }

  sync(settings: TeamProfileSettings, validation: MatchSetupValidation): void {
    const theme = resolveTeamPresentationTheme(settings);
    const binding = createGameplayRosterBinding('11v11', settings);
    const weather = createClearWeatherSnapshot();
    this.userLogo.sync(theme.offense.profile);
    this.opponentLogo.sync(theme.defense.profile);
    this.teams.textContent = `${theme.offense.profile.displayName} vs ${theme.defense.profile.displayName}`;
    this.uniforms.textContent = `Uniforms: ${settings.userUniform} vs ${settings.opponentUniform}`;
    this.weather.textContent = `Weather: ${weather.condition.toUpperCase()}`;
    this.lineup.textContent = `Lineups: ${binding.userRoster.offensiveStarterIds.length} offensive starters, ${binding.opponentRoster.defensiveStarterIds.length} defensive starters`;
    this.warning.hidden = validation.issues.length === 0;
    this.warning.textContent = validation.issues.join(' ');
  }
}
