import type {
  DynastyGameResult,
  DynastyGameTeamStats,
  DynastySaveData,
  DynastyScheduledGame,
  DynastySeason,
  DynastyTeamRecord,
  DynastyTeamSeasonStats,
  DynastyWeek,
} from './DynastyTypes';

export interface DynastyWeekAdvanceResult {
  readonly advanced: boolean;
  readonly save: DynastySaveData;
  readonly simulatedGameIds: readonly string[];
}

export interface DynastyUserGameResultInput {
  readonly opponentScore: number;
  readonly userScore: number;
}

export function getCurrentDynastyWeek(save: DynastySaveData): DynastyWeek | null {
  return save.currentSeason.weeks[save.currentWeekIndex] ?? null;
}

export function getCurrentDynastyUserGame(save: DynastySaveData): DynastyScheduledGame | null {
  const week = getCurrentDynastyWeek(save);
  return week?.games.find((game) => isUserDynastyGame(save, game)) ?? null;
}

export function canAdvanceDynastyWeek(save: DynastySaveData): boolean {
  const week = getCurrentDynastyWeek(save);
  return !!week && week.games.every((game) => game.status === 'final' && game.result);
}

export function normalizeDynastySaveStats(save: DynastySaveData): DynastySaveData {
  return {
    ...save,
    currentSeason: recalculateDynastySeasonAggregates({
      ...save.currentSeason,
      weeks: save.currentSeason.weeks.map((week) => ({
        ...week,
        games: week.games.map((game) => {
          if (!game.result) {
            return game;
          }
          if (game.result.awayStats && game.result.homeStats) {
            return game;
          }
          return {
            ...game,
            result: createGameResult(game, game.result.awayScore, game.result.homeScore),
          };
        }),
      })),
    }),
  };
}

export function simulateCurrentDynastyWeekNonUserGames(save: DynastySaveData): DynastyWeekAdvanceResult {
  const week = getCurrentDynastyWeek(save);
  if (!week || save.status === 'complete') {
    return {
      advanced: false,
      save,
      simulatedGameIds: [],
    };
  }

  const simulatedGameIds: string[] = [];
  const nextWeek: DynastyWeek = {
    ...week,
    games: week.games.map((game) => {
      if (game.status === 'final' || isUserDynastyGame(save, game)) {
        return game;
      }
      simulatedGameIds.push(game.gameId);
      return finishDynastyGame(
        game,
        simulateDynastyGameResult(save, game),
      );
    }),
  };

  const nextSave = replaceDynastyWeek(save, nextWeek);
  return {
    advanced: false,
    save: nextSave,
    simulatedGameIds,
  };
}

export function simulateCurrentDynastyUserGame(save: DynastySaveData): DynastyWeekAdvanceResult {
  const week = getCurrentDynastyWeek(save);
  const game = getCurrentDynastyUserGame(save);
  if (!week || !game || game.status === 'final' || save.status === 'complete') {
    return {
      advanced: false,
      save,
      simulatedGameIds: [],
    };
  }

  const nextWeek: DynastyWeek = {
    ...week,
    games: week.games.map((weekGame) =>
      weekGame.gameId === game.gameId
        ? finishDynastyGame(weekGame, simulateDynastyGameResult(save, weekGame))
        : weekGame),
  };

  return {
    advanced: false,
    save: replaceDynastyWeek(save, nextWeek),
    simulatedGameIds: [game.gameId],
  };
}

export function recordCurrentDynastyUserGameResult(
  save: DynastySaveData,
  result: DynastyUserGameResultInput,
): DynastySaveData {
  const week = getCurrentDynastyWeek(save);
  const game = getCurrentDynastyUserGame(save);
  if (!week || !game || game.status === 'final' || save.status === 'complete') {
    return save;
  }

  const userIsAway = game.awayTeamId === save.userTeamId;
  const awayScore = Math.max(0, Math.round(userIsAway ? result.userScore : result.opponentScore));
  const homeScore = Math.max(0, Math.round(userIsAway ? result.opponentScore : result.userScore));
  const nextWeek: DynastyWeek = {
    ...week,
    games: week.games.map((weekGame) =>
      weekGame.gameId === game.gameId
        ? finishDynastyGame(weekGame, createGameResult(game, awayScore, homeScore))
        : weekGame),
  };
  return replaceDynastyWeek(save, nextWeek);
}

export function advanceDynastyWeek(save: DynastySaveData): DynastyWeekAdvanceResult {
  if (!canAdvanceDynastyWeek(save)) {
    return {
      advanced: false,
      save,
      simulatedGameIds: [],
    };
  }

  const nextWeekIndex = save.currentWeekIndex + 1;
  const seasonComplete = nextWeekIndex >= save.currentSeason.weeks.length;
  return {
    advanced: true,
    save: {
      ...save,
      currentWeekIndex: seasonComplete ? save.currentSeason.weeks.length : nextWeekIndex,
      status: seasonComplete ? 'complete' : 'active',
    },
    simulatedGameIds: [],
  };
}

function replaceDynastyWeek(save: DynastySaveData, nextWeek: DynastyWeek): DynastySaveData {
  const weeks = save.currentSeason.weeks.map((week) =>
    week.weekIndex === nextWeek.weekIndex ? nextWeek : week);
  return {
    ...save,
    currentSeason: recalculateDynastySeasonAggregates({
      ...save.currentSeason,
      weeks,
    }),
  };
}

