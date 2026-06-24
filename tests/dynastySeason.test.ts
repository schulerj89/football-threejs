import { describe, expect, it } from 'vitest';
import {
  DYNASTY_REGULAR_SEASON_WEEK_COUNT,
  DYNASTY_SEASON_TEAM_COUNT,
  createDynastySeasonCore,
} from '../src/dynasty/DynastySchedule';
import {
  DYNASTY_SAVE_SCHEMA_VERSION,
  DYNASTY_SEASON_CORE_VERSION,
} from '../src/dynasty/DynastyTypes';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty season core', () => {
  it('creates deterministic save data and schedule for the same seed', () => {
    const league = generateLeagueData({ seed: 'dynasty-league' });
    const first = createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'dynasty-seed',
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const second = createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'dynasty-seed',
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      currentWeekIndex: 0,
      modeVersion: DYNASTY_SEASON_CORE_VERSION,
      schemaVersion: DYNASTY_SAVE_SCHEMA_VERSION,
      status: 'active',
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
  });

  it('builds a five-week six-team round robin with every team active each week', () => {
    const league = generateLeagueData({ seed: 'dynasty-league' });
    const save = createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'round-robin',
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const weeks = save.currentSeason.weeks;
    const playedPairs = new Set<string>();

    expect(save.currentSeason.teamIds).toHaveLength(DYNASTY_SEASON_TEAM_COUNT);
    expect(weeks).toHaveLength(DYNASTY_REGULAR_SEASON_WEEK_COUNT);
    expect(save.currentSeason.standings).toHaveLength(DYNASTY_SEASON_TEAM_COUNT);

    for (const week of weeks) {
      const weeklyTeamIds = new Set<string>();
      expect(week.games).toHaveLength(DYNASTY_SEASON_TEAM_COUNT / 2);
      for (const game of week.games) {
        expect(game.status).toBe('scheduled');
        expect(game.result).toBeNull();
        expect(game.awayTeamId).not.toBe(game.homeTeamId);
        weeklyTeamIds.add(game.awayTeamId);
        weeklyTeamIds.add(game.homeTeamId);
        playedPairs.add([game.awayTeamId, game.homeTeamId].sort().join(':'));
      }
      expect(weeklyTeamIds.size).toBe(DYNASTY_SEASON_TEAM_COUNT);
    }

    expect(playedPairs.size).toBe(15);
  });

  it('rejects dynasty creation when the user team is outside the six-team league', () => {
    const league = generateLeagueData({ seed: 'dynasty-league' });

    expect(() => createDynastySeasonCore({
      seed: 'bad-user-team',
      teams: league.teams,
      userTeamId: 'not-a-team',
    })).toThrow(/not in league teams/);
  });
});
