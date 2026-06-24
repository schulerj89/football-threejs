import { describe, expect, it } from 'vitest';
import { createDynastyProgramManagementPlan } from '../src/dynasty/DynastyProgramManagement';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import {
  simulateCurrentDynastyUserGame,
  simulateCurrentDynastyWeekNonUserGames,
} from '../src/dynasty/DynastyWeekAdvance';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty program management', () => {
  it('creates deterministic visible coach goals for the user program', () => {
    const save = createSave('dynasty-program-management-goals');
    const first = createDynastyProgramManagementPlan({ save });
    const second = createDynastyProgramManagementPlan({ save });

    expect(first).toEqual(second);
    expect(first.teamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(first.weekIndex).toBe(save.currentWeekIndex);
    expect(first.summaryLabel).toBe('0/4 coach goals complete | visible targets only');
    expect(first.coachGoals.map((goal) => goal.category)).toEqual([
      'season',
      'offense',
      'defense',
      'development',
    ]);
    expect(first.coachGoals.map((goal) => goal.title)).toEqual([
      'Reach Winning Standard',
      'Establish Offensive Identity',
      'Set Defensive Standard',
      'Develop Roster Identity',
    ]);
    expect(first.coachGoals.every((goal) =>
      goal.description.length > 0 &&
      goal.progressLabel.length > 0 &&
      goal.progressPercent >= 0 &&
      goal.progressPercent <= 100 &&
      goal.targetValue > 0)).toBe(true);
  });

  it('updates coach goal progress from season stats without changing gameplay outcomes', () => {
    const save = simulateCurrentDynastyUserGame(simulateCurrentDynastyWeekNonUserGames(
      createSave('dynasty-program-management-progress'),
    ).save).save;
    const plan = createDynastyProgramManagementPlan({ save });
    const offensiveGoal = plan.coachGoals.find((goal) => goal.category === 'offense')!;
    const defensiveGoal = plan.coachGoals.find((goal) => goal.category === 'defense')!;
    const developmentGoal = plan.coachGoals.find((goal) => goal.category === 'development')!;
    const userStats = save.currentSeason.teamStats.find((row) => row.teamId === DEFAULT_USER_TEAM_ID)!;

    expect(plan.summaryLabel).toMatch(/^\d\/4 coach goals complete \| visible targets only$/);
    expect(offensiveGoal.currentValue).toBe(Math.round(userStats.offensiveYards / userStats.gamesPlayed));
    expect(defensiveGoal.currentValue).toBe(Math.round(userStats.defensiveYards / userStats.gamesPlayed));
    expect(developmentGoal.currentValue).toBeGreaterThanOrEqual(0);
    expect(plan.coachGoals.every((goal) =>
      ['Complete', 'Needs attention', 'On track'].includes(goal.statusLabel))).toBe(true);
    expect(save.currentSeason.weeks[save.currentWeekIndex]?.games.some((game) =>
      game.status === 'scheduled')).toBe(false);
  });
});

function createSave(seed: string) {
  const league = generateLeagueData({ seed: 'dynasty-program-management-league' });
  return createDynastySeasonCore({
    createdAt: '2026-06-24T12:00:00.000Z',
    seed,
    teams: league.teams,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}
