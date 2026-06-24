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
    expect(first.strengthsSummaryLabel).toContain('leads the current identity profile');
    expect(first.budgetSummaryLabel).toBe('100 budget points | future-phase allocations only');
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
    expect(first.programStrengths).toHaveLength(5);
    expect(first.programStrengths.map((strength) => strength.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(first.programStrengths.map((strength) => strength.category).sort()).toEqual([
      'defensiveIdentity',
      'offensiveIdentity',
      'rosterCore',
      'seasonMomentum',
      'specialTeams',
    ]);
    expect(first.programStrengths.every((strength) =>
      strength.detailLabel.length > 0 &&
      strength.evidenceLabel.length > 0 &&
      strength.score >= 0 &&
      strength.score <= 99)).toBe(true);
    expect(first.budgetAllocations).toHaveLength(4);
    expect(first.budgetAllocations.map((allocation) => allocation.rank)).toEqual([1, 2, 3, 4]);
    expect(first.budgetAllocations.map((allocation) => allocation.category).sort()).toEqual([
      'facilities',
      'recruiting',
      'staff',
      'training',
    ]);
    expect(first.budgetAllocations.reduce((sum, allocation) => sum + allocation.allocationPoints, 0)).toBe(100);
    expect(first.budgetAllocations.every((allocation) =>
      allocation.allocationPoints > 0 &&
      allocation.futureEffectLabel.startsWith('Future ') &&
      allocation.priorityLabel.endsWith(' priority') &&
      allocation.rationaleLabel.length > 0)).toBe(true);
  });

  it('updates coach goal and program strength progress from season stats without changing gameplay outcomes', () => {
    const save = simulateCurrentDynastyUserGame(simulateCurrentDynastyWeekNonUserGames(
      createSave('dynasty-program-management-progress'),
    ).save).save;
    const plan = createDynastyProgramManagementPlan({ save });
    const offensiveGoal = plan.coachGoals.find((goal) => goal.category === 'offense')!;
    const defensiveGoal = plan.coachGoals.find((goal) => goal.category === 'defense')!;
    const developmentGoal = plan.coachGoals.find((goal) => goal.category === 'development')!;
    const offensiveStrength = plan.programStrengths.find((strength) => strength.category === 'offensiveIdentity')!;
    const defensiveStrength = plan.programStrengths.find((strength) => strength.category === 'defensiveIdentity')!;
    const momentumStrength = plan.programStrengths.find((strength) => strength.category === 'seasonMomentum')!;
    const staffBudget = plan.budgetAllocations.find((allocation) => allocation.category === 'staff')!;
    const recruitingBudget = plan.budgetAllocations.find((allocation) => allocation.category === 'recruiting')!;
    const userStats = save.currentSeason.teamStats.find((row) => row.teamId === DEFAULT_USER_TEAM_ID)!;
    const userRecord = save.currentSeason.standings.find((row) => row.teamId === DEFAULT_USER_TEAM_ID)!;

    expect(plan.summaryLabel).toMatch(/^\d\/4 coach goals complete \| visible targets only$/);
    expect(offensiveGoal.currentValue).toBe(Math.round(userStats.offensiveYards / userStats.gamesPlayed));
    expect(defensiveGoal.currentValue).toBe(Math.round(userStats.defensiveYards / userStats.gamesPlayed));
    expect(developmentGoal.currentValue).toBeGreaterThanOrEqual(0);
    expect(plan.coachGoals.every((goal) =>
      ['Complete', 'Needs attention', 'On track'].includes(goal.statusLabel))).toBe(true);
    expect(offensiveStrength.evidenceLabel).toBe(`${offensiveGoal.currentValue} offensive yds/gm`);
    expect(defensiveStrength.evidenceLabel).toBe(`${defensiveGoal.currentValue} defensive yds/gm`);
    expect(momentumStrength.detailLabel).toBe(`${userRecord.wins}-${userRecord.losses} record`);
    expect(plan.programStrengths[0]!.score).toBeGreaterThanOrEqual(plan.programStrengths[1]!.score);
    expect(plan.budgetAllocations.reduce((sum, allocation) => sum + allocation.allocationPoints, 0)).toBe(100);
    expect(staffBudget.rationaleLabel).toContain('open goals');
    expect(recruitingBudget.rationaleLabel).toContain(`${userRecord.wins}-${userRecord.losses} record`);
    expect(plan.budgetAllocations[0]!.allocationPoints).toBeGreaterThanOrEqual(
      plan.budgetAllocations[1]!.allocationPoints,
    );
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
