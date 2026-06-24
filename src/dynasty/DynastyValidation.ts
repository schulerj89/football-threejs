import {
  DYNASTY_SAVE_SCHEMA_VERSION,
  DYNASTY_SEASON_CORE_VERSION,
  type DynastySaveData,
  type DynastyGameTeamStats,
  type DynastyProgressionApplication,
  type DynastyTeamRecord,
  type DynastyTeamSeasonStats,
} from './DynastyTypes';
import { isPlayerAttributeKey } from '../ratings/PlayerAttribute';
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
  if (!Array.isArray(season.progressionApplications)) {
    issues.push(error('Dynasty progression applications must be an array'));
  }
  const standingsTeamIds = new Set<string>();
  for (const record of season.standings) {
    if (!teamIds.has(record.teamId)) {
      issues.push(error(`Dynasty standings include unknown team ${record.teamId}`));
    }
    if (standingsTeamIds.has(record.teamId)) {
      issues.push(error(`Dynasty standings include duplicate team ${record.teamId}`));
    }
    standingsTeamIds.add(record.teamId);
    if (
      !isValidNonNegativeInteger(record.wins) ||
      !isValidNonNegativeInteger(record.losses) ||
      !isValidNonNegativeInteger(record.pointsFor) ||
      !isValidNonNegativeInteger(record.pointsAgainst)
    ) {
      issues.push(error(`Dynasty standings row ${record.teamId} contains invalid values`));
    } else if (
      record.wins < 0 ||
      record.losses < 0 ||
      record.pointsFor < 0 ||
      record.pointsAgainst < 0
    ) {
      issues.push(error(`Dynasty standings row ${record.teamId} contains negative values`));
    }
  }
  for (const teamId of teamIds) {
    if (!standingsTeamIds.has(teamId)) {
      issues.push(error(`Dynasty standings are missing team ${teamId}`));
    }
  }
  const statTeamIds = new Set<string>();
  for (const stats of season.teamStats ?? []) {
    if (!teamIds.has(stats.teamId)) {
      issues.push(error(`Dynasty team stats include unknown team ${stats.teamId}`));
    }
    if (statTeamIds.has(stats.teamId)) {
      issues.push(error(`Dynasty team stats include duplicate team ${stats.teamId}`));
    }
    statTeamIds.add(stats.teamId);
    if (
      !isValidNonNegativeInteger(stats.defensiveYards) ||
      !isValidNonNegativeInteger(stats.fieldGoals) ||
      !isValidNonNegativeInteger(stats.gamesPlayed) ||
      !isValidNonNegativeInteger(stats.giveaways) ||
      !isValidNonNegativeInteger(stats.offensiveYards) ||
      !isValidNonNegativeInteger(stats.passingYards) ||
      !isValidNonNegativeInteger(stats.pointsAgainst) ||
      !isValidNonNegativeInteger(stats.pointsFor) ||
      !isValidNonNegativeInteger(stats.rushingYards) ||
      !isValidNonNegativeInteger(stats.takeaways) ||
      !isValidNonNegativeInteger(stats.touchdowns)
    ) {
      issues.push(error(`Dynasty team stats row ${stats.teamId} contains invalid values`));
    } else if (stats.passingYards + stats.rushingYards !== stats.offensiveYards) {
      issues.push(error(`Dynasty team stats row ${stats.teamId} has mismatched offensive yards`));
    }
  }
  for (const teamId of teamIds) {
    if (!statTeamIds.has(teamId)) {
      issues.push(error(`Dynasty team stats are missing team ${teamId}`));
    }
  }

  const scheduledPairs = new Set<string>();
  const expectedRecords = new Map<string, DynastyTeamRecord>(
    season.teamIds.map((teamId) => [teamId, createEmptyRecord(teamId)]),
  );
  const expectedStats = new Map<string, DynastyTeamSeasonStats>(
    season.teamIds.map((teamId) => [teamId, createEmptyStats(teamId)]),
  );
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
        if (!isValidNonNegativeInteger(game.result.awayScore) || !isValidNonNegativeInteger(game.result.homeScore)) {
          issues.push(error(`${game.gameId} result contains invalid scores`));
        }
        validateGameStats(issues, `${game.gameId} away`, game.result.awayStats);
        validateGameStats(issues, `${game.gameId} home`, game.result.homeStats);
        accumulateExpectedGameResult(expectedRecords, expectedStats, game);
      }
    }
    if (weeklyTeamIds.size !== DYNASTY_SEASON_TEAM_COUNT) {
      issues.push(error(`${week.label} does not schedule every dynasty team`));
    }
  }
  if (scheduledPairs.size !== 15) {
    issues.push(error(`Dynasty round robin expected 15 unique matchups, received ${scheduledPairs.size}`));
  }
  validateAggregateRecords(issues, season.standings, expectedRecords);
  validateAggregateStats(issues, season.teamStats ?? [], expectedStats);
  validateProgressionApplications(issues, season.progressionApplications ?? [], teamIds, season.weeks.length);

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

