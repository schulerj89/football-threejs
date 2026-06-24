import type {
  DynastyGameResult,
  DynastySaveData,
  DynastyScheduledGame,
  DynastySeason,
  DynastyTeamRecord,
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
    currentSeason: recalculateDynastyStandings({
      ...save.currentSeason,
      weeks,
    }),
  };
}

function recalculateDynastyStandings(season: DynastySeason): DynastySeason {
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

  for (const week of season.weeks) {
    for (const game of week.games) {
      if (game.status !== 'final' || !game.result) {
        continue;
      }
      applyGameResult(records, game);
    }
  }

  return {
    ...season,
    standings: season.teamIds.map((teamId) => records.get(teamId)!).filter(Boolean),
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
  return {
    awayScore,
    homeScore,
    winnerTeamId: awayScore > homeScore ? game.awayTeamId : game.homeTeamId,
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
