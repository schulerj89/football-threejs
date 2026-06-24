import { describe, expect, it } from 'vitest';
import {
  createDynastyTeamChoiceOptions,
  shouldPersistFootballHubLaunchSettings,
  type FootballHubLaunchOptions,
} from '../src/ui/FootballHubScreen';
import { generateLeagueData } from '../src/league/LeagueGenerator';

describe('football hub launch policy', () => {
  it('builds Dynasty team choice options with names and logos', () => {
    const league = generateLeagueData({ seed: 'dynasty-team-choice' });
    const options = createDynastyTeamChoiceOptions(league);

    expect(options).toHaveLength(6);
    expect(options.map((option) => option.teamId)).toEqual(league.teams.map((team) => team.id));
    expect(options.every((option) =>
      option.displayName.length > 0 &&
      option.shortName.length > 0 &&
      option.abbreviation.length > 0 &&
      option.logoUrl === `/branding/teams/${option.teamId}/logo.webp` &&
      option.primaryColor.startsWith('#') &&
      option.secondaryColor.startsWith('#'))).toBe(true);
  });

  it('persists Play Now settings but keeps Dynasty launch settings runtime-only', () => {
    expect(shouldPersistFootballHubLaunchSettings({ source: 'playNow' })).toBe(true);
    expect(shouldPersistFootballHubLaunchSettings({ source: 'dynasty' })).toBe(false);
  });

  it('keeps Dynasty story context absent from Play Now launches', () => {
    const playNow: FootballHubLaunchOptions = { source: 'playNow' };
    const dynasty: FootballHubLaunchOptions = {
      dynastyStoryContext: {
        halftimeSummary: 'Dynasty Week 1: Metro entered 0-0 against Lights (0-0).',
        hubSummary: 'Week 1: Metro host Lights.',
        matchupLabel: 'vs Lakefront Lights',
        opponentRecordLabel: '0-0',
        opponentStandingLabel: 'No. 2',
        postgameSummary: 'Dynasty Week 1: Metro started this matchup 0-0, with Lights at 0-0.',
        seasonLabel: '2026 Season',
        userRecordLabel: '0-0',
        userStandingLabel: 'No. 1',
        weekLabel: 'Week 1',
      },
      source: 'dynasty',
    };

    expect(playNow.dynastyStoryContext).toBeUndefined();
    expect(dynasty.dynastyStoryContext?.weekLabel).toBe('Week 1');
  });
});
