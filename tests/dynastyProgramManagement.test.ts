import { describe, expect, it } from 'vitest';
import {
  createDynastyProgramManagementPlan,
  validateDynastyProgramManagementPlan,
} from '../src/dynasty/DynastyProgramManagement';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import {
  simulateCurrentDynastyUserGame,
  simulateCurrentDynastyWeekNonUserGames,
} from '../src/dynasty/DynastyWeekAdvance';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import { createGameplayRosterBinding } from '../src/roster/GameplayRosterBinding';
import { getTeamRosterOrDefault } from '../src/roster/RosterRegistry';
import { DEFAULT_TEAM_PROFILE_SETTINGS } from '../src/teams/TeamProfileStore';
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
    expect(first.staffSummaryLabel).toBe('4 staff previews | no current-play effects');
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
    expect(first.staffModifiers).toHaveLength(4);
    expect(first.staffModifiers.map((modifier) => modifier.rank)).toEqual([1, 2, 3, 4]);
    expect(first.staffModifiers.map((modifier) => modifier.category).sort()).toEqual([
      'facilities',
      'gameManagement',
      'recruiting',
      'training',
    ]);
    expect(first.staffModifiers.every((modifier) =>
      modifier.bonusLabel === `+${modifier.bonusValue} future bonus` &&
      modifier.bonusValue >= 1 &&
      modifier.bonusValue <= 5 &&
      modifier.futureEffectLabel.startsWith('Future ') &&
      modifier.sourceLabel.length > 0)).toBe(true);
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
    const gameManagementStaff = plan.staffModifiers.find((modifier) => modifier.category === 'gameManagement')!;
    const recruitingStaff = plan.staffModifiers.find((modifier) => modifier.category === 'recruiting')!;
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
    expect(gameManagementStaff.sourceLabel).toContain('goals complete');
    expect(recruitingStaff.sourceLabel).toBe(recruitingBudget.rationaleLabel);
    expect(plan.staffModifiers[0]!.bonusValue).toBeGreaterThanOrEqual(plan.staffModifiers[1]!.bonusValue);
    expect(save.currentSeason.weeks[save.currentWeekIndex]?.games.some((game) =>
      game.status === 'scheduled')).toBe(false);
  });

  it('rejects malformed goals, invalid budget totals, hidden modifiers, and bad bonus values', () => {
    const plan = createDynastyProgramManagementPlan({
      save: createSave('dynasty-program-management-validation'),
    });
    const goal = plan.coachGoals[0]!;
    const budget = plan.budgetAllocations[0]!;
    const modifier = plan.staffModifiers[0]!;
    const cases: readonly [string, unknown, string][] = [
      [
        'malformed plan',
        null,
        'Dynasty program management plan is malformed',
      ],
      [
        'missing coach goals',
        { ...plan, coachGoals: 'bad-goals' },
        'Dynasty program management coach goals must be an array',
      ],
      [
        'malformed coach goal',
        { ...plan, coachGoals: [null] },
        'Dynasty program management coach goal row is malformed',
      ],
      [
        'duplicate coach goal',
        { ...plan, coachGoals: [goal, goal] },
        `Dynasty program management coach goal duplicates ${goal.category}`,
      ],
      [
        'invalid strength score',
        { ...plan, programStrengths: [{ ...plan.programStrengths[0]!, score: 120 }] },
        `Dynasty program management strength ${plan.programStrengths[0]!.category} has invalid score`,
      ],
      [
        'bad budget total',
        { ...plan, budgetAllocations: [{ ...budget, allocationPoints: budget.allocationPoints - 1 }, ...plan.budgetAllocations.slice(1)] },
        'Dynasty program management budget allocations total 99, expected 100',
      ],
      [
        'duplicate budget category',
        { ...plan, budgetAllocations: [budget, budget] },
        `Dynasty program management budget allocation duplicates ${budget.category}`,
      ],
      [
        'hidden budget modifier',
        { ...plan, budgetAllocations: [{ ...budget, futureEffectLabel: 'Current gameplay boost' }] },
        `Dynasty program management budget allocation ${budget.category} must be future-phase only`,
      ],
      [
        'bad staff bonus',
        { ...plan, staffModifiers: [{ ...modifier, bonusValue: 9 }] },
        `Dynasty program management staff modifier ${modifier.category} has invalid bonus`,
      ],
      [
        'hidden staff modifier',
        { ...plan, staffModifiers: [{ ...modifier, futureEffectLabel: 'Current gameplay boost' }] },
        `Dynasty program management staff modifier ${modifier.category} must be future-phase only`,
      ],
      [
        'missing future scope summary',
        { ...plan, budgetSummaryLabel: '100 budget points' },
        'Dynasty program management budget summary must declare future-phase scope',
      ],
      [
        'missing staff isolation summary',
        { ...plan, staffSummaryLabel: '4 staff previews' },
        'Dynasty program management staff summary must declare no current-play effects',
      ],
    ];

    expect(validateDynastyProgramManagementPlan(plan)).toEqual([]);
    for (const [label, invalidPlan, expectedMessage] of cases) {
      expect(validateDynastyProgramManagementPlan(invalidPlan).map((issue) => issue.message), label)
        .toContain(expectedMessage);
    }
  });

  it('keeps goals, budgets, strengths, and staff previews isolated from gameplay ratings and simulation', () => {
    const save = createSave('dynasty-program-management-gameplay-isolation');
    const baselineRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const baselineBinding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const baselineGameplay = snapshotGameplayModel(createGameplayModel({
      playbookId: '11v11',
      rosterBinding: baselineBinding,
    }));
    const baselineSimulation = simulateCurrentDynastyUserGame(
      simulateCurrentDynastyWeekNonUserGames(save).save,
    );
    const plan = createDynastyProgramManagementPlan({ save });
    const afterBinding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const afterGameplay = snapshotGameplayModel(createGameplayModel({
      playbookId: '11v11',
      rosterBinding: afterBinding,
    }));
    const afterRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const afterSimulation = simulateCurrentDynastyUserGame(
      simulateCurrentDynastyWeekNonUserGames(save).save,
    );

    expect(validateDynastyProgramManagementPlan(plan)).toEqual([]);
    expect(afterBinding.activeLineup.bindings).toEqual(baselineBinding.activeLineup.bindings);
    expect(afterGameplay.players.map((player) => [player.id, player.movement])).toEqual(
      baselineGameplay.players.map((player) => [player.id, player.movement]),
    );
    expect(afterRoster.players.map((player) => [player.id, player.ratings])).toEqual(
      baselineRoster.players.map((player) => [player.id, player.ratings]),
    );
    expect(afterSimulation).toEqual(baselineSimulation);
    expect(plan.budgetSummaryLabel).toContain('future-phase');
    expect(plan.staffSummaryLabel).toContain('no current-play effects');
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
