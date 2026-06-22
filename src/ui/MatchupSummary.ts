import { createGameplayRosterBinding } from '../roster/GameplayRosterBinding';
import { resolveTeamPresentationTheme } from '../teams/TeamThemeApplier';
import type { TeamProfileSettings } from '../teams/TeamProfileStore';
import type { MatchSetupValidation } from './MatchSetupModel';

export class MatchupSummary {
  readonly root = document.createElement('aside');

  private readonly title = document.createElement('h3');
  private readonly teams = document.createElement('p');
  private readonly uniforms = document.createElement('p');
  private readonly lineup = document.createElement('p');
  private readonly warning = document.createElement('p');

  constructor() {
    this.root.className = 'matchup-summary';
    this.title.textContent = 'Matchup Summary';
    this.warning.className = 'matchup-summary-warning';
    this.root.append(this.title, this.teams, this.uniforms, this.lineup, this.warning);
  }

  sync(settings: TeamProfileSettings, validation: MatchSetupValidation): void {
    const theme = resolveTeamPresentationTheme(settings);
    const binding = createGameplayRosterBinding('11v11', settings);
    this.teams.textContent = `${theme.offense.profile.displayName} vs ${theme.defense.profile.displayName}`;
    this.uniforms.textContent = `Uniforms: ${settings.userUniform} vs ${settings.opponentUniform}`;
    this.lineup.textContent = `Lineups: ${binding.userRoster.offensiveStarterIds.length} offensive starters, ${binding.opponentRoster.defensiveStarterIds.length} defensive starters`;
    this.warning.hidden = validation.issues.length === 0;
    this.warning.textContent = validation.issues.join(' ');
  }
}
