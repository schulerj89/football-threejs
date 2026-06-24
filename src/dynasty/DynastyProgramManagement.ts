import { calculateTeamRatings } from '../ratings/TeamRatingCalculator';
import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import type {
  DynastySaveData,
  DynastyTeamRecord,
  DynastyTeamSeasonStats,
} from './DynastyTypes';
import { createDynastyProgressionPreview } from './DynastyProgressionPreview';

export type DynastyCoachGoalCategory =
  | 'defense'
  | 'development'
  | 'offense'
  | 'season';

export interface DynastyCoachGoal {
  readonly category: DynastyCoachGoalCategory;
  readonly currentValue: number;
  readonly description: string;
  readonly progressLabel: string;
  readonly progressPercent: number;
  readonly statusLabel: string;
  readonly targetValue: number;
  readonly title: string;
}

export type DynastyProgramStrengthCategory =
  | 'defensiveIdentity'
  | 'offensiveIdentity'
  | 'rosterCore'
  | 'seasonMomentum'
  | 'specialTeams';

export interface DynastyProgramStrength {
  readonly category: DynastyProgramStrengthCategory;
  readonly detailLabel: string;
  readonly evidenceLabel: string;
  readonly rank: number;
  readonly score: number;
  readonly title: string;
}

export type DynastyProgramBudgetCategory =
  | 'facilities'
  | 'recruiting'
  | 'staff'
  | 'training';

export interface DynastyProgramBudgetAllocation {
  readonly allocationPoints: number;
  readonly category: DynastyProgramBudgetCategory;
  readonly futureEffectLabel: string;
  readonly priorityLabel: string;
  readonly rank: number;
  readonly rationaleLabel: string;
  readonly title: string;
}

export type DynastyStaffModifierCategory =
  | 'facilities'
  | 'gameManagement'
  | 'recruiting'
  | 'training';

export interface DynastyStaffModifierPreview {
  readonly bonusLabel: string;
  readonly bonusValue: number;
  readonly category: DynastyStaffModifierCategory;
  readonly futureEffectLabel: string;
  readonly rank: number;
  readonly sourceLabel: string;
  readonly title: string;
}

export interface DynastyProgramManagementPlan {
  readonly budgetAllocations: readonly DynastyProgramBudgetAllocation[];
  readonly budgetSummaryLabel: string;
  readonly coachGoals: readonly DynastyCoachGoal[];
  readonly programStrengths: readonly DynastyProgramStrength[];
  readonly staffModifiers: readonly DynastyStaffModifierPreview[];
  readonly staffSummaryLabel: string;
  readonly summaryLabel: string;
  readonly strengthsSummaryLabel: string;
  readonly teamId: string;
  readonly weekIndex: number;
}

