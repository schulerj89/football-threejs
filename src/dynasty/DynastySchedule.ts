import {
  DYNASTY_SAVE_SCHEMA_VERSION,
  DYNASTY_SEASON_CORE_VERSION,
  type DynastySaveData,
  type DynastyScheduledGame,
  type DynastySeason,
  type DynastySeasonCoreInput,
  type DynastyTeamSeasonStats,
  type DynastyTeamRecord,
  type DynastyWeek,
} from './DynastyTypes';

export const DYNASTY_SEASON_TEAM_COUNT = 6;
export const DYNASTY_REGULAR_SEASON_WEEK_COUNT = DYNASTY_SEASON_TEAM_COUNT - 1;

export function createDynastySeasonCore(input: DynastySeasonCoreInput): DynastySaveData {
  const teamIds = resolveDynastyTeamIds(input.teams, input.userTeamId);
  const year = input.seasonYear ?? 2026;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const season = createDynastySeason({
    seed: input.seed,
    teamIds,
    year,
  });

  return {
    createdAt,
    currentSeason: season,
    currentWeekIndex: 0,
    modeVersion: DYNASTY_SEASON_CORE_VERSION,
    saveId: createStableSaveId(input.seed, input.userTeamId, year),
    schemaVersion: DYNASTY_SAVE_SCHEMA_VERSION,
    seed: input.seed,
    status: 'active',
    updatedAt: createdAt,
    userTeamId: input.userTeamId,
  };
}

export function createDynastySeason(options: {
  readonly seed: string;
  readonly teamIds: readonly string[];
  readonly year: number;
}): DynastySeason {
  const teamIds = normalizeTeamIds(options.teamIds);
  const seededTeams = seededShuffle(teamIds, `${options.seed}:teams:${options.year}`);
  const weeks = createRoundRobinWeeks(seededTeams, options.seed);

  return {
    progressionApplications: [],
    seasonId: `dynasty-season-${options.year}-${hashText(`${options.seed}:${teamIds.join('|')}`)}`,
    standings: teamIds.map(createEmptyRecord),
    teamIds,
    teamStats: teamIds.map(createEmptyTeamStats),
    weeks,
    year: options.year,
  };
}

function resolveDynastyTeamIds(
  teams: DynastySeasonCoreInput['teams'],
  userTeamId: string,
): string[] {
  const teamIds = normalizeTeamIds(teams.map((team) => team.id));
  if (!teamIds.includes(userTeamId)) {
    throw new Error(`Dynasty user team ${userTeamId} is not in league teams`);
  }
  return teamIds;
}

function normalizeTeamIds(teamIds: readonly string[]): string[] {
  const unique = [...new Set(teamIds)].filter((teamId) => teamId.length > 0).sort();
  if (unique.length !== DYNASTY_SEASON_TEAM_COUNT) {
    throw new Error(
      `Dynasty season requires exactly ${DYNASTY_SEASON_TEAM_COUNT} teams, received ${unique.length}`,
    );
  }
  return unique;
}

function createRoundRobinWeeks(
  seededTeams: readonly string[],
  seed: string,
): DynastyWeek[] {
  const fixedTeam = seededTeams[0]!;
  let rotatingTeams = seededTeams.slice(1);
  const weeks: DynastyWeek[] = [];

  for (let weekIndex = 0; weekIndex < DYNASTY_REGULAR_SEASON_WEEK_COUNT; weekIndex += 1) {
    const weeklyTeams = [fixedTeam, ...rotatingTeams];
    const games: DynastyScheduledGame[] = [];

    for (let gameIndex = 0; gameIndex < DYNASTY_SEASON_TEAM_COUNT / 2; gameIndex += 1) {
      const firstTeamId = weeklyTeams[gameIndex]!;
      const secondTeamId = weeklyTeams[DYNASTY_SEASON_TEAM_COUNT - 1 - gameIndex]!;
      const swapHome = hashToUnit(`${seed}:home:${weekIndex}:${firstTeamId}:${secondTeamId}`) >= 0.5;
      const homeTeamId = swapHome ? secondTeamId : firstTeamId;
      const awayTeamId = swapHome ? firstTeamId : secondTeamId;
      games.push({
        awayTeamId,
        gameId: `dynasty-w${weekIndex + 1}-g${gameIndex + 1}-${awayTeamId}-at-${homeTeamId}`,
        homeTeamId,
        result: null,
        status: 'scheduled',
        weekIndex,
      });
    }

    weeks.push({
      games,
      label: `Week ${weekIndex + 1}`,
      weekIndex,
    });
    rotatingTeams = rotateRight(rotatingTeams);
  }

  return weeks;
}

function rotateRight(values: readonly string[]): string[] {
  if (values.length <= 1) {
    return [...values];
  }
  return [values[values.length - 1]!, ...values.slice(0, -1)];
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

function createEmptyTeamStats(teamId: string): DynastyTeamSeasonStats {
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

function seededShuffle(values: readonly string[], seed: string): string[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(hashToUnit(`${seed}:${index}`) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

function createStableSaveId(seed: string, userTeamId: string, year: number): string {
  return `dynasty-${year}-${userTeamId}-${hashText(seed)}`;
}

function hashText(seed: string): string {
  return Math.round(hashToUnit(seed) * 0xffffffff)
    .toString(36)
    .padStart(6, '0');
}

function hashToUnit(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return state / 0xffffffff;
}
