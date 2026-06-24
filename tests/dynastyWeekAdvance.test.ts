import { describe, expect, it } from 'vitest';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import {
  advanceDynastyWeek,
  canAdvanceDynastyWeek,
  getCurrentDynastyUserGame,
  recordCurrentDynastyUserGameResult,
  simulateCurrentDynastyUserGame,
  simulateCurrentDynastyWeekNonUserGames,
} from '../src/dynasty/DynastyWeekAdvance';
import { validateDynastySaveData } from '../src/dynasty/DynastyValidation';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty week advance', () => {
  it('deterministically simulates non-user games and leaves the user matchup scheduled', () => {
    const first = createSave('week-advance-non-user');
    const second = createSave('week-advance-non-user');
    const firstResult = simulateCurrentDynastyWeekNonUserGames(first);
    const secondResult = simulateCurrentDynastyWeekNonUserGames(second);
    const userGame = getCurrentDynastyUserGame(firstResult.save);
    const currentWeek = firstResult.save.currentSeason.weeks[firstResult.save.currentWeekIndex]!;

    expect(firstResult.simulatedGameIds).toHaveLength(2);
    expect(firstResult.save).toEqual(secondResult.save);
    expect(userGame?.status).toBe('scheduled');
    expect(currentWeek.games.filter((game) => game.status === 'final')).toHaveLength(2);
    expect(currentWeek.games.filter((game) =>
      game.status === 'final' &&
      game.result?.awayStats.offensiveYards &&
      game.result.homeStats.offensiveYards)).toHaveLength(2);
    expect(firstResult.save.currentSeason.teamStats.filter((stats) => stats.gamesPlayed === 1)).toHaveLength(4);
    expect(canAdvanceDynastyWeek(firstResult.save)).toBe(false);
  });

  it('records the user result, recalculates standings, and advances to the next week', () => {
    const save = createSave('week-advance-user-result');
    const userGame = getCurrentDynastyUserGame(save)!;
    const simulated = simulateCurrentDynastyWeekNonUserGames(save).save;
    const withUserResult = recordCurrentDynastyUserGameResult(simulated, {
      opponentScore: 17,
      userScore: 24,
    });
    const finishedUserGame = getCurrentDynastyUserGame(withUserResult)!;
    const userRecord = withUserResult.currentSeason.standings.find((record) =>
      record.teamId === DEFAULT_USER_TEAM_ID);
    const opponentRecord = withUserResult.currentSeason.standings.find((record) =>
      record.teamId === (userGame.awayTeamId === DEFAULT_USER_TEAM_ID ? userGame.homeTeamId : userGame.awayTeamId));
    const advanced = advanceDynastyWeek(withUserResult);

    expect(finishedUserGame.status).toBe('final');
    expect(userRecord).toMatchObject({
      losses: 0,
      pointsAgainst: 17,
      pointsFor: 24,
      wins: 1,
    });
    expect(withUserResult.currentSeason.teamStats.find((stats) =>
      stats.teamId === DEFAULT_USER_TEAM_ID)).toMatchObject({
      gamesPlayed: 1,
      pointsAgainst: 17,
      pointsFor: 24,
    });
    expect(withUserResult.currentSeason.teamStats.find((stats) =>
      stats.teamId === DEFAULT_USER_TEAM_ID)?.offensiveYards).toBeGreaterThan(0);
    expect(opponentRecord).toMatchObject({
      losses: 1,
      pointsAgainst: 24,
      pointsFor: 17,
      wins: 0,
    });
    expect(advanced.advanced).toBe(true);
    expect(advanced.save.currentWeekIndex).toBe(1);
    expect(advanced.save.status).toBe('active');
  });

  it('quick-sims the user game and completes the season after the final week', () => {
    let save = createSave('week-advance-season-complete');

    while (save.status !== 'complete') {
      save = simulateCurrentDynastyWeekNonUserGames(save).save;
      save = simulateCurrentDynastyUserGame(save).save;
      const advance = advanceDynastyWeek(save);
      expect(advance.advanced).toBe(true);
      save = advance.save;
    }

    expect(save.currentWeekIndex).toBe(save.currentSeason.weeks.length);
    expect(save.currentSeason.weeks.every((week) =>
      week.games.every((game) => game.status === 'final' && game.result))).toBe(true);
  });

  it('rejects stale or duplicated aggregate stat rows during validation', () => {
    const save = simulateCurrentDynastyUserGame(simulateCurrentDynastyWeekNonUserGames(
      createSave('week-advance-validation-hardening'),
    ).save).save;
    const firstStats = save.currentSeason.teamStats[0]!;
    const secondStats = save.currentSeason.teamStats[1]!;
    const staleStandings = {
      ...save,
      currentSeason: {
        ...save.currentSeason,
        standings: save.currentSeason.standings.map((record, index) =>
          index === 0 ? { ...record, pointsFor: record.pointsFor + 1 } : record),
      },
    };
    const staleStats = {
      ...save,
      currentSeason: {
        ...save.currentSeason,
        teamStats: save.currentSeason.teamStats.map((stats, index) =>
          index === 0 ? { ...stats, offensiveYards: stats.offensiveYards + 1 } : stats),
      },
    };
    const duplicateStats = {
      ...save,
      currentSeason: {
        ...save.currentSeason,
        teamStats: [
          firstStats,
          {
            ...secondStats,
            teamId: firstStats.teamId,
          },
          ...save.currentSeason.teamStats.slice(2),
        ],
      },
    };

    expect(validateDynastySaveData(save)).toEqual([]);
    expect(validateDynastySaveData(staleStandings).map((issue) => issue.message))
      .toContain(`Dynasty standings row ${firstStats.teamId} does not match finalized game results`);
    expect(validateDynastySaveData(staleStats).map((issue) => issue.message))
      .toContain(`Dynasty team stats row ${firstStats.teamId} does not match finalized game results`);
    expect(validateDynastySaveData(duplicateStats).map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        `Dynasty team stats include duplicate team ${firstStats.teamId}`,
        `Dynasty team stats are missing team ${secondStats.teamId}`,
      ]),
    );
  });
});

function createSave(seed: string) {
  const league = generateLeagueData({ seed: 'dynasty-week-advance-league' });
  return createDynastySeasonCore({
    createdAt: '2026-06-24T12:00:00.000Z',
    seed,
    teams: league.teams,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}
