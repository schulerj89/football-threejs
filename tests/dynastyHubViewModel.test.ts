import { describe, expect, it } from 'vitest';
import { createDynastyHubViewModel } from '../src/dynasty/DynastyHubViewModel';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import { simulateCurrentDynastyWeekNonUserGames } from '../src/dynasty/DynastyWeekAdvance';
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
    expect(view.storySummary).toContain('Week 1');
    expect(view.storySummary).toContain('0-0');
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

  it('summarizes weekly leaders from season team stats', () => {
    const league = generateLeagueData({ seed: 'dynasty-hub-league' });
    const save = simulateCurrentDynastyWeekNonUserGames(createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'dynasty-hub-leaders',
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    })).save;
    const view = createDynastyHubViewModel({ league, save });

    expect(view.leaders.map((leader) => leader.category)).toEqual([
      'Total Offense',
      'Passing',
      'Rushing',
      'Scoring',
      'Turnover Margin',
    ]);
    expect(view.leaders).toHaveLength(5);
    expect(view.leaders.every((leader) => leader.rank === 1)).toBe(true);
    expect(view.leaders[0]?.value).toBeGreaterThan(0);
    expect(view.leaders[0]?.valueLabel).toMatch(/yds$/);
    expect(view.progressionPreview).toHaveLength(5);
    expect(view.progressionPreview[0]?.performancePoints).toBeGreaterThanOrEqual(
      view.progressionPreview[4]?.performancePoints ?? 0,
    );
    expect(view.progressionPreview[0]?.projectedOverall).toBeGreaterThanOrEqual(
      view.progressionPreview[0]?.currentOverall ?? 0,
    );
    expect(view.progressionSummaryLabel).toContain('presentation-only points');
    expect(view.trainingSummary).toHaveLength(4);
    expect(view.trainingSummary[0]?.focusLabel).toMatch(/ focus$/);
  });

  it('formats turnover margin leaders with a signed value', () => {
    const league = generateLeagueData({ seed: 'dynasty-hub-league' });
    const save = createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'dynasty-hub-turnover-leader',
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
          teamStats: [
            {
              defensiveYards: 250,
              fieldGoals: 1,
              gamesPlayed: 1,
              giveaways: 0,
              offensiveYards: 400,
              passingYards: 260,
              pointsAgainst: 14,
              pointsFor: 31,
              rushingYards: 140,
              takeaways: 3,
              teamId: secondTeam!,
              touchdowns: 4,
            },
            {
              defensiveYards: 270,
              fieldGoals: 2,
              gamesPlayed: 1,
              giveaways: 2,
              offensiveYards: 380,
              passingYards: 220,
              pointsAgainst: 21,
              pointsFor: 28,
              rushingYards: 160,
              takeaways: 2,
              teamId: firstTeam!,
              touchdowns: 3,
            },
            ...rest.map((teamId) => ({
              defensiveYards: 0,
              fieldGoals: 0,
              gamesPlayed: 0,
              giveaways: 0,
              offensiveYards: 0,
              passingYards: 0,
              pointsAgainst: 0,
              pointsFor: 0,
              rushingYards: 0,
              takeaways: 0,
              teamId,
              touchdowns: 0,
            })),
          ],
        },
      },
    });
    const turnoverLeader = view.leaders.find((leader) => leader.category === 'Turnover Margin');

    expect(turnoverLeader?.team.teamId).toBe(secondTeam);
    expect(turnoverLeader?.value).toBe(3);
    expect(turnoverLeader?.valueLabel).toBe('+3');
  });

  it('builds award watch rows from season team stats', () => {
    const league = generateLeagueData({ seed: 'dynasty-hub-league' });
    const save = createDynastySeasonCore({
      createdAt: '2026-06-24T12:00:00.000Z',
      seed: 'dynasty-hub-awards',
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const [firstTeam, secondTeam, thirdTeam, ...rest] = save.currentSeason.teamIds;
    const view = createDynastyHubViewModel({
      league,
      save: {
        ...save,
        currentSeason: {
          ...save.currentSeason,
          teamStats: [
            {
              defensiveYards: 320,
              fieldGoals: 0,
              gamesPlayed: 1,
              giveaways: 1,
              offensiveYards: 520,
              passingYards: 330,
              pointsAgainst: 28,
              pointsFor: 42,
              rushingYards: 190,
              takeaways: 1,
              teamId: firstTeam!,
              touchdowns: 6,
            },
            {
              defensiveYards: 90,
              fieldGoals: 1,
              gamesPlayed: 1,
              giveaways: 0,
              offensiveYards: 210,
              passingYards: 130,
              pointsAgainst: 7,
              pointsFor: 17,
              rushingYards: 80,
              takeaways: 10,
              teamId: secondTeam!,
              touchdowns: 2,
            },
            {
              defensiveYards: 240,
              fieldGoals: 5,
              gamesPlayed: 1,
              giveaways: 1,
              offensiveYards: 260,
              passingYards: 180,
              pointsAgainst: 20,
              pointsFor: 22,
              rushingYards: 80,
              takeaways: 2,
              teamId: thirdTeam!,
              touchdowns: 1,
            },
            ...rest.map((teamId) => ({
              defensiveYards: 300,
              fieldGoals: 0,
              gamesPlayed: 0,
              giveaways: 0,
              offensiveYards: 0,
              passingYards: 0,
              pointsAgainst: 28,
              pointsFor: 0,
              rushingYards: 0,
              takeaways: 0,
              teamId,
              touchdowns: 0,
            })),
          ],
        },
      },
    });

    expect(view.awardWatch.map((row) => row.award)).toEqual([
      'Offensive Unit',
      'Defensive Unit',
      'Special Teams',
    ]);
    expect(view.awardWatch.find((row) => row.award === 'Offensive Unit')?.team.teamId).toBe(firstTeam);
    expect(view.awardWatch.find((row) => row.award === 'Defensive Unit')?.team.teamId).toBe(secondTeam);
    expect(view.awardWatch.find((row) => row.award === 'Special Teams')?.team.teamId).toBe(thirdTeam);
    expect(view.awardWatch.find((row) => row.award === 'Defensive Unit')?.valueLabel)
      .toBe('90 yds allowed, 10 takeaways');
  });
});