function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
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

function accumulateExpectedGameResult(
  records: Map<string, DynastyTeamRecord>,
  stats: Map<string, DynastyTeamSeasonStats>,
  game: {
    readonly awayTeamId: string;
    readonly homeTeamId: string;
    readonly result: {
      readonly awayScore: number;
      readonly awayStats?: DynastyGameTeamStats;
      readonly homeScore: number;
      readonly homeStats?: DynastyGameTeamStats;
      readonly winnerTeamId: string;
    } | null;
  },
): void {
  const awayRecord = records.get(game.awayTeamId);
  const homeRecord = records.get(game.homeTeamId);
  const awayStats = stats.get(game.awayTeamId);
  const homeStats = stats.get(game.homeTeamId);
  if (!awayRecord || !homeRecord || !awayStats || !homeStats || !game.result?.awayStats || !game.result.homeStats) {
    return;
  }

  records.set(game.awayTeamId, {
    ...awayRecord,
    losses: awayRecord.losses + (game.result.winnerTeamId === game.homeTeamId ? 1 : 0),
    pointsAgainst: awayRecord.pointsAgainst + game.result.homeScore,
    pointsFor: awayRecord.pointsFor + game.result.awayScore,
    wins: awayRecord.wins + (game.result.winnerTeamId === game.awayTeamId ? 1 : 0),
  });
  records.set(game.homeTeamId, {
    ...homeRecord,
    losses: homeRecord.losses + (game.result.winnerTeamId === game.awayTeamId ? 1 : 0),
    pointsAgainst: homeRecord.pointsAgainst + game.result.awayScore,
    pointsFor: homeRecord.pointsFor + game.result.homeScore,
    wins: homeRecord.wins + (game.result.winnerTeamId === game.homeTeamId ? 1 : 0),
  });

  stats.set(game.awayTeamId, addExpectedStats(
    awayStats,
    game.result.awayStats,
    game.result.homeStats,
    game.result.awayScore,
    game.result.homeScore,
  ));
  stats.set(game.homeTeamId, addExpectedStats(
    homeStats,
    game.result.homeStats,
    game.result.awayStats,
    game.result.homeScore,
    game.result.awayScore,
  ));
}

function addExpectedStats(
  seasonStats: DynastyTeamSeasonStats,
  teamStats: DynastyGameTeamStats,
  opponentStats: DynastyGameTeamStats,
  pointsFor: number,
  pointsAgainst: number,
): DynastyTeamSeasonStats {
  return {
    defensiveYards: seasonStats.defensiveYards + opponentStats.offensiveYards,
    fieldGoals: seasonStats.fieldGoals + teamStats.fieldGoals,
    gamesPlayed: seasonStats.gamesPlayed + 1,
    giveaways: seasonStats.giveaways + teamStats.giveaways,
    offensiveYards: seasonStats.offensiveYards + teamStats.offensiveYards,
    passingYards: seasonStats.passingYards + teamStats.passingYards,
    pointsAgainst: seasonStats.pointsAgainst + pointsAgainst,
    pointsFor: seasonStats.pointsFor + pointsFor,
    rushingYards: seasonStats.rushingYards + teamStats.rushingYards,
    takeaways: seasonStats.takeaways + teamStats.takeaways,
    teamId: seasonStats.teamId,
    touchdowns: seasonStats.touchdowns + teamStats.touchdowns,
  };
}

