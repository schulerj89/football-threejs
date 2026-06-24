import { describe, expect, it } from 'vitest';
import { createDynastyHubViewModel } from '../src/dynasty/DynastyHubViewModel';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty hub view model', () => {
  it('summarizes the current user program, week, schedule, and standings', () => {
    const league = generateLeagueData({ seed: 'dynasty-hub-league' });
    const save = createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'dynasty-hub',
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const view = createDynastyHubViewModel({ league, save });

    expect(view.program.teamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(view.program.recordLabel).toBe('0-0');
    expect(view.currentWeekLabel).toBe('Week 1');
    expect(view.seasonLabel).toBe('2026 Season');
    expect(view.upcomingGame?.weekLabel).toBe('Week 1');
    expect(view.upcomingGame?.userOpponentLabel).toMatch(/^(at|vs) .+/);
    expect(view.schedule).toHaveLength(5);
    expect(view.schedule.every((game) => game.matchupLabel.includes(' at '))).toBe(true);
    expect(view.standings).toHaveLength(6);
    expect(view.standings.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('sorts standings by wins, losses, margin, then name', () => {
    const league = generateLeagueData({ seed: 'dynasty-hub-league' });
    const save = createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'dynasty-hub-standings',
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const [firstTeam, secondTeam, ...rest] = save.currentSeason.teamIds;
    const view = createDynastyHubViewModel({
      league,
      save: {
        ...save,
        currentSeason: {
          ...save.currentSeason,
          standings: [
            {
              losses: 0,
              pointsAgainst: 10,
              pointsFor: 31,
              teamId: secondTeam!,
              wins: 1,
            },
            {
              losses: 0,
              pointsAgainst: 21,
              pointsFor: 28,
              teamId: firstTeam!,
              wins: 1,
            },
            ...rest.map((teamId) => ({
              losses: 0,
              pointsAgainst: 0,
              pointsFor: 0,
              teamId,
              wins: 0,
            })),
          ],
        },
      },
    });

    expect(view.standings[0]?.team.teamId).toBe(secondTeam);
    expect(view.standings[0]?.pointsMargin).toBe(21);
    expect(view.standings[1]?.team.teamId).toBe(firstTeam);
  });
});