export function createDynastyProgramManagementPlan(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyProgramManagementPlan {
  const teamId = options.teamId ?? options.save.userTeamId;
  const stats = options.save.currentSeason.teamStats.find((row) => row.teamId === teamId) ??
    createEmptyStats(teamId);
  const record = options.save.currentSeason.standings.find((row) => row.teamId === teamId) ??
    createEmptyRecord(teamId);
  const seasonWinTarget = Math.ceil(options.save.currentSeason.weeks.length * 0.6);
  const offensiveYardsPerGame = stats.gamesPlayed > 0
    ? Math.round(stats.offensiveYards / stats.gamesPlayed)
    : 0;
  const defensiveYardsAllowedPerGame = stats.gamesPlayed > 0
    ? Math.round(stats.defensiveYards / stats.gamesPlayed)
    : 0;
  const progression = createDynastyProgressionPreview({
    save: options.save,
    teamId,
  });
  const developmentReadyCount = progression.rows.filter((row) => row.ratingDeltas.length > 0).length;
  const programStrengths = createProgramStrengths({
    record,
    stats,
    teamId,
  });
  const coachGoals = [
    createAtLeastGoal({
      category: 'season',
      currentValue: record.wins,
      description: `Reach ${seasonWinTarget} wins in the starter Dynasty regular season.`,
      labelSuffix: 'wins',
      targetValue: seasonWinTarget,
      title: 'Reach Winning Standard',
    }),
    createAtLeastGoal({
      category: 'offense',
      currentValue: offensiveYardsPerGame,
      description: 'Build a weekly offensive identity without hidden comeback logic.',
      labelSuffix: 'yds/gm',
      targetValue: 325,
      title: 'Establish Offensive Identity',
    }),
    createAtMostGoal({
      category: 'defense',
      currentValue: defensiveYardsAllowedPerGame,
      description: 'Keep opponents below the program defensive yardage standard.',
      labelSuffix: 'yds allowed/gm',
      targetValue: 260,
      title: 'Set Defensive Standard',
    }),
    createAtLeastGoal({
      category: 'development',
      currentValue: developmentReadyCount,
      description: 'Keep a visible weekly player-development target for the staff.',
      labelSuffix: 'players',
      targetValue: 4,
      title: 'Develop Roster Identity',
    }),
  ] as const satisfies readonly DynastyCoachGoal[];
  const completedGoals = coachGoals.filter((goal) => goal.statusLabel === 'Complete').length;
  const budgetAllocations = createBudgetAllocations({
    coachGoals,
    developmentReadyCount,
    record,
    stats,
    teamId,
  });
  const staffModifiers = createStaffModifierPreviews({
    budgetAllocations,
    coachGoals,
    programStrengths,
  });

  return {
    budgetAllocations,
    budgetSummaryLabel: `${budgetAllocations.reduce((sum, allocation) => sum + allocation.allocationPoints, 0)} budget points | future-phase allocations only`,
    coachGoals,
    programStrengths,
    staffModifiers,
    staffSummaryLabel: `${staffModifiers.length} staff previews | no current-play effects`,
    summaryLabel: `${completedGoals}/${coachGoals.length} coach goals complete | visible targets only`,
    strengthsSummaryLabel: `${programStrengths[0]?.title ?? 'Program'} leads the current identity profile`,
    teamId,
    weekIndex: options.save.currentWeekIndex,
  };
}

function createStaffModifierPreviews(options: {
  readonly budgetAllocations: readonly DynastyProgramBudgetAllocation[];
  readonly coachGoals: readonly DynastyCoachGoal[];
  readonly programStrengths: readonly DynastyProgramStrength[];
}): DynastyStaffModifierPreview[] {
  const budgetByCategory = new Map(options.budgetAllocations.map((allocation) => [
    allocation.category,
    allocation,
  ]));
  const completedGoals = options.coachGoals.filter((goal) => goal.statusLabel === 'Complete').length;
  const topStrength = options.programStrengths[0];
  const rows = [
    createStaffModifier({
      budget: budgetByCategory.get('recruiting'),
      category: 'recruiting',
      futureEffectLabel: 'Future recruiting board bonus',
      sourceLabel: budgetByCategory.get('recruiting')?.rationaleLabel ?? 'Recruiting budget pending',
      title: 'Recruiting Coordinator',
    }),
    createStaffModifier({
      budget: budgetByCategory.get('training'),
      category: 'training',
      futureEffectLabel: 'Future weekly training bonus',
      sourceLabel: budgetByCategory.get('training')?.rationaleLabel ?? 'Training budget pending',
      title: 'Player Development Lead',
    }),
    createStaffModifier({
      budget: budgetByCategory.get('facilities'),
      category: 'facilities',
      futureEffectLabel: 'Future facilities bonus',
      sourceLabel: budgetByCategory.get('facilities')?.rationaleLabel ?? 'Facilities budget pending',
      title: 'Facilities Director',
    }),
    createStaffModifier({
      budget: budgetByCategory.get('staff'),
      category: 'gameManagement',
      futureEffectLabel: 'Future staff planning bonus',
      sourceLabel: `${completedGoals}/${options.coachGoals.length} goals complete | ${topStrength?.title ?? 'No strength'} identity`,
      title: 'Game Management Analyst',
    }),
  ] as const satisfies readonly Omit<DynastyStaffModifierPreview, 'bonusLabel' | 'bonusValue' | 'rank'>[];

  return rows
    .map((row) => {
      const bonusValue = clampStaffBonus(Math.round((row.budget?.allocationPoints ?? 0) / 8));
      const { budget, ...staffRow } = row;
      return {
        ...staffRow,
        bonusLabel: `+${bonusValue} future bonus`,
        bonusValue,
      };
    })
    .sort((a, b) =>
      b.bonusValue - a.bonusValue ||
      a.title.localeCompare(b.title))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

function createStaffModifier(options: {
  readonly budget: DynastyProgramBudgetAllocation | undefined;
  readonly category: DynastyStaffModifierCategory;
  readonly futureEffectLabel: string;
  readonly sourceLabel: string;
  readonly title: string;
}): Omit<DynastyStaffModifierPreview, 'bonusLabel' | 'bonusValue' | 'rank'> & {
  readonly budget: DynastyProgramBudgetAllocation | undefined;
} {
  return {
    budget: options.budget,
    category: options.category,
    futureEffectLabel: options.futureEffectLabel,
    sourceLabel: options.sourceLabel,
    title: options.title,
  };
}

function createBudgetAllocations(options: {
  readonly coachGoals: readonly DynastyCoachGoal[];
  readonly developmentReadyCount: number;
  readonly record: DynastyTeamRecord;
  readonly stats: DynastyTeamSeasonStats;
  readonly teamId: string;
}): DynastyProgramBudgetAllocation[] {
  const ratings = calculateTeamRatings(getTeamRosterOrDefault(options.teamId));
  const incompleteGoals = options.coachGoals.filter((goal) => goal.statusLabel !== 'Complete').length;
  const games = Math.max(1, options.stats.gamesPlayed);
  const defensiveYardsAllowedPerGame = options.stats.gamesPlayed > 0
    ? Math.round(options.stats.defensiveYards / games)
    : 0;
  const rawRows = [
    {
      category: 'recruiting',
      futureEffectLabel: 'Future recruiting-board emphasis',
      priorityScore: 24 +
        Math.max(0, 80 - ratings.overall) * 0.55 +
        Math.max(0, options.record.losses - options.record.wins) * 4,
      rationaleLabel: `${ratings.overall} roster OVR | ${options.record.wins}-${options.record.losses} record`,
      title: 'Recruiting',
    },
    {
      category: 'training',
      futureEffectLabel: 'Future weekly development emphasis',
      priorityScore: 24 +
        options.developmentReadyCount * 1.8 +
        Math.max(0, 82 - ratings.offense) * 0.35,
      rationaleLabel: `${options.developmentReadyCount} players ready | ${ratings.offense} offense`,
      title: 'Training',
    },
    {
      category: 'facilities',
      futureEffectLabel: 'Future facilities investment emphasis',
      priorityScore: 24 +
        Math.max(0, 82 - ratings.specialTeams) * 0.45 +
        Math.max(0, defensiveYardsAllowedPerGame - 260) * 0.05,
      rationaleLabel: `${ratings.specialTeams} special teams | ${defensiveYardsAllowedPerGame} yds allowed/gm`,
      title: 'Facilities',
    },
    {
      category: 'staff',
      futureEffectLabel: 'Future staff bonus emphasis',
      priorityScore: 24 +
        incompleteGoals * 3.5 +
        Math.max(0, 82 - ratings.defense) * 0.35,
      rationaleLabel: `${incompleteGoals} open goals | ${ratings.defense} defense`,
      title: 'Staff',
    },
  ] as const satisfies readonly {
    readonly category: DynastyProgramBudgetCategory;
    readonly futureEffectLabel: string;
    readonly priorityScore: number;
    readonly rationaleLabel: string;
    readonly title: string;
  }[];
  const allocations = distributeBudget(rawRows.map((row) => row.priorityScore), 100);

  return rawRows
    .map((row, index) => ({
      allocationPoints: allocations[index] ?? 0,
      category: row.category,
      futureEffectLabel: row.futureEffectLabel,
      priorityLabel: `${Math.round(row.priorityScore)} priority`,
      rationaleLabel: row.rationaleLabel,
      title: row.title,
    }))
    .sort((a, b) =>
      b.allocationPoints - a.allocationPoints ||
      a.title.localeCompare(b.title))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

function createProgramStrengths(options: {
  readonly record: DynastyTeamRecord;
  readonly stats: DynastyTeamSeasonStats;
  readonly teamId: string;
}): DynastyProgramStrength[] {
  const roster = getTeamRosterOrDefault(options.teamId);
  const ratings = calculateTeamRatings(roster);
  const games = Math.max(1, options.stats.gamesPlayed);
  const offensiveYardsPerGame = options.stats.gamesPlayed > 0
    ? Math.round(options.stats.offensiveYards / games)
    : 0;
  const defensiveYardsAllowedPerGame = options.stats.gamesPlayed > 0
    ? Math.round(options.stats.defensiveYards / games)
    : 0;
  const winPercent = (options.record.wins + options.record.losses) > 0
    ? options.record.wins / (options.record.wins + options.record.losses)
    : 0;
  const pointsMarginPerGame = options.stats.gamesPlayed > 0
    ? Math.round((options.stats.pointsFor - options.stats.pointsAgainst) / games)
    : 0;
  const rows = [
    {
      category: 'rosterCore',
      detailLabel: `${ratings.overall} OVR roster core`,
      evidenceLabel: `${ratings.offense} offense | ${ratings.defense} defense`,
      score: ratings.overall,
      title: 'Roster Core',
    },
    {
      category: 'offensiveIdentity',
      detailLabel: `${ratings.passing} pass | ${ratings.rushing} rush | ${ratings.blocking} block`,
      evidenceLabel: options.stats.gamesPlayed > 0
        ? `${offensiveYardsPerGame} offensive yds/gm`
        : 'No offensive game sample',
      score: clampProgramScore(Math.round(
        ratings.offense * 0.65 + normalizeRange(offensiveYardsPerGame, 220, 425) * 0.35,
      )),
      title: 'Offensive Identity',
    },
    {
      category: 'defensiveIdentity',
      detailLabel: `${ratings.passRush} rush | ${ratings.coverage} coverage`,
      evidenceLabel: options.stats.gamesPlayed > 0
        ? `${defensiveYardsAllowedPerGame} defensive yds/gm`
        : 'No defensive game sample',
      score: clampProgramScore(Math.round(
        ratings.defense * 0.65 + normalizeInverseRange(defensiveYardsAllowedPerGame, 200, 390) * 0.35,
      )),
      title: 'Defensive Identity',
    },
    {
      category: 'seasonMomentum',
      detailLabel: `${options.record.wins}-${options.record.losses} record`,
      evidenceLabel: `${formatSigned(pointsMarginPerGame)} point margin/gm`,
      score: clampProgramScore(Math.round(60 + winPercent * 30 + pointsMarginPerGame * 0.45)),
      title: 'Season Momentum',
    },
    {
      category: 'specialTeams',
      detailLabel: `${ratings.specialTeams} special teams rating`,
      evidenceLabel: `${options.stats.fieldGoals} FG | ${options.stats.touchdowns} team TD`,
      score: ratings.specialTeams,
      title: 'Special Teams',
    },
  ] as const satisfies readonly Omit<DynastyProgramStrength, 'rank'>[];

  return [...rows]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

function createAtLeastGoal(options: {
  readonly category: DynastyCoachGoalCategory;
  readonly currentValue: number;
  readonly description: string;
  readonly labelSuffix: string;
  readonly targetValue: number;
  readonly title: string;
}): DynastyCoachGoal {
  const progressPercent = clampPercent(Math.round((options.currentValue / options.targetValue) * 100));

  return {
    category: options.category,
    currentValue: options.currentValue,
    description: options.description,
    progressLabel: `${options.currentValue}/${options.targetValue} ${options.labelSuffix}`,
    progressPercent,
    statusLabel: createStatusLabel(progressPercent),
    targetValue: options.targetValue,
    title: options.title,
  };
}

function createAtMostGoal(options: {
  readonly category: DynastyCoachGoalCategory;
  readonly currentValue: number;
  readonly description: string;
  readonly labelSuffix: string;
  readonly targetValue: number;
  readonly title: string;
}): DynastyCoachGoal {
  const progressPercent = options.currentValue <= 0
    ? 0
    : clampPercent(Math.round((options.targetValue / Math.max(options.targetValue, options.currentValue)) * 100));

  return {
    category: options.category,
    currentValue: options.currentValue,
    description: options.description,
    progressLabel: `${options.currentValue}/${options.targetValue} ${options.labelSuffix}`,
    progressPercent,
    statusLabel: options.currentValue > 0 && options.currentValue <= options.targetValue
      ? 'Complete'
      : createStatusLabel(progressPercent),
    targetValue: options.targetValue,
    title: options.title,
  };
}

function createStatusLabel(progressPercent: number): string {
  if (progressPercent >= 100) {
    return 'Complete';
  }
  if (progressPercent >= 50) {
    return 'On track';
  }
  return 'Needs attention';
}

function createEmptyStats(teamId: string): DynastyTeamSeasonStats {
  return {
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
  };
}

function createEmptyRecord(teamId: string): DynastyTeamRecord {
  return {
    losses: 0,
    pointsAgainst: 0,
    pointsFor: 0,
    teamId,
    wins: 0,
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampProgramScore(value: number): number {
  return Math.max(0, Math.min(99, value));
}

function clampStaffBonus(value: number): number {
  return Math.max(1, Math.min(5, value));
}

function normalizeRange(value: number, min: number, max: number): number {
  if (value <= min) {
    return 55;
  }
  if (value >= max) {
    return 99;
  }
  return 55 + ((value - min) / (max - min)) * 44;
}

function normalizeInverseRange(value: number, best: number, worst: number): number {
  if (value <= 0) {
    return 55;
  }
  if (value <= best) {
    return 99;
  }
  if (value >= worst) {
    return 55;
  }
  return 99 - ((value - best) / (worst - best)) * 44;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function distributeBudget(rawScores: readonly number[], totalPoints: number): number[] {
  const scoreTotal = rawScores.reduce((sum, score) => sum + Math.max(0, score), 0);
  if (scoreTotal <= 0 || rawScores.length === 0) {
    return [];
  }
  const preliminary = rawScores.map((score) => Math.floor((Math.max(0, score) / scoreTotal) * totalPoints));
  let remainder = totalPoints - preliminary.reduce((sum, points) => sum + points, 0);
  const order = rawScores
    .map((score, index) => ({ index, score }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  for (let cursor = 0; remainder > 0; cursor = (cursor + 1) % order.length) {
    preliminary[order[cursor]!.index] += 1;
    remainder -= 1;
  }
  return preliminary;
}