function validateAggregateRecords(
  issues: DynastyValidationIssue[],
  records: readonly DynastyTeamRecord[],
  expectedRecords: ReadonlyMap<string, DynastyTeamRecord>,
): void {
  for (const record of records) {
    const expected = expectedRecords.get(record.teamId);
    if (!expected) {
      continue;
    }
    if (
      record.losses !== expected.losses ||
      record.pointsAgainst !== expected.pointsAgainst ||
      record.pointsFor !== expected.pointsFor ||
      record.wins !== expected.wins
    ) {
      issues.push(error(`Dynasty standings row ${record.teamId} does not match finalized game results`));
    }
  }
}

function validateAggregateStats(
  issues: DynastyValidationIssue[],
  statsRows: readonly DynastyTeamSeasonStats[],
  expectedStats: ReadonlyMap<string, DynastyTeamSeasonStats>,
): void {
  for (const stats of statsRows) {
    const expected = expectedStats.get(stats.teamId);
    if (!expected) {
      continue;
    }
    if (
      stats.defensiveYards !== expected.defensiveYards ||
      stats.fieldGoals !== expected.fieldGoals ||
      stats.gamesPlayed !== expected.gamesPlayed ||
      stats.giveaways !== expected.giveaways ||
      stats.offensiveYards !== expected.offensiveYards ||
      stats.passingYards !== expected.passingYards ||
      stats.pointsAgainst !== expected.pointsAgainst ||
      stats.pointsFor !== expected.pointsFor ||
      stats.rushingYards !== expected.rushingYards ||
      stats.takeaways !== expected.takeaways ||
      stats.touchdowns !== expected.touchdowns
    ) {
      issues.push(error(`Dynasty team stats row ${stats.teamId} does not match finalized game results`));
    }
  }
}

function validateProgressionApplications(
  issues: DynastyValidationIssue[],
  applications: readonly DynastyProgressionApplication[],
  teamIds: ReadonlySet<string>,
  weekCount: number,
): void {
  const appliedKeys = new Set<string>();
  for (const application of applications) {
    const key = `${application.teamId}:${application.weekIndex}:${application.playerId}`;
    if (appliedKeys.has(key)) {
      issues.push(error(`Dynasty progression application duplicates ${key}`));
    }
    appliedKeys.add(key);
    if (!teamIds.has(application.teamId)) {
      issues.push(error(`Dynasty progression application includes unknown team ${application.teamId}`));
    }
    if (
      !Number.isInteger(application.weekIndex) ||
      application.weekIndex < 0 ||
      application.weekIndex >= weekCount
    ) {
      issues.push(error(`Dynasty progression application ${application.playerId} has invalid week ${application.weekIndex}`));
    }
    if (!application.playerId) {
      issues.push(error('Dynasty progression application is missing a playerId'));
    }
    if (!application.appliedAt) {
      issues.push(error(`Dynasty progression application ${application.playerId} is missing appliedAt`));
    }
    if (
      !isBoundedInteger(application.performancePoints, 0, 100) ||
      !isBoundedInteger(application.currentOverall, 0, 99) ||
      !isBoundedInteger(application.projectedOverall, 0, 99)
    ) {
      issues.push(error(`Dynasty progression application ${application.playerId} contains invalid points or overall values`));
    }
    if (application.projectedOverall < application.currentOverall) {
      issues.push(error(`Dynasty progression application ${application.playerId} regresses projected overall`));
    }
    if (!Array.isArray(application.ratingDeltas) || application.ratingDeltas.length > 3) {
      issues.push(error(`Dynasty progression application ${application.playerId} has invalid rating deltas`));
      continue;
    }
    const attributes = new Set<string>();
    for (const delta of application.ratingDeltas) {
      if (!isPlayerAttributeKey(delta.attribute)) {
        issues.push(error(`Dynasty progression application ${application.playerId} has unknown attribute ${String(delta.attribute)}`));
      }
      if (attributes.has(delta.attribute)) {
        issues.push(error(`Dynasty progression application ${application.playerId} duplicates attribute ${delta.attribute}`));
      }
      attributes.add(delta.attribute);
      if (
        !isBoundedInteger(delta.currentValue, 0, 99) ||
        !isBoundedInteger(delta.projectedValue, 0, 99) ||
        !isBoundedInteger(delta.delta, 1, 3) ||
        delta.projectedValue - delta.currentValue !== delta.delta
      ) {
        issues.push(error(`Dynasty progression application ${application.playerId} has invalid ${String(delta.attribute)} delta`));
      }
    }
  }
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
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
