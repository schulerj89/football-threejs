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

export interface DynastyProgramManagementPlan {
  readonly coachGoals: readonly DynastyCoachGoal[];
  readonly summaryLabel: string;
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

  return {
    coachGoals,
    summaryLabel: `${completedGoals}/${coachGoals.length} coach goals complete | visible targets only`,
    teamId,
    weekIndex: options.save.currentWeekIndex,
  };
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