function recalculateDynastySeasonAggregates(season: DynastySeason): DynastySeason {
  const records = new Map<string, DynastyTeamRecord>(
    season.teamIds.map((teamId) => [
      teamId,
      {
        losses: 0,
        pointsAgainst: 0,
        pointsFor: 0,
        teamId,
        wins: 0,
      },
    ]),
  );
  const stats = new Map<string, DynastyTeamSeasonStats>(
    season.teamIds.map((teamId) => [teamId, createEmptySeasonStats(teamId)]),
  );

  for (const week of season.weeks) {
    for (const game of week.games) {
      if (game.status !== 'final' || !game.result) {
        continue;
      }
      applyGameResult(records, game);
      applyGameStats(stats, game);
    }
  }

  return {
    ...season,
    standings: season.teamIds.map((teamId) => records.get(teamId)!).filter(Boolean),
    teamStats: season.teamIds.map((teamId) => stats.get(teamId)!).filter(Boolean),
  };
}

function applyGameResult(
  records: Map<string, DynastyTeamRecord>,
  game: DynastyScheduledGame,
): void {
  const awayRecord = records.get(game.awayTeamId);
  const homeRecord = records.get(game.homeTeamId);
  if (!awayRecord || !homeRecord || !game.result) {
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
}

function finishDynastyGame(
  game: DynastyScheduledGame,
  result: DynastyGameResult,
): DynastyScheduledGame {
  return {
    ...game,
    result,
    status: 'final',
  };
}

function simulateDynastyGameResult(
  save: DynastySaveData,
  game: DynastyScheduledGame,
): DynastyGameResult {
  const base = `${save.seed}:${save.currentSeason.seasonId}:${game.gameId}`;
  let awayScore = createFootballScore(base, game.awayTeamId, 'away');
  let homeScore = createFootballScore(base, game.homeTeamId, 'home');

  if (awayScore === homeScore) {
    if (hashToUnit(`${base}:tie-break`) >= 0.5) {
      awayScore += 3;
    } else {
      homeScore += 3;
    }
  }

  return createGameResult(game, awayScore, homeScore);
}

function createGameResult(
  game: DynastyScheduledGame,
  awayScore: number,
  homeScore: number,
): DynastyGameResult {
  const base = `${game.gameId}:${awayScore}:${homeScore}`;
  return {
    awayScore,
    awayStats: createGameTeamStats(`${base}:${game.awayTeamId}:away`, awayScore, homeScore),
    homeScore,
    homeStats: createGameTeamStats(`${base}:${game.homeTeamId}:home`, homeScore, awayScore),
    winnerTeamId: awayScore > homeScore ? game.awayTeamId : game.homeTeamId,
  };
}

function applyGameStats(
  stats: Map<string, DynastyTeamSeasonStats>,
  game: DynastyScheduledGame,
): void {
  if (!game.result) {
    return;
  }

  const awayStats = stats.get(game.awayTeamId);
  const homeStats = stats.get(game.homeTeamId);
  if (!awayStats || !homeStats) {
    return;
  }

  stats.set(game.awayTeamId, addGameStats(
    awayStats,
    game.result.awayStats,
    game.result.homeStats,
    game.result.awayScore,
    game.result.homeScore,
  ));
  stats.set(game.homeTeamId, addGameStats(
    homeStats,
    game.result.homeStats,
    game.result.awayStats,
    game.result.homeScore,
    game.result.awayScore,
  ));
}

function addGameStats(
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

function createEmptySeasonStats(teamId: string): DynastyTeamSeasonStats {
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

function createGameTeamStats(
  seed: string,
  pointsFor: number,
  pointsAgainst: number,
): DynastyGameTeamStats {
  const touchdowns = Math.max(0, Math.min(8, Math.floor(pointsFor / 7)));
  const fieldGoals = Math.max(0, Math.min(5, Math.floor((pointsFor - touchdowns * 7) / 3)));
  const paceYards = 245 + Math.floor(hashToUnit(`${seed}:pace`) * 165);
  const scoreYards = touchdowns * 28 + fieldGoals * 12;
  const offensiveYards = Math.max(120, paceYards + scoreYards - Math.max(0, pointsAgainst - pointsFor) * 3);
  const passingShare = 0.45 + hashToUnit(`${seed}:pass-share`) * 0.28;
  const passingYards = Math.min(offensiveYards, Math.round(offensiveYards * passingShare));
  const rushingYards = offensiveYards - passingYards;
  const giveaways = Math.floor(hashToUnit(`${seed}:giveaways`) * 3);
  const takeaways = Math.floor(hashToUnit(`${seed}:takeaways`) * 3);

  return {
    fieldGoals,
    giveaways,
    offensiveYards,
    passingYards,
    rushingYards,
    takeaways,
    touchdowns,
  };
}

function createFootballScore(seed: string, teamId: string, side: 'away' | 'home'): number {
  const touchdownWeight = Math.floor(hashToUnit(`${seed}:${teamId}:${side}:td`) * 5);
  const fieldGoalWeight = Math.floor(hashToUnit(`${seed}:${teamId}:${side}:fg`) * 4);
  const safetyWeight = hashToUnit(`${seed}:${teamId}:${side}:safety`) > 0.92 ? 2 : 0;
  const homeBonus = side === 'home' && hashToUnit(`${seed}:${teamId}:home-bonus`) > 0.55 ? 3 : 0;
  return 10 + touchdownWeight * 7 + fieldGoalWeight * 3 + safetyWeight + homeBonus;
}

function isUserDynastyGame(save: DynastySaveData, game: DynastyScheduledGame): boolean {
  return game.awayTeamId === save.userTeamId || game.homeTeamId === save.userTeamId;
}

function hashToUnit(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return state / 0xffffffff;
}
