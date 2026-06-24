import {
  DYNASTY_SAVE_SCHEMA_VERSION,
  DYNASTY_SEASON_CORE_VERSION,
  type DynastySaveData,
} from './DynastyTypes';
import {
  DYNASTY_REGULAR_SEASON_WEEK_COUNT,
  DYNASTY_SEASON_TEAM_COUNT,
} from './DynastySchedule';

export interface DynastyValidationIssue {
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export function validateDynastySaveData(save: DynastySaveData): DynastyValidationIssue[] {
  const issues: DynastyValidationIssue[] = [];
  if (save.schemaVersion !== DYNASTY_SAVE_SCHEMA_VERSION) {
    issues.push(error(`Expected dynasty schema ${DYNASTY_SAVE_SCHEMA_VERSION}, received ${save.schemaVersion}`));
  }
  if (save.modeVersion !== DYNASTY_SEASON_CORE_VERSION) {
    issues.push(error(`Expected dynasty mode ${DYNASTY_SEASON_CORE_VERSION}, received ${save.modeVersion}`));
  }
  if (save.status !== 'active' && save.status !== 'complete') {
    issues.push(error(`Invalid dynasty status ${String(save.status)}`));
  }
  if (!save.saveId) {
    issues.push(error('Dynasty save is missing a saveId'));
  }
  if (!save.userTeamId) {
    issues.push(error('Dynasty save is missing a user team'));
  }

  const season = save.currentSeason;
  const teamIds = new Set(season.teamIds);
  if (teamIds.size !== DYNASTY_SEASON_TEAM_COUNT) {
    issues.push(error(`Dynasty season requires ${DYNASTY_SEASON_TEAM_COUNT} unique teams`));
  }
  if (!teamIds.has(save.userTeamId)) {
    issues.push(error(`Dynasty user team ${save.userTeamId} is not in the season`));
  }
  if (
    !Number.isInteger(save.currentWeekIndex) ||
    save.currentWeekIndex < 0 ||
    save.currentWeekIndex > season.weeks.length
  ) {
    issues.push(error(`Invalid dynasty week index ${save.currentWeekIndex}`));
  }
  if (season.weeks.length !== DYNASTY_REGULAR_SEASON_WEEK_COUNT) {
    issues.push(error(`Expected ${DYNASTY_REGULAR_SEASON_WEEK_COUNT} dynasty weeks, received ${season.weeks.length}`));
  }
  if (season.standings.length !== DYNASTY_SEASON_TEAM_COUNT) {
    issues.push(error(`Expected ${DYNASTY_SEASON_TEAM_COUNT} dynasty standings rows, received ${season.standings.length}`));
  }
  if (!Array.isArray(season.teamStats) || season.teamStats.length !== DYNASTY_SEASON_TEAM_COUNT) {
    issues.push(error(`Expected ${DYNASTY_SEASON_TEAM_COUNT} dynasty team stat rows, received ${season.teamStats?.length ?? 0}`));
  }
  for (const record of season.standings) {
    if (!teamIds.has(record.teamId)) {
      issues.push(error(`Dynasty standings include unknown team ${record.teamId}`));
    }
    if (
      record.wins < 0 ||
      record.losses < 0 ||
      record.pointsFor < 0 ||
      record.pointsAgainst < 0
    ) {
      issues.push(error(`Dynasty standings row ${record.teamId} contains negative values`));
    }
  }
  for (const stats of season.teamStats ?? []) {
    if (!teamIds.has(stats.teamId)) {
      issues.push(error(`Dynasty team stats include unknown team ${stats.teamId}`));
    }
    if (
      stats.defensiveYards < 0 ||
      stats.fieldGoals < 0 ||
      stats.gamesPlayed < 0 ||
      stats.giveaways < 0 ||
      stats.offensiveYards < 0 ||
      stats.passingYards < 0 ||
      stats.pointsAgainst < 0 ||
      stats.pointsFor < 0 ||
      stats.rushingYards < 0 ||
      stats.takeaways < 0 ||
      stats.touchdowns < 0
    ) {
      issues.push(error(`Dynasty team stats row ${stats.teamId} contains negative values`));
    }
    if (stats.passingYards + stats.rushingYards !== stats.offensiveYards) {
      issues.push(error(`Dynasty team stats row ${stats.teamId} has mismatched offensive yards`));
    }
  }

  const scheduledPairs = new Set<string>();
  for (const week of season.weeks) {
    if (week.weekIndex < 0 || week.weekIndex >= DYNASTY_REGULAR_SEASON_WEEK_COUNT) {
      issues.push(error(`Invalid dynasty week ${week.weekIndex}`));
    }
    if (week.games.length !== DYNASTY_SEASON_TEAM_COUNT / 2) {
      issues.push(error(`Dynasty ${week.label} must contain ${DYNASTY_SEASON_TEAM_COUNT / 2} games`));
    }
    const weeklyTeamIds = new Set<string>();
    for (const game of week.games) {
      if (game.weekIndex !== week.weekIndex) {
        issues.push(error(`${game.gameId} has mismatched week index`));
      }
      if (!teamIds.has(game.awayTeamId) || !teamIds.has(game.homeTeamId)) {
        issues.push(error(`${game.gameId} includes a team outside the season`));
      }
      if (game.awayTeamId === game.homeTeamId) {
        issues.push(error(`${game.gameId} schedules a team against itself`));
      }
      if (weeklyTeamIds.has(game.awayTeamId) || weeklyTeamIds.has(game.homeTeamId)) {
        issues.push(error(`${week.label} schedules a team more than once`));
      }
      weeklyTeamIds.add(game.awayTeamId);
      weeklyTeamIds.add(game.homeTeamId);
      scheduledPairs.add([game.awayTeamId, game.homeTeamId].sort().join(':'));
      if (game.status === 'final' && !game.result) {
        issues.push(error(`${game.gameId} is final without a result`));
      }
      if (game.status === 'scheduled' && game.result) {
        issues.push(error(`${game.gameId} is scheduled with a result`));
      }
      if (game.result && game.result.winnerTeamId !== game.awayTeamId && game.result.winnerTeamId !== game.homeTeamId) {
        issues.push(error(`${game.gameId} result winner is not in the game`));
      }
      if (game.result) {
        validateGameStats(issues, `${game.gameId} away`, game.result.awayStats);
        validateGameStats(issues, `${game.gameId} home`, game.result.homeStats);
      }
    }
    if (weeklyTeamIds.size !== DYNASTY_SEASON_TEAM_COUNT) {
      issues.push(error(`${week.label} does not schedule every dynasty team`));
    }
  }
  if (scheduledPairs.size !== 15) {
    issues.push(error(`Dynasty round robin expected 15 unique matchups, received ${scheduledPairs.size}`));
  }

  return issues;
}

export function throwOnDynastyValidationErrors(issues: readonly DynastyValidationIssue[]): void {
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((issue) => issue.message).join('; '));
  }
}

function error(message: string): DynastyValidationIssue {
  return { message, severity: 'error' };
}

function validateGameStats(
  issues: DynastyValidationIssue[],
  label: string,
  stats: {
    readonly fieldGoals?: number;
    readonly giveaways?: number;
    readonly offensiveYards?: number;
    readonly passingYards?: number;
    readonly rushingYards?: number;
    readonly takeaways?: number;
    readonly touchdowns?: number;
  } | undefined,
): void {
  if (!stats) {
    issues.push(error(`${label} result is missing team stats`));
    return;
  }
  const values = [
    stats.fieldGoals,
    stats.giveaways,
    stats.offensiveYards,
    stats.passingYards,
    stats.rushingYards,
    stats.takeaways,
    stats.touchdowns,
  ];
  if (values.some((value) => typeof value !== 'number' || !Number.isInteger(value) || value < 0)) {
    issues.push(error(`${label} result contains invalid team stats`));
  }
  if ((stats.passingYards ?? 0) + (stats.rushingYards ?? 0) !== stats.offensiveYards) {
    issues.push(error(`${label} result has mismatched offensive yards`));
  }
}
